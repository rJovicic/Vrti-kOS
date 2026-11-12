-- VrtićOS D2-E — transfer and withdrawal of a child (FR-04-2, FR-04-3, AC-04-4, AC-04-8; docs/architecture/d2-plan.md).
--
-- Owner decisions (2026-11-12):
--   D-35 (a) withdrawal with last day T ends the child's enrolment, guardian links and pickup authorizations at T
--            (valid through T, gone from T+1). Rows are closed, never deleted; link rights and restrictions are kept.
--   D-36 (a) transfer and withdrawal dates are today or later (kindergarten time zone). The same rule applies to
--            manual changes of an enrolment period: days before today are never rewritten.
-- Defined earlier: transfer on T = the child is in the new group from T (AC-04-4: E2 sees the child from T, E1 no longer);
-- one enrolment at a time (exclusion constraint, D2-A); access is derived from date ranges at query time, so it changes
-- on the next request (NEG-08); a restriction is not a pickup rule (D-33).
--
-- Technical decisions (this migration):
--   * The work is done by SECURITY DEFINER functions in `private` (not exposed, SR-API-01), called through SECURITY
--     INVOKER wrappers in `api`: children.status/withdrawn_on are not writable by any client (guard_children), and the
--     multi-table change must be one transaction (one RPC call = one statement = all or nothing). Each function
--     authorizes explicitly FIRST (manager with AAL2,
--     private.is_org_manager), answers PERMISSION_DENIED identically for unknown ids and other kindergartens, then locks
--     the child row (concurrent transfers/withdrawals of one child are serialized) and validates.
--   * Business errors are raised only after authorization (errcode P0001) and are safe to show.
--   * Transfer keeps the planned end of the current enrolment for the new one.
--   * Records that start after the effective date (a planned enrolment, link or pickup authorization) are not
--     cancelled automatically: the operation is refused (ENROLLMENT_OVERLAP / WITHDRAWAL_HAS_FUTURE_RECORDS). There is
--     no approved way yet to cancel a record that never took effect (open question, see phase-status).
--   * Transfer into an archived group is refused (GROUP_ARCHIVED).
--   * One summary audit event per operation (ids, dates and counts only) in addition to the per-row audit triggers.

-- Lifecycle guard for client writes -----------------------------------------------------------------------------
-- Fires after the table's authorization guard (trigger names sort: *_guard < *_lifecycle_guard), so callers without
-- rights still get PERMISSION_DENIED first. Server roles (RPCs as owner, service role, seed) are not affected.
-- SECURITY INVOKER on purpose (like the other guards): current_user must be the caller's role. Only managers reach this
-- trigger (the authorization guard ran first) and they can read the child through RLS.
create function private.guard_child_lifecycle() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_withdrawn_on date;
  v_past daterange;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- D-36: a manual change of an enrolment period never rewrites days before today.
  if tg_table_name = 'enrollments' and tg_op = 'UPDATE' and new.valid_during is distinct from old.valid_during then
    v_past := daterange(null, private.org_today(new.organization_id));
    if (old.valid_during * v_past) is distinct from (new.valid_during * v_past) then
      raise exception 'HISTORY_IMMUTABLE';
    end if;
  end if;
  -- D-35: after withdrawal nothing about the child is valid beyond its last day.
  select c.withdrawn_on into v_withdrawn_on
  from public.children c
  where c.id = new.child_id and c.organization_id = new.organization_id;
  if v_withdrawn_on is not null
     and (upper_inf(new.valid_during) or upper(new.valid_during) > v_withdrawn_on + 1) then
    raise exception 'CHILD_WITHDRAWN';
  end if;
  return new;
end $$;
revoke execute on function private.guard_child_lifecycle() from public, anon, authenticated;

create trigger enrollments_lifecycle_guard before insert or update on public.enrollments
  for each row execute function private.guard_child_lifecycle();
create trigger child_guardians_lifecycle_guard before insert or update on public.child_guardians
  for each row execute function private.guard_child_lifecycle();
create trigger pickup_authorizations_lifecycle_guard before insert or update on public.pickup_authorizations
  for each row execute function private.guard_child_lifecycle();

-- Shared preamble: authorize, lock and return the child. Not callable by clients.
create function private.lock_child_for_manager(p_child_id uuid) returns public.children
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_child public.children;
begin
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  -- Same answer for an unknown child and a child the caller may not manage (no existence oracle).
  if v_org is null or not private.is_org_manager(v_org) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  select * into v_child from public.children c where c.id = p_child_id for update;
  return v_child;
end $$;
revoke execute on function private.lock_child_for_manager(uuid) from public, anon, authenticated;

