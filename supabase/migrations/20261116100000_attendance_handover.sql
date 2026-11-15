-- VrtićOS — D3-H: the person who hands over or picks up the child (FR-05-3, FR-05-4, AC-05-3, D-38).
--
-- D-38 (owner, 2026-11-15, option b): a guardian whose link has an active access restriction IS offered, with a clearly
-- visible "Ograničeno" mark; the educator follows the kindergarten's procedure. A restriction is not an automatic pickup
-- ban (D-33). No free text and no way to add a person who is not already a guardian or an authorized pickup person.
--
--   * private.handover_candidates(child): the single list — guardians linked to the child on that day (link valid; the
--     guardian's rights flags do not matter for handover) with `restricted`, and pickup persons valid that day. Only
--     staff who may record for the child (managers; educators of the child's group today). Names only, no contacts.
--   * record_attendance takes at most one of p_handover_child_guardian_id / p_handover_pickup_id and checks it against
--     the same list for the event's day (HANDOVER_INVALID otherwise). Omitted = "not recorded" (FR-05-3 is optional;
--     the app's "osoba nije na popisu — slijedi proceduru vrtića" records no person).
--   * A correction with a new time keeps the person of the original event. Guardians never see the person (D3-C read
--     model is unchanged and has no handover column).

-- The list ------------------------------------------------------------------------------------------------------------
create function private.handover_list(p_child uuid, p_day date)
returns table (kind text, id uuid, first_name text, last_name text, restricted boolean)
language sql stable security definer set search_path = '' as $$
  select 'guardian', cg.id, g.first_name, g.last_name,
         exists (select 1 from public.access_restrictions ar
                 where ar.child_guardian_id = cg.id and ar.organization_id = cg.organization_id and ar.valid_during @> p_day)
  from public.child_guardians cg
  join public.guardians g on g.id = cg.guardian_id and g.organization_id = cg.organization_id
  where cg.child_id = p_child and cg.valid_during @> p_day
  union all
  select 'pickup', p.id, p.first_name, p.last_name, false
  from public.pickup_authorizations p
  where p.child_id = p_child and p.valid_during @> p_day
$$;
revoke execute on function private.handover_list(uuid, date) from public, anon, authenticated;

-- Staff who may record for the child today read the list; everyone else gets PERMISSION_DENIED (same answer for unknown
-- ids and other kindergartens). Today only: the list serves the recording screen.
create function private.handover_candidates(p_child_id uuid)
returns table (kind text, id uuid, first_name text, last_name text, restricted boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid;
  v_day date;
begin
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  if v_org is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  v_day := private.org_today(v_org);
  perform private.attendance_authorize(p_child_id, v_day);
  return query select l.kind, l.id, l.first_name, l.last_name, l.restricted from private.handover_list(p_child_id, v_day) l
               order by l.kind, l.last_name, l.first_name;
end $$;
revoke execute on function private.handover_candidates(uuid) from public, anon;
grant execute on function private.handover_candidates(uuid) to authenticated;

-- Raises HANDOVER_INVALID unless the chosen person (if any) is on the list of that child and day.
create function private.attendance_handover_check(p_child uuid, p_day date, p_link uuid, p_pickup uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_link is not null and p_pickup is not null then
    raise exception 'HANDOVER_INVALID';
  end if;
  if p_link is not null and not exists (select 1 from private.handover_list(p_child, p_day) l where l.kind = 'guardian' and l.id = p_link) then
    raise exception 'HANDOVER_INVALID';
  end if;
  if p_pickup is not null and not exists (select 1 from private.handover_list(p_child, p_day) l where l.kind = 'pickup' and l.id = p_pickup) then
    raise exception 'HANDOVER_INVALID';
  end if;
end $$;
revoke execute on function private.attendance_handover_check(uuid, date, uuid, uuid) from public, anon, authenticated;

-- Record with an optional person (replaces the D3-A signature; the app and the admin call by parameter name) ---------
drop function api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text);
drop function private.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text);

create function private.record_attendance(
  p_child_id uuid, p_kind public.attendance_kind, p_idempotency_key uuid, p_occurred_at timestamptz, p_source text,
  p_handover_child_guardian_id uuid, p_handover_pickup_id uuid
) returns table (record_id uuid, kind public.attendance_kind, occurred_at timestamptz, replayed boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_org uuid;
  v_day date;
  v_row public.attendance_records;
begin
  if p_child_id is null or p_kind is null or p_idempotency_key is null or p_kind = 'void' then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  v_day := private.org_local_date(v_org, v_at);
  v_org := private.attendance_authorize(p_child_id, v_day);
  v_row := private.attendance_replay(v_org, p_idempotency_key);
  if v_row.id is not null then
    if v_row.child_id <> p_child_id or v_row.kind <> p_kind
       or v_row.handover_child_guardian_id is distinct from p_handover_child_guardian_id
       or v_row.handover_pickup_id is distinct from p_handover_pickup_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select v_row.id, v_row.kind, v_row.occurred_at, true;
    return;
  end if;
  if v_at > now() + interval '2 minutes' or v_day <> private.org_today(v_org) then
    raise exception 'ATTENDANCE_TIME_INVALID';
  end if;
  if not private.attendance_enrolled(p_child_id, v_day) then
    raise exception 'CHILD_NOT_ENROLLED';
  end if;
  perform private.attendance_handover_check(p_child_id, v_day, p_handover_child_guardian_id, p_handover_pickup_id);
  perform private.attendance_lock(p_child_id, v_day);
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key,
                                         handover_child_guardian_id, handover_pickup_id)
  values (v_org, p_child_id, p_kind, v_at, v_day, (select auth.uid()), private.attendance_source(p_source), p_idempotency_key,
          p_handover_child_guardian_id, p_handover_pickup_id)
  returning * into v_row;
  if not private.attendance_sequence_ok(p_child_id, v_day) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return query select v_row.id, v_row.kind, v_row.occurred_at, false;
end $$;
revoke execute on function private.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text, uuid, uuid) from public, anon;
grant execute on function private.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text, uuid, uuid) to authenticated;

