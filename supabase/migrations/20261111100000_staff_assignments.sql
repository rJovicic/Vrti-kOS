-- VrtićOS D1 — staff assignments (FS-03) and educator access to groups.
-- Access is derived from assignments valid TODAY in the kindergarten's time zone (SR-AUTHZ-06, ADR-0005).

create type public.assignment_type as enum ('regular', 'substitute');

create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null,
  group_id uuid not null,
  assignment_type public.assignment_type not null default 'regular',
  valid_during daterange not null,
  approved_by uuid references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, membership_id) references public.memberships (organization_id, id) on delete restrict,
  foreign key (organization_id, group_id) references public.groups (organization_id, id) on delete restrict,
  constraint staff_assignments_not_empty check (not isempty(valid_during)),
  constraint staff_assignments_substitute_has_end check (assignment_type = 'regular' or not upper_inf(valid_during)),
  constraint staff_assignments_no_overlap exclude using gist (membership_id with =, group_id with =, valid_during with &&)
);
create index staff_assignments_membership_idx on public.staff_assignments (membership_id);
create index staff_assignments_group_idx on public.staff_assignments (group_id);
comment on table public.staff_assignments is 'Raspored djelatnika na skupinu (redovni ili zamjena). Sensitivity R2.';

-- Guard: only educator memberships can be assigned; substitutes record who approved them (the caller);
-- after insert only the validity may change (ending an assignment), never the person, group or type.
create function private.guard_staff_assignments() returns trigger
language plpgsql set search_path = '' as $$
declare v_role public.org_role;
begin
  -- Authorization first, so callers without rights always get permission_denied (not a data-shaped error).
  if current_user in ('authenticated', 'anon') and not private.is_org_manager(new.organization_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select m.role into v_role from public.memberships m where m.id = new.membership_id;
    if v_role is distinct from 'educator' then
      raise exception 'ASSIGNMENT_REQUIRES_EDUCATOR' using errcode = '23514';
    end if;
    if current_user in ('authenticated', 'anon') then
      new.created_by := (select auth.uid());
      new.approved_by := case when new.assignment_type = 'substitute' then (select auth.uid()) else null end;
    end if;
    if new.assignment_type = 'substitute' and new.approved_by is null then
      raise exception 'SUBSTITUTE_REQUIRES_APPROVER' using errcode = '23514';
    end if;
  elsif current_user in ('authenticated', 'anon') then
    if new.membership_id is distinct from old.membership_id or new.group_id is distinct from old.group_id
       or new.assignment_type is distinct from old.assignment_type or new.approved_by is distinct from old.approved_by
       or new.created_by is distinct from old.created_by then
      raise exception 'ASSIGNMENT_IMMUTABLE_COLUMNS' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger staff_assignments_guard before insert or update on public.staff_assignments
  for each row execute function private.guard_staff_assignments();
create trigger staff_assignments_tenant_guard before update on public.staff_assignments
  for each row execute function private.guard_tenant_columns();
create trigger staff_assignments_touch before update on public.staff_assignments
  for each row execute function private.touch_updated_at();
create trigger staff_assignments_audit after insert or update on public.staff_assignments
  for each row execute function private.audit_row();

-- Helpers -------------------------------------------------------------------------------------------
create function private.own_membership_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.memberships m where m.profile_id = (select auth.uid())
$$;

-- Groups the caller may work with today as an educator (active membership + assignment valid today).
create function private.educator_group_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct sa.group_id
  from public.memberships m
  join public.staff_assignments sa on sa.membership_id = m.id and sa.organization_id = m.organization_id
  where m.profile_id = (select auth.uid())
    and m.role = 'educator'
    and m.status = 'active'
    and m.valid_during @> private.org_today(m.organization_id)
    and sa.valid_during @> private.org_today(m.organization_id)
$$;

-- Extends D0 visibility: educators also see the names of staff (not guardians) of kindergartens where
-- they currently work. Guardian visibility of staff follows in D2 (needs enrollments).
create or replace function private.visible_profile_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.profile_id from public.memberships m
  where m.organization_id in (select private.managed_org_ids())
  union
  select m.profile_id from public.memberships m
  where m.role in ('org_admin', 'director', 'educator')
    and m.status = 'active'
    and m.valid_during @> private.org_today(m.organization_id)
    and m.organization_id in (
      select e.organization_id from public.memberships e
      where e.profile_id = (select auth.uid()) and e.role = 'educator' and e.status = 'active'
        and e.valid_during @> private.org_today(e.organization_id)
    )
$$;

revoke execute on function private.own_membership_ids(), private.educator_group_ids() from public, anon;
grant execute on function private.own_membership_ids(), private.educator_group_ids(), private.visible_profile_ids() to authenticated;
revoke execute on function private.guard_staff_assignments() from public, anon, authenticated;

-- RLS -----------------------------------------------------------------------------------------------
alter table public.staff_assignments enable row level security;

create policy staff_assignments_select on public.staff_assignments for select to authenticated
  using ((select private.is_org_manager(organization_id)) or membership_id in (select private.own_membership_ids()));
create policy staff_assignments_insert on public.staff_assignments for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy staff_assignments_update on public.staff_assignments for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

-- Educators see the groups they are assigned to today (D0 allowed managers only).
drop policy groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using ((select private.is_org_manager(organization_id)) or id in (select private.educator_group_ids()));

revoke all on public.staff_assignments from anon, authenticated;
grant select on public.staff_assignments to authenticated;
grant insert (organization_id, membership_id, group_id, assignment_type, valid_during) on public.staff_assignments to authenticated;
grant update (valid_during) on public.staff_assignments to authenticated;
