-- VrtićOS — Q-T22 (owner, 2026-11-19): cancelling a record entered TODAY by mistake. A separate addition to D-37.
--
-- Decision: a manager with MFA may cancel an enrolment, a guardian–child link or a pickup authorization that starts
-- today, only if no business event depends on it yet; records that started before today stay protected; no physical
-- deletion; audited; existing rights and MFA unchanged; the dependency check and the cancellation are atomic.
--
-- How (technical decisions, conservative):
--   * Record types: exactly those of D-37 (enrolment, link, pickup authorization). Access restrictions are not covered
--     (D-37 does not cover them either): a restriction entered today by mistake stays until it is ended — the safe side.
--   * No deletion: the row stays. `cancelled_at` is set, the original period is kept in `cancelled_period`, and
--     `valid_during` becomes the empty range — every access rule tests "valid on day X" (`@>`) or overlap (`&&`), and an
--     empty range contains no day and overlaps nothing, so the record stops granting anything at once, everywhere,
--     without changing any access helper. A table constraint ties the three columns together; clients have no privilege
--     on the new columns, so they can neither cancel nor un-cancel, and a cancelled row is frozen for clients.
--   * Dependencies, mapped per record type (a cancellation is refused with RECORD_HAS_DEPENDENTS if any exists):
--       enrolment  — any attendance record of the child from the start day on (incl. voided and corrections);
--                    any absence record of the child created from the start day on (educators of the group were
--                    notified through this enrolment); any message in the child's conversations from the start day on
--                    (the group's educators took part through this enrolment);
--       link       — any attendance record naming the link as handover person; any absence the guardian reported for
--                    the child from the start day on; any message in that guardian's conversation about the child from
--                    the start day on; an access restriction on the link (CANCEL_RECORD_REFERENCED, as in D-37);
--       pickup     — any attendance record naming the person as handover person (incl. voided).
--     Not counted, documented: notifications (delivery receipts of group-level content, not facts about the child) and
--     daily overviews (group-level; reading leaves no record).
--   * Locking: the child row FOR UPDATE first (as transfer, withdrawal and D-37), then the record. Every writer of a
--     dependent event locks the child FOR SHARE before its own checks (migration 20261119100000), so a concurrent event
--     either exists before the check or waits and then sees the cancelled record.
--   * D-37 (records starting after today, deleted as approved on 2026-11-12) is unchanged and stays a separate RPC.

-- Columns and constraints ------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['enrollments', 'child_guardians', 'pickup_authorizations'] loop
    execute format('alter table public.%I add column cancelled_at timestamptz, add column cancelled_period daterange', t);
    execute format('alter table public.%I drop constraint %I', t, t || '_not_empty');
    execute format($c$alter table public.%I add constraint %I check (
        (cancelled_at is null) = (not isempty(valid_during))
        and (cancelled_at is null) = (cancelled_period is null)
        and (cancelled_period is null or not isempty(cancelled_period)))$c$, t, t || '_not_empty_unless_cancelled');
    execute format('comment on column public.%I.cancelled_at is %L', t,
      'Q-T22: zapis unesen danas greškom poništen (bez brisanja); razdoblje je tada prazno, izvorno je u cancelled_period.');
  end loop;
end $$;

-- Readable like the other columns (row visibility is still decided by RLS); never writable by clients.
grant select (cancelled_at, cancelled_period) on public.enrollments, public.child_guardians, public.pickup_authorizations to authenticated;

-- A cancelled record is final for clients: no column of it changes any more.
create function private.guard_cancelled_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and old.cancelled_at is not null then
    raise exception 'RECORD_ALREADY_CANCELLED';
  end if;
  return new;
end $$;
revoke execute on function private.guard_cancelled_record() from public, anon, authenticated;
create trigger enrollments_cancelled_guard before update on public.enrollments for each row execute function private.guard_cancelled_record();
create trigger child_guardians_cancelled_guard before update on public.child_guardians for each row execute function private.guard_cancelled_record();
create trigger pickup_authorizations_cancelled_guard before update on public.pickup_authorizations for each row execute function private.guard_cancelled_record();

-- Dependency check (definer; never called by clients) ---------------------------------------------------------------------
create function private.same_day_dependents(p_kind text, p_record_id uuid, p_org uuid, p_child uuid, p_from date) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_guardian uuid;
  v_profile uuid;
begin
  if p_kind = 'enrollment' then
    return exists (select 1 from public.attendance_records a where a.child_id = p_child and a.local_date >= p_from)
        or exists (select 1 from public.absence_records r where r.child_id = p_child and private.org_local_date(p_org, r.created_at) >= p_from)
        or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                   where c.child_id = p_child and private.org_local_date(p_org, m.created_at) >= p_from);
  elsif p_kind = 'child_guardian' then
    select cg.guardian_id, g.profile_id into v_guardian, v_profile
    from public.child_guardians cg join public.guardians g on g.id = cg.guardian_id where cg.id = p_record_id;
    return exists (select 1 from public.attendance_records a where a.handover_child_guardian_id = p_record_id)
        or exists (select 1 from public.absence_records r where r.child_id = p_child and v_profile is not null
                   and r.reported_by = v_profile and private.org_local_date(p_org, r.created_at) >= p_from)
        or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                   where c.child_id = p_child and c.guardian_id = v_guardian and private.org_local_date(p_org, m.created_at) >= p_from);
  else
    return exists (select 1 from public.attendance_records a where a.handover_pickup_id = p_record_id);
  end if;