create function api.record_attendance(
  p_child_id uuid, p_kind public.attendance_kind, p_idempotency_key uuid, p_occurred_at timestamptz default null, p_source text default 'app',
  p_handover_child_guardian_id uuid default null, p_handover_pickup_id uuid default null
) returns table (record_id uuid, kind public.attendance_kind, occurred_at timestamptz, replayed boolean)
language sql security invoker set search_path = '' as $$
  select * from private.record_attendance(p_child_id, p_kind, p_idempotency_key, p_occurred_at, p_source,
                                          p_handover_child_guardian_id, p_handover_pickup_id)
$$;
revoke execute on function api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text, uuid, uuid) from public, anon;
grant execute on function api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text, uuid, uuid) to authenticated;
comment on function api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text, uuid, uuid) is
  'D3-A/D3-H: dolazak ili odlazak; po želji osoba predaje s popisa (api.handover_candidates), najviše jedna.';

create function api.handover_candidates(p_child_id uuid)
returns table (kind text, id uuid, first_name text, last_name text, restricted boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.handover_candidates(p_child_id)
$$;
revoke execute on function api.handover_candidates(uuid) from public, anon;
grant execute on function api.handover_candidates(uuid) to authenticated;
comment on function api.handover_candidates(uuid) is
  'D3-H, D-38 (b): skrbnici i ovlaštene osobe djeteta za danas; ograničeni skrbnik s oznakom restricted. Samo osoblje koje smije evidentirati.';

-- A correction with a new time keeps the person of the original event ------------------------------------------------
create or replace function private.correct_attendance(
  p_record_id uuid, p_reason public.attendance_correction_reason, p_new_occurred_at timestamptz, p_idempotency_key uuid, p_source text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.attendance_records;
  v_row public.attendance_records;
begin
  if p_record_id is null or p_reason is null or p_idempotency_key is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select * into v_target from public.attendance_records a where a.id = p_record_id;
  if v_target.id is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  perform private.attendance_authorize(v_target.child_id, v_target.local_date);
  v_row := private.attendance_replay(v_target.organization_id, p_idempotency_key);
  if v_row.id is not null then
    return v_row.id;
  end if;
  if v_target.kind = 'void' then
    raise exception 'ATTENDANCE_ALREADY_VOIDED';
  end if;
  if p_new_occurred_at is not null
     and (p_new_occurred_at > now() + interval '2 minutes'
          or private.org_local_date(v_target.organization_id, p_new_occurred_at) <> v_target.local_date) then
    raise exception 'ATTENDANCE_TIME_INVALID';
  end if;
  perform private.attendance_lock(v_target.child_id, v_target.local_date);
  if exists (select 1 from public.attendance_records v where v.kind = 'void' and v.corrects_id = v_target.id) then
    raise exception 'ATTENDANCE_ALREADY_VOIDED';
  end if;
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, corrects_id, correction_reason, idempotency_key)
  values (v_target.organization_id, v_target.child_id, 'void', now(), v_target.local_date, (select auth.uid()),
          private.attendance_source(p_source), v_target.id, p_reason, p_idempotency_key)
  returning * into v_row;
  if p_new_occurred_at is not null then
    insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, corrects_id, correction_reason,
                                           idempotency_key, handover_child_guardian_id, handover_pickup_id)
    values (v_target.organization_id, v_target.child_id, v_target.kind, p_new_occurred_at, v_target.local_date, (select auth.uid()),
            private.attendance_source(p_source), v_target.id, p_reason, gen_random_uuid(),
            v_target.handover_child_guardian_id, v_target.handover_pickup_id);
  end if;
  if not private.attendance_sequence_ok(v_target.child_id, v_target.local_date) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return v_row.id;
end $$;
