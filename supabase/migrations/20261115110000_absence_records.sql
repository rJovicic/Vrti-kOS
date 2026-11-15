-- VrtićOS D3-B — absence reports (FS-06: FR-06-1…8; AC-06-1…6; database-schema §5.15; d3-plan §2).
--
-- Rules taken from the documents:
--   * a guardian with `can_report_absence` for the child (and no active restriction — guardian_child_ids is
--     restriction-aware) reports an inclusive date range; no reason and no free text (FR-06-2, Q-P16);
--   * at most 30 days ahead and at most 30 days long ([pretpostavka, Q-T14]; schema check);
--   * a guardian cancels days that have not passed; the history stays (FR-06-4, AC-06-4): a report that has not started
--     is cancelled as a whole; a started one keeps its past part active and the remainder becomes a cancelled row;
--   * readers: managers, educators of the child's group, guardians with `can_view` (FR-06-5/6);
--   * managers may record on behalf of a guardian (`staff_on_behalf`, FR-06-7, AC-06-5); educators may not (N-10/H-04
--     open → denied);
--   * a report for today after the kindergarten's cut-off (`organizations.absence_cutoff_local`, null = none) is marked
--     late and still accepted (FR-06-8, AC-06-6).
-- Technical decisions:
--   * writes only through `api.*` invoker wrappers around `private` definer functions (as D2-E, D3-A);
--   * the start date is today or later for everyone (reports are forward-looking; past days are history, D-36 spirit);
--   * active reports of one child may not overlap (ABSENCE_OVERLAP) — a second report for the same day adds nothing;
--   * educators read absences of children in `educator_child_ids()` (children of their groups today), the same scope as
--     all other child data (D-31); "assigned to the group in that period" for future transfers is not modelled;
--   * every insert and change is audited (actor role, columns, never values).

create table public.absence_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reported_by uuid not null references public.profiles (id) on delete restrict,
  source text not null check (source in ('guardian', 'staff_on_behalf')),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  is_late boolean not null default false,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancelled_at timestamptz,
  split_from uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict,
  foreign key (organization_id, split_from) references public.absence_records (organization_id, id) on delete restrict,
  constraint absence_dates check (starts_on <= ends_on and ends_on - starts_on <= 30),
  constraint absence_cancel_fields check ((status = 'cancelled') = (cancelled_by is not null and cancelled_at is not null)),
  constraint absence_no_overlap exclude using gist (child_id with =, daterange(starts_on, ends_on, '[]') with &&) where (status = 'active')
);
create index absence_org_start_idx on public.absence_records (organization_id, starts_on);
create index absence_child_start_idx on public.absence_records (child_id, starts_on);
comment on table public.absence_records is
  'Prijava izostanka (razdoblje, izvor, stanje). Bez razloga i slobodnog teksta. Sensitivity R3.';

create trigger absence_records_tenant_guard before update on public.absence_records
  for each row execute function private.guard_tenant_columns();
create trigger absence_records_touch before update on public.absence_records
  for each row execute function private.touch_updated_at();
create trigger absence_records_audit after insert or update on public.absence_records
  for each row execute function private.audit_row();

-- Validates the range for a new report in the kindergarten's calendar; returns whether it is late.
create function private.absence_check_range(p_org uuid, p_starts date, p_ends date) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := private.org_today(p_org);
  v_cutoff time;
  v_tz text;
begin
  if p_starts is null or p_ends is null or p_starts > p_ends or p_ends - p_starts > 30
     or p_starts < v_today or p_starts > v_today + 30 then
    raise exception 'ABSENCE_DATES_INVALID';
  end if;
  select o.absence_cutoff_local, o.timezone into v_cutoff, v_tz from public.organizations o where o.id = p_org;
  return p_starts = v_today and v_cutoff is not null and (now() at time zone v_tz)::time > v_cutoff;
end $$;
revoke execute on function private.absence_check_range(uuid, date, date) from public, anon, authenticated;

create function private.absence_insert(p_org uuid, p_child uuid, p_starts date, p_ends date, p_source text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_late boolean;
  v_id uuid;
begin
  v_late := private.absence_check_range(p_org, p_starts, p_ends);
  perform pg_advisory_xact_lock(hashtextextended('vrticos.absence:' || p_child::text, 0));
  if exists (select 1 from public.absence_records a where a.child_id = p_child and a.status = 'active'
              and daterange(a.starts_on, a.ends_on, '[]') && daterange(p_starts, p_ends, '[]')) then
    raise exception 'ABSENCE_OVERLAP';
  end if;
  insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source, is_late)
  values (p_org, p_child, p_starts, p_ends, (select auth.uid()), p_source, v_late)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function private.absence_insert(uuid, uuid, date, date, text) from public, anon, authenticated;