end $$;
revoke execute on function private.same_day_dependents(text, uuid, uuid, uuid, date) from public, anon, authenticated;

-- The operation --------------------------------------------------------------------------------------------------------------
create function private.cancel_same_day_record(p_kind text, p_record_id uuid, p_reason public.cancellation_reason)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_child uuid;
  v_org uuid;
  v_period daterange;
  v_cancelled timestamptz;
  v_today date;
begin
  if p_kind is null or p_record_id is null or p_reason is null
     or p_kind not in ('enrollment', 'child_guardian', 'pickup_authorization') then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  if p_kind = 'enrollment' then
    select e.child_id into v_child from public.enrollments e where e.id = p_record_id;
  elsif p_kind = 'child_guardian' then
    select cg.child_id into v_child from public.child_guardians cg where cg.id = p_record_id;
  else
    select pa.child_id into v_child from public.pickup_authorizations pa where pa.id = p_record_id;
  end if;
  if v_child is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- Authorize (org_admin/director of the child's kindergarten with MFA) and lock the child FOR UPDATE.
  v_org := (private.lock_child_for_manager(v_child)).organization_id;
  v_today := private.org_today(v_org);

  if p_kind = 'enrollment' then
    select e.valid_during, e.cancelled_at into v_period, v_cancelled from public.enrollments e where e.id = p_record_id for update;
  elsif p_kind = 'child_guardian' then
    select cg.valid_during, cg.cancelled_at into v_period, v_cancelled from public.child_guardians cg where cg.id = p_record_id for update;
  else
    select pa.valid_during, pa.cancelled_at into v_period, v_cancelled from public.pickup_authorizations pa where pa.id = p_record_id for update;
  end if;
  if v_cancelled is not null then
    raise exception 'RECORD_ALREADY_CANCELLED';
  end if;
  -- Only records starting exactly today: earlier ones are protected (D-41a), later ones go through D-37.
  if lower(v_period) is distinct from v_today then
    raise exception 'CANCEL_TODAY_ONLY';
  end if;
  if p_kind = 'child_guardian'
     and exists (select 1 from public.access_restrictions ar where ar.child_guardian_id = p_record_id) then
    raise exception 'CANCEL_RECORD_REFERENCED';
  end if;
  if private.same_day_dependents(p_kind, p_record_id, v_org, v_child, v_today) then
    raise exception 'RECORD_HAS_DEPENDENTS';
  end if;

  insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
  values (v_org, (select auth.uid()), 'record.cancel_same_day',
          case p_kind when 'enrollment' then 'enrollments' when 'child_guardian' then 'child_guardians' else 'pickup_authorizations' end,
          p_record_id, jsonb_build_object('record_type', p_kind, 'reason', p_reason, 'starts_on', v_today));

  if p_kind = 'enrollment' then
    update public.enrollments set cancelled_at = now(), cancelled_period = valid_during, valid_during = 'empty' where id = p_record_id;
  elsif p_kind = 'child_guardian' then
    update public.child_guardians set cancelled_at = now(), cancelled_period = valid_during, valid_during = 'empty' where id = p_record_id;
  else
    update public.pickup_authorizations set cancelled_at = now(), cancelled_period = valid_during, valid_during = 'empty' where id = p_record_id;
  end if;
end $$;
revoke execute on function private.cancel_same_day_record(text, uuid, public.cancellation_reason) from public, anon;
grant execute on function private.cancel_same_day_record(text, uuid, public.cancellation_reason) to authenticated;

create function api.cancel_same_day_record(p_kind text, p_record_id uuid, p_reason public.cancellation_reason) returns void
language sql security invoker set search_path = '' as $$
  select private.cancel_same_day_record(p_kind, p_record_id, p_reason)
$$;
revoke execute on function api.cancel_same_day_record(text, uuid, public.cancellation_reason) from public, anon;
grant execute on function api.cancel_same_day_record(text, uuid, public.cancellation_reason) to authenticated;
comment on function api.cancel_same_day_record(text, uuid, public.cancellation_reason) is
  'Q-T22: poništenje zapisa unesenog danas greškom (upis, veza, ovlaštena osoba) bez ovisnih događaja; bez brisanja, auditirano, samo uprava s MFA-om.';
