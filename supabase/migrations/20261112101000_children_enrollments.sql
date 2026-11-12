-- VrtićOS D2-A — children and enrolments (FS-04: FR-04-1…3, docs/architecture/d2-plan.md).
-- Minimum child data only (Q-P03): first name, last name, optional internal reference. No date of birth, OIB,
-- address, photo or health data. Security ships with the tables: RLS, grants, guards, audit, pgTAP 09.
-- Guardian visibility is added in D2-B together with the guardian tables; until then guardians see no child.

create type public.child_status as enum ('active', 'withdrawn');

create table public.children (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  internal_ref text check (char_length(internal_ref) between 1 and 40),
  status public.child_status not null default 'active',
  withdrawn_on date,
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint children_withdrawn_has_date check ((status = 'withdrawn') = (withdrawn_on is not null))
);
create unique index children_internal_ref_uq on public.children (organization_id, internal_ref) where internal_ref is not null;
create index children_name_idx on public.children (organization_id, last_name, first_name);
comment on table public.children is 'Dijete (minimalni skup: ime, prezime, interna oznaka). Sensitivity R3.';

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  group_id uuid not null,
  valid_during daterange not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict,
  foreign key (organization_id, group_id) references public.groups (organization_id, id) on delete restrict,
  constraint enrollments_not_empty check (not isempty(valid_during)),
  -- One group at a time per child (FR-04-2).
  constraint enrollments_no_overlap exclude using gist (child_id with =, valid_during with &&)
);
create index enrollments_group_idx on public.enrollments (group_id);
create index enrollments_child_idx on public.enrollments (child_id);
comment on table public.enrollments is 'Upis djeteta u skupinu s valjanošću; najviše jedan istodobno. Sensitivity R3.';

-- Guards -----------------------------------------------------------------------------------------------
-- Authorization first (callers without rights always get permission_denied), then database-owned fields.
create function private.guard_children() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not private.is_org_manager(new.organization_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.status := 'active';
    new.withdrawn_on := null;
  elsif new.created_by is distinct from old.created_by or new.status is distinct from old.status
        or new.withdrawn_on is distinct from old.withdrawn_on then
    -- Withdrawal is one transaction with closing the enrolment (api.withdraw_child, D2-E), never a bare update.
    raise exception 'CHILD_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  return new;
end $$;

create function private.guard_enrollments() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not private.is_org_manager(new.organization_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  elsif new.child_id is distinct from old.child_id or new.group_id is distinct from old.group_id
        or new.created_by is distinct from old.created_by then
    -- An enrolment is ended (valid_during) and a new one opened; the child or group of a row never changes.
    raise exception 'ENROLLMENT_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_children(), private.guard_enrollments() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['children', 'enrollments'] loop
    execute format('create trigger %I_guard before insert or update on public.%I for each row execute function private.guard_%I()', t, t, t);
    execute format('create trigger %I_tenant_guard before update on public.%I for each row execute function private.guard_tenant_columns()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('create trigger %I_audit after insert or update on public.%I for each row execute function private.audit_row()', t, t);
  end loop;
end $$;

-- Helper: children the caller may work with TODAY as an educator — enrolment valid today in a group the caller is
-- assigned to today (regular or substitute). Ends with the assignment, the enrolment or the membership (NEG-07/08).
create function private.educator_child_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select e.child_id
  from public.enrollments e
  where e.group_id in (select private.educator_group_ids())
    and e.valid_during @> private.org_today(e.organization_id)
$$;
revoke execute on function private.educator_child_ids() from public, anon;
grant execute on function private.educator_child_ids() to authenticated;

-- RLS --------------------------------------------------------------------------------------------------
alter table public.children enable row level security;
create policy children_select on public.children for select to authenticated
  using ((select private.is_org_manager(organization_id)) or id in (select private.educator_child_ids()));
create policy children_insert on public.children for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy children_update on public.children for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

alter table public.enrollments enable row level security;
-- Educators see only the current enrolments of their groups today — no history, no future, no other groups.
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (group_id in (select private.educator_group_ids()) and valid_during @> private.org_today(organization_id))
  );
create policy enrollments_insert on public.enrollments for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy enrollments_update on public.enrollments for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

-- Grants: no DELETE; status/withdrawal and created_by are not client-writable.
revoke all on public.children, public.enrollments from anon, authenticated;
grant select on public.children, public.enrollments to authenticated;
grant insert (organization_id, first_name, last_name, internal_ref) on public.children to authenticated;
grant update (first_name, last_name, internal_ref) on public.children to authenticated;
grant insert (organization_id, child_id, group_id, valid_during) on public.enrollments to authenticated;
grant update (valid_during) on public.enrollments to authenticated;
