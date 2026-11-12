-- VrtićOS D2-B — guardians and guardian–child links (FS-04: FR-04-4, FR-04-8, FR-04-9; docs/architecture/d2-plan.md).
-- A guardian is a person record of ONE kindergarten (no e-mail, phone or address: contact data lives only in
-- invitations / Auth). Access to a child comes ONLY from a link (child_guardians) that is valid today, with rights per
-- link. An accepted invitation or a guardian membership alone gives no access to any child.
-- D-31 (owner, 2026-11-12): an educator sees the first and last name of guardians of children currently enrolled in
-- groups they are assigned to today, and that guardian's rights for that child — nothing else.
-- D-32 (owner, 2026-11-12): a link does not require an enrolment; a linked child without a group is visible to its
-- guardian.
-- Access restrictions (D2-C) will be added to private.guardian_child_ids(); nothing else needs to change then.

create type public.guardian_status as enum ('active', 'ended');

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  -- Set only by the server when the invited person accepts (D2-F); never by a client.
  profile_id uuid references public.profiles (id) on delete restrict,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  status public.guardian_status not null default 'active',
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index guardians_profile_uq on public.guardians (organization_id, profile_id) where profile_id is not null;
create index guardians_profile_idx on public.guardians (profile_id) where profile_id is not null;
comment on table public.guardians is 'Skrbnik u vrtiću (ime i prezime; bez kontakata). Sensitivity R2.';

create table public.child_guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  guardian_id uuid not null,
  can_view boolean not null default true,
  can_report_absence boolean not null default false,
  receives_messages boolean not null default false,
  valid_during daterange not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict,
  foreign key (organization_id, guardian_id) references public.guardians (organization_id, id) on delete restrict,
  constraint child_guardians_not_empty check (not isempty(valid_during)),
  -- Acting for a child presupposes seeing it.
  constraint child_guardians_flags_need_view check (can_view or not (can_report_absence or receives_messages)),
  constraint child_guardians_no_overlap exclude using gist (child_id with =, guardian_id with =, valid_during with &&)
);
create index child_guardians_guardian_idx on public.child_guardians (guardian_id);
create index child_guardians_child_idx on public.child_guardians (child_id);
comment on table public.child_guardians is 'Veza skrbnik–dijete s pravima po vezi i valjanošću. Sensitivity R3.';

-- Guards: authorization first, then database-owned fields --------------------------------------------------------------
create function private.guard_guardians() returns trigger
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
    new.profile_id := null;
  elsif new.profile_id is distinct from old.profile_id or new.created_by is distinct from old.created_by then
    raise exception 'GUARDIAN_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  return new;
end $$;

