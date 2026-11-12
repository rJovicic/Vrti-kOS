-- VrtićOS — D-37 (owner, 2026-11-12, option a): a manager may cancel a record that has not taken effect yet.
-- Rules from the decision:
--   1. managers with MFA only;                       2. only if the record starts strictly after today;
--   3. a record that has taken effect is never deleted or cancelled by this mechanism;
--   4. every cancellation is audited: record id, record type, actor, time, reason; no personal data of children;
--   5. one transaction: if the audit or any other step fails, nothing is cancelled;
--   6. no effect on other enrolments, guardian links, access rights or pickup authorizations;
--   7. no way around it through the API (clients have no DELETE grant on these tables; only this RPC deletes).
-- Transfer and withdrawal rules (D2-E, D-35, D-36) are unchanged; historical records are never deleted.
--
-- Technical decisions:
--   * Covered record types are the ones D-37 is about: enrolment, guardian–child link, pickup authorization.
--   * The reason is a fixed code, not free text, so no personal data can enter the audit log.
--   * A future link that already carries an access restriction is refused (CANCEL_RECORD_REFERENCED): cancelling it
--     would have to remove or orphan the restriction (rule 6).
--   * Same structure as D2-E: an invoker wrapper in `api`, the work in a `private` definer function that authorizes
--     first and locks the child row (serialized with transfer/withdrawal of the same child).
--   * Cancelling only removes the record. Undoing a planned transfer also needs the old enrolment's end moved back,
--     which managers already can do for future days (D-36).

create type public.cancellation_reason as enum ('entered_in_error', 'plan_changed', 'withdrawal_planned', 'other');

create function private.cancel_future_record(p_kind text, p_record_id uuid, p_reason public.cancellation_reason)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_child uuid;
  v_org uuid;
  v_starts date;
begin
  if p_kind is null or p_record_id is null or p_reason is null
     or p_kind not in ('enrollment', 'child_guardian', 'pickup_authorization') then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  -- Which child the record belongs to (definer read; nothing is returned before authorization).
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
  -- Authorizes (manager with MFA of the child's kindergarten) and locks the child; same answer as an unknown id.
  v_org := (private.lock_child_for_manager(v_child)).organization_id;

  if p_kind = 'enrollment' then
    select lower(e.valid_during) into v_starts from public.enrollments e where e.id = p_record_id for update;
  elsif p_kind = 'child_guardian' then
    select lower(cg.valid_during) into v_starts from public.child_guardians cg where cg.id = p_record_id for update;
  else
    select lower(pa.valid_during) into v_starts from public.pickup_authorizations pa where pa.id = p_record_id for update;
  end if;
  if v_starts is null or v_starts <= private.org_today(v_org) then
    raise exception 'RECORD_ALREADY_EFFECTIVE';
  end if;
  if p_kind = 'child_guardian'
     and exists (select 1 from public.access_restrictions ar where ar.child_guardian_id = p_record_id) then
    raise exception 'CANCEL_RECORD_REFERENCED';
  end if;

  insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
  values (v_org, (select auth.uid()), 'record.cancel',
          case p_kind when 'enrollment' then 'enrollments' when 'child_guardian' then 'child_guardians' else 'pickup_authorizations' end,
          p_record_id, jsonb_build_object('record_type', p_kind, 'reason', p_reason, 'starts_on', v_starts));

  if p_kind = 'enrollment' then
    delete from public.enrollments where id = p_record_id;
  elsif p_kind = 'child_guardian' then
    delete from public.child_guardians where id = p_record_id;
  else
    delete from public.pickup_authorizations where id = p_record_id;
  end if;
end $$;
revoke execute on function private.cancel_future_record(text, uuid, public.cancellation_reason) from public, anon;
grant execute on function private.cancel_future_record(text, uuid, public.cancellation_reason) to authenticated;

create function api.cancel_future_record(p_kind text, p_record_id uuid, p_reason public.cancellation_reason) returns void
language sql security invoker set search_path = '' as $$
  select private.cancel_future_record(p_kind, p_record_id, p_reason)
$$;
revoke execute on function api.cancel_future_record(text, uuid, public.cancellation_reason) from public, anon;
grant execute on function api.cancel_future_record(text, uuid, public.cancellation_reason) to authenticated;
comment on function api.cancel_future_record(text, uuid, public.cancellation_reason) is
  'D-37: poništenje zapisa (upis, veza skrbnika, ovlaštena osoba) koji još nije počeo vrijediti. Samo uprava (MFA); auditirano.';
