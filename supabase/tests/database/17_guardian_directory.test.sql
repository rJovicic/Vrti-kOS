-- D2-G: guardian_directory (migration 20261112160000_guardian_directory.sql). Managers learn only whether a guardian
-- record is attached to an account; nobody learns which account; non-managers get null; rows follow guardians RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2a00000-0000-4000-8000-0000000000' || x)::uuid, 'gd-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'f1', 'b1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2a00000-%';
insert into public.organizations (id, name, slug) values
  ('d2a00000-0000-4000-8000-00000000000a', 'Test Imenik A', 'test-gd-a'),
  ('d2a00000-0000-4000-8000-00000000000b', 'Test Imenik B', 'test-gd-b');
insert into public.facilities (id, organization_id, name) values ('d2a00000-0000-4000-8000-0000000000fa', 'd2a00000-0000-4000-8000-00000000000a', 'Objekt');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2a00000-0000-4000-8000-0000000000aa', 'd2a00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2a00000-0000-4000-8000-000000000051', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000fa', 'd2a00000-0000-4000-8000-0000000000aa', 'S1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d2a00000-0000-4000-8000-0000000001' || x)::uuid, ('d2a00000-0000-4000-8000-00000000000' || o)::uuid, ('d2a00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('f1', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000001e1', 'd2a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2a00000-0000-4000-8000-0000000000d1', 'd2a00000-0000-4000-8000-00000000000a', 'Lea', 'Test', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d1', 'd2a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2a00000-0000-4000-8000-000000000a01', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000f1', 'Ana', 'Racun', null),
  ('d2a00000-0000-4000-8000-000000000a02', 'd2a00000-0000-4000-8000-00000000000a', null, 'Bruno', 'Bezracuna', null);
insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during, created_by)
select 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d1', g, true, daterange(current_date - 30, null), null
from unnest(array['d2a00000-0000-4000-8000-000000000a01', 'd2a00000-0000-4000-8000-000000000a02']::uuid[]) g;

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.dir() returns text language sql as $$
  select coalesce(string_agg(first_name || '=' || coalesce(has_account::text, 'null'), ',' order by first_name), '') from public.guardian_directory
$$;
grant execute on function pg_temp.dir() to authenticated;

select ok(not has_table_privilege('anon', 'public.guardian_directory', 'SELECT'), 'anon reads nothing');
select ok(not has_table_privilege('authenticated', 'public.guardian_directory', 'INSERT,UPDATE,DELETE'), 'the view is read-only');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'guardian_directory' and column_name in ('profile_id', 'created_by')), 0,
  'the view exposes neither the account nor the author');
select pg_temp.login('d2a00000-0000-4000-8000-0000000000a1', 'aal2');
select is(pg_temp.dir(), 'Ana=true,Bruno=false', 'a manager sees whether each record has an account');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000a1', 'aal1');
select is(pg_temp.dir(), '', 'a manager without MFA sees nothing');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e1');
select is(pg_temp.dir(), 'Ana=null,Bruno=null', 'an educator sees the D-31 names but not the account state');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000f1');
select is(pg_temp.dir(), 'Ana=null', 'a guardian sees only their own record, without the account state');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000b1', 'aal2');
select is(pg_temp.dir(), '', 'another kindergarten''s manager sees nothing');
select is(private.guardian_has_account('d2a00000-0000-4000-8000-000000000a01'), null, 'the helper does not answer for another kindergarten');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e1');
select is(private.guardian_has_account('d2a00000-0000-4000-8000-000000000a02'), null, 'nor for an educator calling it directly');
reset role;

select * from finish();
rollback;