create function private.guard_child_guardians() returns trigger
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
  elsif new.child_id is distinct from old.child_id or new.guardian_id is distinct from old.guardian_id
        or new.created_by is distinct from old.created_by then
    raise exception 'CHILD_GUARDIAN_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_guardians(), private.guard_child_guardians() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['guardians', 'child_guardians'] loop
    execute format('create trigger %I_guard before insert or update on public.%I for each row execute function private.guard_%I()', t, t, t);
    execute format('create trigger %I_tenant_guard before update on public.%I for each row execute function private.guard_tenant_columns()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
    execute format('create trigger %I_audit after insert or update on public.%I for each row execute function private.audit_row()', t, t);
  end loop;
end $$;

-- Helpers ------------------------------------------------------------------------------------------------------------
-- The caller's own guardian records: active record AND an active guardian membership in that kindergarten today.
create function private.own_guardian_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select g.id
  from public.guardians g
  where g.profile_id = (select auth.uid())
    and g.status = 'active'
    and exists (
      select 1 from public.memberships m
      where m.organization_id = g.organization_id and m.profile_id = g.profile_id and m.role = 'guardian'
        and m.status = 'active' and m.valid_during @> private.org_today(m.organization_id)
    )
$$;

-- Children the caller may act for as a guardian: link valid today with the requested right. Unknown rights give
-- nothing (fail closed). D2-C adds "and no active access restriction" here.
create function private.guardian_child_ids(p_flag text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select cg.child_id
  from public.child_guardians cg
  where cg.guardian_id in (select private.own_guardian_ids())
    and cg.valid_during @> private.org_today(cg.organization_id)
    and case p_flag
          when 'can_view' then cg.can_view
          when 'can_report_absence' then cg.can_report_absence
          when 'receives_messages' then cg.receives_messages
          else false
        end
$$;

-- Groups of the caller's viewable children today (FR-04-8: the guardian sees the child's current group).
create function private.guardian_group_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select e.group_id
  from public.enrollments e
  where e.child_id in (select private.guardian_child_ids('can_view'))
    and e.valid_during @> private.org_today(e.organization_id)
$$;

-- D-31: links (valid today, active guardian) of children the caller works with today as an educator.
create function private.educator_child_guardian_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select cg.id
  from public.child_guardians cg
  join public.guardians g on g.id = cg.guardian_id and g.organization_id = cg.organization_id
  where cg.child_id in (select private.educator_child_ids())
    and cg.valid_during @> private.org_today(cg.organization_id)
    and g.status = 'active'
$$;
create function private.educator_guardian_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select cg.guardian_id from public.child_guardians cg where cg.id in (select private.educator_child_guardian_ids())
$$;

revoke execute on function private.own_guardian_ids(), private.guardian_child_ids(text), private.guardian_group_ids(),
  private.educator_child_guardian_ids(), private.educator_guardian_ids() from public, anon;
grant execute on function private.own_guardian_ids(), private.guardian_child_ids(text), private.guardian_group_ids(),
  private.educator_child_guardian_ids(), private.educator_guardian_ids() to authenticated;

-- RLS --------------------------------------------------------------------------------------------------------------
alter table public.guardians enable row level security;
create policy guardians_select on public.guardians for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or id in (select private.own_guardian_ids())
    or id in (select private.educator_guardian_ids())
  );
create policy guardians_insert on public.guardians for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy guardians_update on public.guardians for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

alter table public.child_guardians enable row level security;
-- A guardian sees only their own links that are valid today — never another guardian's link to the same child.
create policy child_guardians_select on public.child_guardians for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (guardian_id in (select private.own_guardian_ids()) and valid_during @> private.org_today(organization_id))
    or id in (select private.educator_child_guardian_ids())
  );
create policy child_guardians_insert on public.child_guardians for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy child_guardians_update on public.child_guardians for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

-- Guardian visibility of the child, its current enrolment and group (FR-04-8). Other children of the group, their
-- guardians and the group size stay invisible (FR-04-9).
drop policy children_select on public.children;
create policy children_select on public.children for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or id in (select private.educator_child_ids())
    or id in (select private.guardian_child_ids('can_view'))
  );
drop policy enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (group_id in (select private.educator_group_ids()) and valid_during @> private.org_today(organization_id))
    or (child_id in (select private.guardian_child_ids('can_view')) and valid_during @> private.org_today(organization_id))
  );
drop policy groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or id in (select private.educator_group_ids())
    or id in (select private.guardian_group_ids())
  );

-- Grants: no DELETE; profile_id, created_by and tenant columns are neither client-writable nor (guardians) readable.
revoke all on public.guardians, public.child_guardians from anon, authenticated;
-- D-31 at column level: clients read only the name and status of a guardian record. The link to an Auth account
-- (profile_id) and the creator stay server-side for every client role (helpers are SECURITY DEFINER).
grant select (id, organization_id, first_name, last_name, status, created_at, updated_at) on public.guardians to authenticated;
grant select on public.child_guardians to authenticated;
grant insert (organization_id, first_name, last_name) on public.guardians to authenticated;
grant update (first_name, last_name, status) on public.guardians to authenticated;
grant insert (organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during)
  on public.child_guardians to authenticated;
grant update (can_view, can_report_absence, receives_messages, valid_during) on public.child_guardians to authenticated;
