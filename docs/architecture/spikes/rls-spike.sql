-- VrtićOS Phase 3 spike: validates core tenancy/RLS patterns on local Supabase.
-- NOT a migration. Synthetic data only. Run: psql "$DB_URL" -v ON_ERROR_STOP=1 -f rls-spike.sql
begin;
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.org_role as enum ('org_admin','director','educator','guardian');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Zagreb'
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  unique (organization_id, id)
);
create table public.children (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  first_name text not null, last_name text not null,
  unique (organization_id, id)
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid not null,
  role public.org_role not null,
  status text not null default 'active' check (status in ('active','suspended','ended')),
  unique (organization_id, profile_id, role)
);
create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid,
  full_name text not null,
  unique (organization_id, id)
);
create table public.child_guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  child_id uuid not null,
  guardian_id uuid not null,
  can_view boolean not null default true,
  can_report_absence boolean not null default true,
  valid_during daterange not null default daterange(current_date, null),
  foreign key (organization_id, child_id) references public.children(organization_id, id) on delete restrict,
  foreign key (organization_id, guardian_id) references public.guardians(organization_id, id) on delete restrict
);
create table public.access_restrictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  child_guardian_id uuid not null references public.child_guardians(id) on delete restrict,
  valid_during daterange not null default daterange(current_date, null)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  child_id uuid not null,
  group_id uuid not null,
  valid_during daterange not null,
  foreign key (organization_id, child_id) references public.children(organization_id, id) on delete restrict,
  foreign key (organization_id, group_id) references public.groups(organization_id, id) on delete restrict,
  exclude using gist (child_id with =, valid_during with &&)
);
create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  membership_id uuid not null references public.memberships(id) on delete restrict,
  group_id uuid not null,
  valid_during daterange not null,
  foreign key (organization_id, group_id) references public.groups(organization_id, id) on delete restrict
);
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  child_id uuid not null,
  kind text not null check (kind in ('check_in','check_out')),
  occurred_at timestamptz not null default now(),
  recorded_by uuid not null default auth.uid(),
  idempotency_key uuid not null,
  unique (organization_id, idempotency_key),
  foreign key (organization_id, child_id) references public.children(organization_id, id) on delete restrict
);

-- helpers ---------------------------------------------------------------
create function private.org_today(org uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone o.timezone)::date from public.organizations o where o.id = org $$;

create function private.has_org_role(org uuid, roles public.org_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.organization_id = org and m.profile_id = (select auth.uid())
      and m.status = 'active' and m.role = any (roles)) $$;

create function private.educator_child_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select e.child_id
  from public.memberships m
  join public.staff_assignments sa on sa.membership_id = m.id
  join public.enrollments e on e.group_id = sa.group_id and e.organization_id = sa.organization_id
  where m.profile_id = (select auth.uid()) and m.status = 'active' and m.role = 'educator'
    and sa.valid_during @> private.org_today(m.organization_id)
    and e.valid_during @> private.org_today(m.organization_id) $$;

create function private.guardian_child_ids(flag text default 'can_view') returns setof uuid
language sql stable security definer set search_path = '' as $$
  select cg.child_id
  from public.guardians g
  join public.memberships m on m.organization_id = g.organization_id and m.profile_id = g.profile_id
       and m.role = 'guardian' and m.status = 'active'
  join public.child_guardians cg on cg.guardian_id = g.id and cg.organization_id = g.organization_id
  where g.profile_id = (select auth.uid())
    and cg.valid_during @> private.org_today(g.organization_id)
    and case flag when 'can_view' then cg.can_view when 'can_report_absence' then cg.can_report_absence else false end
    and not exists (select 1 from public.access_restrictions ar
                    where ar.child_guardian_id = cg.id
                      and ar.valid_during @> private.org_today(g.organization_id)) $$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- RLS ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.groups enable row level security;
alter table public.children enable row level security;
alter table public.memberships enable row level security;
alter table public.guardians enable row level security;
alter table public.child_guardians enable row level security;
alter table public.access_restrictions enable row level security;
alter table public.enrollments enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.attendance_records enable row level security;

create policy children_select on public.children for select to authenticated using (
  (select private.has_org_role(organization_id, '{org_admin,director}'))
  or id in (select private.educator_child_ids())
  or id in (select private.guardian_child_ids('can_view')));

create policy children_admin_write on public.children for insert to authenticated
  with check ((select private.has_org_role(organization_id, '{org_admin,director}')));

create policy attendance_select on public.attendance_records for select to authenticated using (
  (select private.has_org_role(organization_id, '{org_admin,director}'))
  or child_id in (select private.educator_child_ids())
  or child_id in (select private.guardian_child_ids('can_view')));

create policy attendance_insert on public.attendance_records for insert to authenticated with check (
  recorded_by = (select auth.uid())
  and child_id in (select private.educator_child_ids()));

grant select, insert on public.children, public.attendance_records to authenticated;
revoke update, delete on public.attendance_records from authenticated;

-- synthetic world ---------------------------------------------------------
insert into public.organizations (id, name) values
 ('a0000000-0000-0000-0000-00000000000a','Vrtić Alfa'),
 ('b0000000-0000-0000-0000-00000000000b','Vrtić Beta');
insert into public.groups (id, organization_id, name) values
 ('a1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','S1'),
 ('a2000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','S2'),
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000b','B1');
insert into public.children (id, organization_id, first_name, last_name) values
 ('d1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','Dijete','D1'),
 ('d2000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','Dijete','D2'),
 ('d3000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-00000000000a','Dijete','D3'),
 ('d9000000-0000-0000-0000-000000000009','b0000000-0000-0000-0000-00000000000b','Dijete','D9');
