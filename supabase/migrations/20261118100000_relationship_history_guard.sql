-- VrtićOS — D-41a: regular operations never rewrite the past of a child's relationships (D-36 extended by D-41).
--
--   Applies to enrolments, guardian–child links, access restrictions and pickup authorizations — every table whose
--   validity period decides who had access to a child. For client roles (`authenticated`, `anon`):
--     * INSERT: the period starts today or later (kindergarten time zone). An unbounded start is a start in the past.
--     * UPDATE of `valid_during`: no day before today changes — neither the start nor the end. This is exactly the D-36
--       rule already enforced for enrolment updates since D2-E (a change may take effect today: a record in effect may
--       end "as of today", i.e. its last valid day is yesterday, because no day before today is rewritten).
--     * pickup_authorizations: the person's name cannot change once the authorisation was valid before today —
--       attendance records point to it (handover, D-38), so a rename would rewrite who picked a child up in the past.
--   Allowed: starting today or later, moving a future start to another day from today on, ending as of today or
--   later, extending an end, renaming a pickup person whose authorisation has not started yet.
--
--   Server-side operations run as the table owner and are not affected by this trigger; each one already enforces the
--   same dates itself: api.transfer_child / api.withdraw_child (today or later, D-36), api.cancel_future_record (only
--   records starting after today, D-37), api.accept_invitations (never writes a period). Historical corrections of real
--   errors will be a separate, authorised and audited operation (D-41b) — not this path.
--
--   The trigger is named *_history_guard so it fires after the table's authorisation guard (*_guard): callers without
--   rights still get PERMISSION_DENIED first. SECURITY INVOKER on purpose, like the other guards: current_user must be
--   the caller's role. The older D-36 check for enrolment updates in private.guard_child_lifecycle stays as it is.

create function private.guard_relationship_history() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_today date;
  v_past daterange;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_today := private.org_today(new.organization_id);
  v_past := daterange(null, v_today);
  if tg_op = 'INSERT' then
    if lower_inf(new.valid_during) or lower(new.valid_during) < v_today then
      raise exception 'HISTORY_IMMUTABLE';
    end if;
  else
    if new.valid_during is distinct from old.valid_during
       and (old.valid_during * v_past) is distinct from (new.valid_during * v_past) then
      raise exception 'HISTORY_IMMUTABLE';
    end if;
    -- Nested IF: other tables have no name columns, and plpgsql does not promise short-circuit evaluation.
    if tg_table_name = 'pickup_authorizations' then
      if (new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name)
         and not isempty(old.valid_during * v_past) then
        raise exception 'HISTORY_IMMUTABLE';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.guard_relationship_history() from public, anon, authenticated;
comment on function private.guard_relationship_history() is
  'D-41a: klijentske izmjene razdoblja upisa, veza, ograničenja i ovlaštenih osoba ne diraju dane prije današnjeg.';

create trigger enrollments_history_guard before insert or update on public.enrollments
  for each row execute function private.guard_relationship_history();
create trigger child_guardians_history_guard before insert or update on public.child_guardians
  for each row execute function private.guard_relationship_history();
create trigger access_restrictions_history_guard before insert or update on public.access_restrictions
  for each row execute function private.guard_relationship_history();
create trigger pickup_authorizations_history_guard before insert or update on public.pickup_authorizations
  for each row execute function private.guard_relationship_history();
