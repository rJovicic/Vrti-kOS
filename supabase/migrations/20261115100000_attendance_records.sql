-- VrtićOS D3-A — attendance events (FS-05: FR-05-1…10; AC-05-1…8; SR-AUTHZ-12, SR-API-08; database-schema §5.14;
-- docs/architecture/d3-plan.md).
--
-- Model: append-only events per child. `check_in` / `check_out` record arrival and departure; `void` cancels an earlier
-- event (undo or correction) and references it. Nothing is ever updated or deleted; the original stays (FR-05-5).
--
-- Rules taken from the documents:
--   * educators record for children in `educator_child_ids()` (enrolled today in a group they are assigned to today)
--     and only for today (schema §5.14); managers (MFA) for any child of their kindergarten; guardians and the
--     platform admin never write;
--   * undo: the same recorder within 10 seconds, no reason (FR-05-5, AC-05-4);
--   * later correction: a reason category (`entry_error`, `forgot`, `other`); educators only for today, managers for
--     any past day (FR-05-10, AC-05-8, SR-AUTHZ-12); the original event stays;
--   * idempotency: unique `(organization_id, idempotency_key)`; a replay by the same person returns the stored event
--     (SR-API-08, AC-05-2, offline queue ADR-0012);
--   * no "all present" action (FR-05-6): every call records one child.
-- Technical decisions (documented in d3-plan §2):
--   * clients have no INSERT grant; all writes go through `api.*` invoker wrappers around `private.*` definer functions
--     that authorize first, lock the child for that day and validate (stricter than the schema sketch's direct insert);
--   * one sequence rule for every write path: per child and local day, the events that are not voided, ordered by
--     `occurred_at`, alternate `check_in`, `check_out`, `check_in`, … starting with `check_in`. A second arrival of a
--     present child, a departure of a child who has not arrived, or an offline replay that would break the order is
--     refused with ATTENDANCE_STATE_CONFLICT (two educators at once: the second gets the conflict and the app shows the
--     current state — FR-05-8). A return after departure is a new `check_in` (allowed by the sequence rule);
--   * the child must be enrolled on that local day (any group); a withdrawn child after the last day is not;
--   * handover columns exist (schema) but no RPC sets them until D-38 is decided (d3-plan §3, package D3-H).

create type public.attendance_kind as enum ('check_in', 'check_out', 'void');
create type public.attendance_correction_reason as enum ('entry_error', 'forgot', 'other');

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  kind public.attendance_kind not null,
  occurred_at timestamptz not null,
  local_date date not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('app', 'admin', 'offline_sync')),
  handover_child_guardian_id uuid,
  handover_pickup_id uuid,
  corrects_id uuid,
  correction_reason public.attendance_correction_reason,
  idempotency_key uuid not null,
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict,
  foreign key (organization_id, handover_child_guardian_id) references public.child_guardians (organization_id, id) on delete restrict,
  foreign key (organization_id, handover_pickup_id) references public.pickup_authorizations (organization_id, id) on delete restrict,
  foreign key (organization_id, corrects_id) references public.attendance_records (organization_id, id) on delete restrict,
  constraint attendance_one_handover check (num_nonnulls(handover_child_guardian_id, handover_pickup_id) <= 1),
  constraint attendance_void_needs_target check (kind <> 'void' or corrects_id is not null),
  constraint attendance_handover_only_on_events check (kind <> 'void' or num_nonnulls(handover_child_guardian_id, handover_pickup_id) = 0)
);
create index attendance_org_date_idx on public.attendance_records (organization_id, local_date);
create index attendance_child_date_idx on public.attendance_records (child_id, local_date);
create index attendance_corrects_idx on public.attendance_records (corrects_id) where corrects_id is not null;
comment on table public.attendance_records is
  'Dolazak/odlazak djeteta kao nepromjenjiv događaj; poništenja i ispravci su novi retci. Sensitivity R3.';