insert into public.enrollments (organization_id, child_id, group_id, valid_during) values
 ('a0000000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001', daterange(current_date - 30, null)),
 ('a0000000-0000-0000-0000-00000000000a','d2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001', daterange(current_date - 30, null)),
 ('a0000000-0000-0000-0000-00000000000a','d3000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000002', daterange(current_date - 30, null)),
 ('b0000000-0000-0000-0000-00000000000b','d9000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000001', daterange(current_date - 30, null));
-- profiles: U1=...u1, E1=...e1, E3=...e3 (substitute yesterday only), G1=...g1, G2=...g2 (restricted)
insert into public.memberships (id, organization_id, profile_id, role) values
 ('11000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','org_admin'),
 ('11000000-0000-0000-0000-0000000000e1','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000e1','educator'),
 ('11000000-0000-0000-0000-0000000000e3','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000e3','educator'),
 ('11000000-0000-0000-0000-0000000000f1','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000f1','guardian'),
 ('11000000-0000-0000-0000-0000000000f2','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000f2','guardian');
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
 ('a0000000-0000-0000-0000-00000000000a','11000000-0000-0000-0000-0000000000e1','a1000000-0000-0000-0000-000000000001', daterange(current_date - 30, null)),
 ('a0000000-0000-0000-0000-00000000000a','11000000-0000-0000-0000-0000000000e3','a1000000-0000-0000-0000-000000000001', daterange(current_date - 1, current_date));
insert into public.guardians (id, organization_id, profile_id, full_name) values
 ('91000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000f1','Skrbnik G1'),
 ('92000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000f2','Skrbnik G2');
insert into public.child_guardians (id, organization_id, child_id, guardian_id) values
 ('c1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001'),
 ('c2000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002');
insert into public.access_restrictions (organization_id, child_guardian_id) values
 ('a0000000-0000-0000-0000-00000000000a','c2000000-0000-0000-0000-000000000002');

-- tests ---------------------------------------------------------------
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- NEG/positive checks
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check('U1 (Alfa admin) sees 3 Alfa children, 0 Beta', (select count(*) from public.children) = 3);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check('E1 sees only S1 children (D1, D2)', (select array_agg(last_name order by last_name) from public.children) = '{D1,D2}');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select pg_temp.check('E3 substitute ended yesterday sees nothing', (select count(*) from public.children) = 0);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check('G1 sees only D1', (select array_agg(last_name) from public.children) = '{D1}');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check('G2 with access restriction sees nothing', (select count(*) from public.children) = 0);
reset role;

-- educator can record attendance for own group child, not others
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into public.attendance_records (organization_id, child_id, kind, idempotency_key)
values ('a0000000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-000000000001','check_in', gen_random_uuid());
select pg_temp.check('E1 recorded check-in for D1', (select count(*) from public.attendance_records) = 1);
do $$ begin
  insert into public.attendance_records (organization_id, child_id, kind, idempotency_key)
  values ('a0000000-0000-0000-0000-00000000000a','d3000000-0000-0000-0000-000000000003','check_in', gen_random_uuid());
  raise exception 'FAIL: E1 inserted attendance for D3 (other group)';
exception when insufficient_privilege then raise notice 'PASS: E1 cannot record attendance for D3 (RLS)';
end $$;
do $$ begin
  insert into public.attendance_records (organization_id, child_id, kind, idempotency_key, recorded_by)
  values ('a0000000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-000000000001','check_out', gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1');
  raise exception 'FAIL: E1 spoofed recorded_by';
exception when insufficient_privilege then raise notice 'PASS: E1 cannot spoof recorded_by';
end $$;
do $$ begin
  update public.attendance_records set kind = 'check_out';
  raise exception 'FAIL: E1 updated attendance';
exception when insufficient_privilege then raise notice 'PASS: E1 cannot UPDATE attendance (no grant)';
end $$;
reset role;

-- cross-tenant link blocked by composite FK (even for superuser)
do $$ begin
  insert into public.enrollments (organization_id, child_id, group_id, valid_during)
  values ('a0000000-0000-0000-0000-00000000000a','d9000000-0000-0000-0000-000000000009','a1000000-0000-0000-0000-000000000001', daterange(current_date - 100, current_date - 50));
  raise exception 'FAIL: cross-tenant enrollment inserted';
exception when foreign_key_violation then raise notice 'PASS: composite FK blocks Beta child in Alfa group';
end $$;
-- overlapping enrollment blocked
do $$ begin
  insert into public.enrollments (organization_id, child_id, group_id, valid_during)
  values ('a0000000-0000-0000-0000-00000000000a','d1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', daterange(current_date, null));
  raise exception 'FAIL: overlapping enrollment inserted';
exception when exclusion_violation then raise notice 'PASS: exclusion constraint blocks overlapping enrollment';
end $$;
-- revocation: suspend E1 membership -> immediate loss of access
update public.memberships set status = 'suspended' where id = '11000000-0000-0000-0000-0000000000e1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check('E1 suspended: sees nothing on next query', (select count(*) from public.children) = 0);
reset role;
-- private helpers not callable by anon
select pg_temp.check('anon has no EXECUTE on private helper',
  not has_function_privilege('anon', 'private.educator_child_ids()', 'execute'));
-- catalog check: every public table has RLS
select pg_temp.check('all public tables have RLS enabled',
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));
rollback;