-- Guardian report ----------------------------------------------------------------------------------------------------
create function private.report_absence(p_child_id uuid, p_starts_on date, p_ends_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if p_child_id is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  -- Same answer for an unknown child, another family's child, a missing flag and an active restriction (NEG-03/04/05).
  if p_child_id not in (select private.guardian_child_ids('can_report_absence')) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  return private.absence_insert(v_org, p_child_id, p_starts_on, p_ends_on, 'guardian');
end $$;

-- Manager on behalf of a guardian (FR-06-7) -------------------------------------------------------------------------------
create function private.record_absence_on_behalf(p_child_id uuid, p_starts_on date, p_ends_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if p_child_id is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  if v_org is null or not private.is_org_manager(v_org) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return private.absence_insert(v_org, p_child_id, p_starts_on, p_ends_on, 'staff_on_behalf');
end $$;

-- Cancel the days that have not passed (FR-06-4, AC-06-4) ---------------------------------------------------------------
create function private.cancel_absence(p_absence_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.absence_records;
  v_today date;
  v_part uuid;
begin
  if p_absence_id is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select * into v_row from public.absence_records a where a.id = p_absence_id;
  -- The reporter (while still allowed to report for the child) or a manager; one answer for everyone else.
  if v_row.id is null or not (
       private.is_org_manager(v_row.organization_id)
       or (v_row.reported_by = (select auth.uid()) and v_row.child_id in (select private.guardian_child_ids('can_report_absence')))
     ) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('vrticos.absence:' || v_row.child_id::text, 0));
  select * into v_row from public.absence_records a where a.id = p_absence_id;
  if v_row.status <> 'active' then
    raise exception 'ABSENCE_ALREADY_CANCELLED';
  end if;
  v_today := private.org_today(v_row.organization_id);
  if v_row.ends_on < v_today then
    raise exception 'ABSENCE_ALREADY_PAST';
  end if;
  if v_row.starts_on >= v_today then
    update public.absence_records set status = 'cancelled', cancelled_by = (select auth.uid()), cancelled_at = now()
    where id = v_row.id;
    return v_row.id;
  end if;
  -- Started: the past part stays active; today and later become a cancelled row that points to the original.
  update public.absence_records set ends_on = v_today - 1 where id = v_row.id;
  insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source, status, is_late,
                                      cancelled_by, cancelled_at, split_from, created_at)
  values (v_row.organization_id, v_row.child_id, v_today, v_row.ends_on, v_row.reported_by, v_row.source, 'cancelled', false,
          (select auth.uid()), now(), v_row.id, v_row.created_at)
  returning id into v_part;
  return v_part;
end $$;

revoke execute on function private.report_absence(uuid, date, date) from public, anon;
revoke execute on function private.record_absence_on_behalf(uuid, date, date) from public, anon;
revoke execute on function private.cancel_absence(uuid) from public, anon;
grant execute on function private.report_absence(uuid, date, date) to authenticated;
grant execute on function private.record_absence_on_behalf(uuid, date, date) to authenticated;
grant execute on function private.cancel_absence(uuid) to authenticated;

create function api.report_absence(p_child_id uuid, p_starts_on date, p_ends_on date) returns uuid
language sql security invoker set search_path = '' as $$ select private.report_absence(p_child_id, p_starts_on, p_ends_on) $$;
create function api.record_absence_on_behalf(p_child_id uuid, p_starts_on date, p_ends_on date) returns uuid
language sql security invoker set search_path = '' as $$ select private.record_absence_on_behalf(p_child_id, p_starts_on, p_ends_on) $$;
create function api.cancel_absence(p_absence_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.cancel_absence(p_absence_id) $$;
revoke execute on function api.report_absence(uuid, date, date) from public, anon;
revoke execute on function api.record_absence_on_behalf(uuid, date, date) from public, anon;
revoke execute on function api.cancel_absence(uuid) from public, anon;
grant execute on function api.report_absence(uuid, date, date) to authenticated;
grant execute on function api.record_absence_on_behalf(uuid, date, date) to authenticated;
grant execute on function api.cancel_absence(uuid) to authenticated;

-- RLS ------------------------------------------------------------------------------------------------------------------
alter table public.absence_records enable row level security;
create policy absence_records_select on public.absence_records for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or child_id in (select private.educator_child_ids())
    or child_id in (select private.guardian_child_ids('can_view'))
  );
revoke all on public.absence_records from anon, authenticated;
grant select on public.absence_records to authenticated;