-- Transfer ------------------------------------------------------------------------------------------------------
-- From p_effective_on the child is in p_group_id. The current enrolment ends the day before; the new one starts on
-- p_effective_on and keeps the old planned end. Returns the new enrolment id.
create function private.transfer_child(p_child_id uuid, p_group_id uuid, p_effective_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_child public.children;
  v_group public.groups;
  v_current public.enrollments;
  v_new uuid;
begin
  if p_child_id is null or p_group_id is null or p_effective_on is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  v_child := private.lock_child_for_manager(p_child_id);
  select * into v_group from public.groups g where g.id = p_group_id and g.organization_id = v_child.organization_id;
  if v_group.id is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_effective_on < private.org_today(v_child.organization_id) then
    raise exception 'EFFECTIVE_DATE_IN_PAST';
  end if;
  if v_child.status = 'withdrawn' then
    raise exception 'CHILD_WITHDRAWN';
  end if;
  if v_group.archived_at is not null then
    raise exception 'GROUP_ARCHIVED';
  end if;
  select * into v_current from public.enrollments e
  where e.child_id = p_child_id and e.valid_during @> p_effective_on
  for update;
  if v_current.id is null then
    raise exception 'CHILD_NOT_ENROLLED';
  end if;
  if v_current.group_id = p_group_id then
    raise exception 'TRANSFER_SAME_GROUP';
  end if;
  if lower(v_current.valid_during) >= p_effective_on then
    -- The enrolment starts on that day: ending it the day before would leave an empty period.
    raise exception 'TRANSFER_ON_ENROLLMENT_START';
  end if;
  if exists (select 1 from public.enrollments e where e.child_id = p_child_id and lower(e.valid_during) > p_effective_on) then
    raise exception 'ENROLLMENT_OVERLAP';
  end if;

  update public.enrollments set valid_during = daterange(lower(v_current.valid_during), p_effective_on)
  where id = v_current.id;
  insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
  values (v_child.organization_id, p_child_id, p_group_id,
          daterange(p_effective_on, upper(v_current.valid_during)), (select auth.uid()))
  returning id into v_new;

  insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
  values (v_child.organization_id, (select auth.uid()), 'child.transfer', 'children', p_child_id,
          jsonb_build_object('effective_on', p_effective_on, 'from_group_id', v_current.group_id, 'to_group_id', p_group_id,
                             'closed_enrollment_id', v_current.id, 'new_enrollment_id', v_new));
  return v_new;
end $$;
revoke execute on function private.transfer_child(uuid, uuid, date) from public, anon;
grant execute on function private.transfer_child(uuid, uuid, date) to authenticated;

create function api.transfer_child(p_child_id uuid, p_group_id uuid, p_effective_on date) returns uuid
language sql security invoker set search_path = '' as $$
  select private.transfer_child(p_child_id, p_group_id, p_effective_on)
$$;
revoke execute on function api.transfer_child(uuid, uuid, date) from public, anon;
grant execute on function api.transfer_child(uuid, uuid, date) to authenticated;
comment on function api.transfer_child(uuid, uuid, date) is
  'Premještaj djeteta (FR-04-2, D-36): od p_effective_on u novoj skupini; stari upis završava dan prije. Samo uprava (MFA).';

-- Withdrawal ----------------------------------------------------------------------------------------------------
-- p_last_day is the last day the child attends (AC-04-8). Enrolments, guardian links and pickup authorizations that
-- are valid after it end with it (D-35); the child becomes `withdrawn`. Nothing is deleted; flags, restrictions,
-- guardian records and memberships are not changed.
create function private.withdraw_child(p_child_id uuid, p_last_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_child public.children;
  v_end date;
  v_enrollments int;
  v_links int;
  v_pickups int;
begin
  if p_child_id is null or p_last_day is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  v_child := private.lock_child_for_manager(p_child_id);
  if p_last_day < private.org_today(v_child.organization_id) then
    raise exception 'EFFECTIVE_DATE_IN_PAST';
  end if;
  if v_child.status = 'withdrawn' then
    raise exception 'CHILD_WITHDRAWN';
  end if;
  if exists (select 1 from public.enrollments e where e.child_id = p_child_id and lower(e.valid_during) > p_last_day)
     or exists (select 1 from public.child_guardians cg where cg.child_id = p_child_id and lower(cg.valid_during) > p_last_day)
     or exists (select 1 from public.pickup_authorizations pa where pa.child_id = p_child_id and lower(pa.valid_during) > p_last_day) then
    raise exception 'WITHDRAWAL_HAS_FUTURE_RECORDS';
  end if;
  v_end := p_last_day + 1;

  update public.enrollments set valid_during = daterange(lower(valid_during), v_end)
  where child_id = p_child_id and (upper_inf(valid_during) or upper(valid_during) > v_end);
  get diagnostics v_enrollments = row_count;
  update public.child_guardians set valid_during = daterange(lower(valid_during), v_end)
  where child_id = p_child_id and (upper_inf(valid_during) or upper(valid_during) > v_end);
  get diagnostics v_links = row_count;
  update public.pickup_authorizations set valid_during = daterange(lower(valid_during), v_end)
  where child_id = p_child_id and (upper_inf(valid_during) or upper(valid_during) > v_end);
  get diagnostics v_pickups = row_count;
  update public.children set status = 'withdrawn', withdrawn_on = p_last_day where id = p_child_id;

  insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
  values (v_child.organization_id, (select auth.uid()), 'child.withdraw', 'children', p_child_id,
          jsonb_build_object('last_day', p_last_day, 'closed_enrollments', v_enrollments,
                             'closed_guardian_links', v_links, 'closed_pickup_authorizations', v_pickups));
end $$;
revoke execute on function private.withdraw_child(uuid, date) from public, anon;
grant execute on function private.withdraw_child(uuid, date) to authenticated;

create function api.withdraw_child(p_child_id uuid, p_last_day date) returns void
language sql security invoker set search_path = '' as $$
  select private.withdraw_child(p_child_id, p_last_day)
$$;
revoke execute on function api.withdraw_child(uuid, date) from public, anon;
grant execute on function api.withdraw_child(uuid, date) to authenticated;
comment on function api.withdraw_child(uuid, date) is
  'Ispis djeteta (FR-04-3, D-35, D-36): upis, veze skrbnika i ovlaštene osobe vrijede do zadnjeg dana. Samo uprava (MFA).';