-- Append-only for every role (FR-05-5: the original event stays). Deletion is reserved for the retention job (R-53).
create function private.attendance_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'ATTENDANCE_APPEND_ONLY' using errcode = '42501';
end $$;
revoke execute on function private.attendance_append_only() from public, anon, authenticated;
create trigger attendance_records_no_update before update or delete on public.attendance_records
  for each row execute function private.attendance_append_only();

-- Audit: voids and corrections (FS-05 audit); ordinary events are themselves records with their actor.
create trigger attendance_records_audit after insert on public.attendance_records
  for each row when (new.kind = 'void' or new.correction_reason is not null)
  execute function private.audit_row();

-- Local calendar day of an instant in the kindergarten's time zone (mirrors org_today()).
create function private.org_local_date(p_org uuid, p_at timestamptz) returns date
language sql stable security definer set search_path = '' as $$
  select (p_at at time zone coalesce((select o.timezone from public.organizations o where o.id = p_org), 'Europe/Zagreb'))::date
$$;
revoke execute on function private.org_local_date(uuid, timestamptz) from public, anon;
grant execute on function private.org_local_date(uuid, timestamptz) to authenticated;

-- Events of a child and day that are not voided, in time order.
create function private.attendance_effective(p_child uuid, p_day date)
returns table (id uuid, kind public.attendance_kind, occurred_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.kind, a.occurred_at
  from public.attendance_records a
  where a.child_id = p_child and a.local_date = p_day and a.kind <> 'void'
    and not exists (select 1 from public.attendance_records v where v.kind = 'void' and v.corrects_id = a.id)
  -- Equal times: arrival before departure (the only valid order of a same-instant pair).
  order by a.occurred_at, (a.kind = 'check_out'), a.recorded_at
$$;
revoke execute on function private.attendance_effective(uuid, date) from public, anon, authenticated;

-- The sequence rule: effective events alternate check_in, check_out, … starting with check_in.
create function private.attendance_sequence_ok(p_child uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(bool_and(e.kind = case when e.n % 2 = 1 then 'check_in'::public.attendance_kind else 'check_out'::public.attendance_kind end), true)
  from (select x.kind, row_number() over (order by x.occurred_at, (x.kind = 'check_out')) as n from private.attendance_effective(p_child, p_day) x) e
$$;
revoke execute on function private.attendance_sequence_ok(uuid, date) from public, anon, authenticated;

-- Who may write for this child on this day. Raises PERMISSION_DENIED (same answer for unknown ids and other kindergartens).
-- Returns the organization. Managers: any child of the kindergarten. Educators: children in educator_child_ids(), today only.
create function private.attendance_authorize(p_child uuid, p_day date) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select c.organization_id into v_org from public.children c where c.id = p_child;
  if v_org is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if private.is_org_manager(v_org) then
    return v_org;
  end if;
  if p_child in (select private.educator_child_ids()) then
    if p_day <> private.org_today(v_org) then
      -- Past days are read-only for educators (FR-05-10); a manager corrects with a reason.
      raise exception 'ATTENDANCE_TIME_INVALID';
    end if;
    return v_org;
  end if;
  raise exception 'PERMISSION_DENIED' using errcode = '42501';
end $$;
revoke execute on function private.attendance_authorize(uuid, date) from public, anon, authenticated;

-- Serializes writers of one child and day (two educators, offline replay) for the rest of the transaction.
create function private.attendance_lock(p_child uuid, p_day date) returns void
language sql volatile security definer set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('vrticos.attendance:' || p_child::text || ':' || p_day::text, 0))
$$;
revoke execute on function private.attendance_lock(uuid, date) from public, anon, authenticated;

-- A replay of an idempotency key by the same person returns the stored row; anyone else's key is refused.
create function private.attendance_replay(p_org uuid, p_key uuid) returns public.attendance_records
language plpgsql stable security definer set search_path = '' as $$
declare
  v_row public.attendance_records;
begin
  select * into v_row from public.attendance_records a where a.organization_id = p_org and a.idempotency_key = p_key;
  if v_row.id is not null and v_row.recorded_by is distinct from (select auth.uid()) then
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  return v_row;
end $$;
revoke execute on function private.attendance_replay(uuid, uuid) from public, anon, authenticated;

create function private.attendance_source(p_source text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if p_source is null or p_source not in ('app', 'admin', 'offline_sync') then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  return p_source;
end $$;
revoke execute on function private.attendance_source(text) from public, anon, authenticated;

create function private.attendance_enrolled(p_child uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrollments e where e.child_id = p_child and e.valid_during @> p_day)
$$;
revoke execute on function private.attendance_enrolled(uuid, date) from public, anon, authenticated;

-- Record ------------------------------------------------------------------------------------------------------------
create function private.record_attendance(
  p_child_id uuid, p_kind public.attendance_kind, p_idempotency_key uuid, p_occurred_at timestamptz, p_source text
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
    if v_row.child_id <> p_child_id or v_row.kind <> p_kind then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select v_row.id, v_row.kind, v_row.occurred_at, true;
    return;
  end if;
  -- Ordinary events are for today; past days are added by a manager as a correction with a reason.
  if v_at > now() + interval '2 minutes' or v_day <> private.org_today(v_org) then
    raise exception 'ATTENDANCE_TIME_INVALID';
  end if;
  if not private.attendance_enrolled(p_child_id, v_day) then
    raise exception 'CHILD_NOT_ENROLLED';
  end if;
  perform private.attendance_lock(p_child_id, v_day);
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key)
  values (v_org, p_child_id, p_kind, v_at, v_day, (select auth.uid()), private.attendance_source(p_source), p_idempotency_key)
  returning * into v_row;
  if not private.attendance_sequence_ok(p_child_id, v_day) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return query select v_row.id, v_row.kind, v_row.occurred_at, false;
end $$;

-- Undo within 10 seconds (same recorder, no reason) ------------------------------------------------------------------
create function private.undo_attendance(p_record_id uuid, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.attendance_records;
  v_row public.attendance_records;
begin
  if p_record_id is null or p_idempotency_key is null then
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
  if v_target.kind = 'void' or v_target.recorded_by is distinct from (select auth.uid()) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if v_target.recorded_at < now() - interval '10 seconds' then
    raise exception 'ATTENDANCE_UNDO_EXPIRED';
  end if;
  perform private.attendance_lock(v_target.child_id, v_target.local_date);
  if exists (select 1 from public.attendance_records v where v.kind = 'void' and v.corrects_id = v_target.id) then
    raise exception 'ATTENDANCE_ALREADY_VOIDED';
  end if;
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, corrects_id, idempotency_key)
  values (v_target.organization_id, v_target.child_id, 'void', now(), v_target.local_date, (select auth.uid()), 'app', v_target.id, p_idempotency_key)
  returning * into v_row;
  if not private.attendance_sequence_ok(v_target.child_id, v_target.local_date) then
    -- e.g. undoing an arrival after a departure was recorded: the departure must be corrected first.
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return v_row.id;
end $$;

-- Correction with a reason: void an event, optionally replace it with the same kind at another time of that day ----
create function private.correct_attendance(
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
    insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, corrects_id, correction_reason, idempotency_key)
    values (v_target.organization_id, v_target.child_id, v_target.kind, p_new_occurred_at, v_target.local_date, (select auth.uid()),
            private.attendance_source(p_source), v_target.id, p_reason, gen_random_uuid());
  end if;
  if not private.attendance_sequence_ok(v_target.child_id, v_target.local_date) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return v_row.id;
end $$;

-- A missed event added later with a reason (e.g. a child not checked out — FS-05 edge case, corrected next day) -------
create function private.record_missed_attendance(
  p_child_id uuid, p_kind public.attendance_kind, p_occurred_at timestamptz, p_reason public.attendance_correction_reason,
  p_idempotency_key uuid, p_source text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_day date;
  v_row public.attendance_records;
begin
  if p_child_id is null or p_kind is null or p_kind = 'void' or p_occurred_at is null or p_reason is null or p_idempotency_key is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  v_day := private.org_local_date(v_org, p_occurred_at);
  v_org := private.attendance_authorize(p_child_id, v_day);
  v_row := private.attendance_replay(v_org, p_idempotency_key);
  if v_row.id is not null then
    return v_row.id;
  end if;
  if p_occurred_at > now() + interval '2 minutes' then
    raise exception 'ATTENDANCE_TIME_INVALID';
  end if;
  if not private.attendance_enrolled(p_child_id, v_day) then
    raise exception 'CHILD_NOT_ENROLLED';
  end if;
  perform private.attendance_lock(p_child_id, v_day);
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, correction_reason, idempotency_key)
  values (v_org, p_child_id, p_kind, p_occurred_at, v_day, (select auth.uid()), private.attendance_source(p_source), p_reason, p_idempotency_key)
  returning * into v_row;
  if not private.attendance_sequence_ok(p_child_id, v_day) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return v_row.id;
end $$;

revoke execute on function private.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text) from public, anon;
revoke execute on function private.undo_attendance(uuid, uuid) from public, anon;
revoke execute on function private.correct_attendance(uuid, public.attendance_correction_reason, timestamptz, uuid, text) from public, anon;
revoke execute on function private.record_missed_attendance(uuid, public.attendance_kind, timestamptz, public.attendance_correction_reason, uuid, text) from public, anon;
grant execute on function private.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text) to authenticated;
grant execute on function private.undo_attendance(uuid, uuid) to authenticated;
grant execute on function private.correct_attendance(uuid, public.attendance_correction_reason, timestamptz, uuid, text) to authenticated;
grant execute on function private.record_missed_attendance(uuid, public.attendance_kind, timestamptz, public.attendance_correction_reason, uuid, text) to authenticated;

-- Exposed wrappers (SECURITY INVOKER, SR-API-01) ---------------------------------------------------------------------
create function api.record_attendance(
  p_child_id uuid, p_kind public.attendance_kind, p_idempotency_key uuid, p_occurred_at timestamptz default null, p_source text default 'app'
) returns table (record_id uuid, kind public.attendance_kind, occurred_at timestamptz, replayed boolean)
language sql security invoker set search_path = '' as $$
  select * from private.record_attendance(p_child_id, p_kind, p_idempotency_key, p_occurred_at, p_source)
$$;
create function api.undo_attendance(p_record_id uuid, p_idempotency_key uuid) returns uuid
language sql security invoker set search_path = '' as $$
  select private.undo_attendance(p_record_id, p_idempotency_key)
$$;
create function api.correct_attendance(
  p_record_id uuid, p_reason public.attendance_correction_reason, p_idempotency_key uuid, p_new_occurred_at timestamptz default null, p_source text default 'app'
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.correct_attendance(p_record_id, p_reason, p_new_occurred_at, p_idempotency_key, p_source)
$$;
create function api.record_missed_attendance(
  p_child_id uuid, p_kind public.attendance_kind, p_occurred_at timestamptz, p_reason public.attendance_correction_reason,
  p_idempotency_key uuid, p_source text default 'admin'
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.record_missed_attendance(p_child_id, p_kind, p_occurred_at, p_reason, p_idempotency_key, p_source)
$$;
revoke execute on function api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text) from public, anon;
revoke execute on function api.undo_attendance(uuid, uuid) from public, anon;
revoke execute on function api.correct_attendance(uuid, public.attendance_correction_reason, uuid, timestamptz, text) from public, anon;
revoke execute on function api.record_missed_attendance(uuid, public.attendance_kind, timestamptz, public.attendance_correction_reason, uuid, text) from public, anon;
grant execute on function api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text) to authenticated;
grant execute on function api.undo_attendance(uuid, uuid) to authenticated;
grant execute on function api.correct_attendance(uuid, public.attendance_correction_reason, uuid, timestamptz, text) to authenticated;
grant execute on function api.record_missed_attendance(uuid, public.attendance_kind, timestamptz, public.attendance_correction_reason, uuid, text) to authenticated;

-- RLS: staff read; guardians read their child's status through the D3-C read model (no recorder), not this table ----
alter table public.attendance_records enable row level security;
create policy attendance_records_select on public.attendance_records for select to authenticated
  using ((select private.is_org_manager(organization_id)) or child_id in (select private.educator_child_ids()));
revoke all on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;
