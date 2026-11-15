-- D3-C: day status read model (migration 20261115120000_child_day_status.sql). FR-05-1/7/9, AC-05-6/7: statuses and
-- times; guardians today only and without staff data; restricted guardian and other families nothing; educators their
-- groups; managers by group and day; NEG-01/03/05/07/10. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d3c00000-0000-4000-8000-0000000000' || x)::uuid, 'st-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f3', 'f4', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd3c00000-%';
insert into private.platform_admins (profile_id) values ('d3c00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d3c00000-0000-4000-8000-00000000000a', 'Test Status A', 'test-st-a'),
  ('d3c00000-0000-4000-8000-00000000000b', 'Test Status B', 'test-st-b');
insert into public.facilities (id, organization_id, name) values ('d3c00000-0000-4000-8000-0000000000fa', 'd3c00000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d3c00000-0000-4000-8000-0000000000aa', 'd3c00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d3c00000-0000-4000-8000-000000000051', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000fa', 'd3c00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d3c00000-0000-4000-8000-000000000052', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000fa', 'd3c00000-0000-4000-8000-0000000000aa', 'S2');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d3c00000-0000-4000-8000-0000000001' || x)::uuid, ('d3c00000-0000-4000-8000-00000000000' || o)::uuid, ('d3c00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f3', 'a', 'guardian'), ('f4', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000001e1', 'd3c00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000001e2', 'd3c00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- S1: Ivo (present), Jan (departed), Kai (absence reported), Lin (expected); S2: Mak (present, absence reported too); Nika (no group).
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d3c00000-0000-4000-8000-0000000000' || x)::uuid, 'd3c00000-0000-4000-8000-00000000000a', n, 'Test', null
from (values ('d1', 'Ivo'), ('d2', 'Jan'), ('d3', 'Kai'), ('d4', 'Lin'), ('d5', 'Mak'), ('d6', 'Nika')) v(x, n);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
select 'd3c00000-0000-4000-8000-00000000000a', ('d3c00000-0000-4000-8000-0000000000' || c)::uuid, ('d3c00000-0000-4000-8000-0000000000' || g)::uuid, daterange(current_date - 30, null), null
from (values ('d1', '51'), ('d2', '51'), ('d3', '51'), ('d4', '51'), ('d5', '52')) v(c, g);
-- Guardians: Ana → Ivo and Nika; Cvita → Ivo (restricted); Dora → Mak.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d3c00000-0000-4000-8000-000000000a01', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000f1', 'Ana', 'S', null),
  ('d3c00000-0000-4000-8000-000000000a03', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000f3', 'Cvita', 'S', null),
  ('d3c00000-0000-4000-8000-000000000a04', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000f4', 'Dora', 'S', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d3c00000-0000-4000-8000-00000000c011', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000d1', 'd3c00000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d3c00000-0000-4000-8000-00000000c016', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000d6', 'd3c00000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d3c00000-0000-4000-8000-00000000c031', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000d1', 'd3c00000-0000-4000-8000-000000000a03', true, daterange(current_date - 30, null), null),
  ('d3c00000-0000-4000-8000-00000000c045', 'd3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000d5', 'd3c00000-0000-4000-8000-000000000a04', true, daterange(current_date - 30, null), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-00000000c031', daterange(current_date, null), null);
-- Events (as the owner): Ivo arrived 07:42-ish; Jan arrived and left; Mak arrived. Absences: Kai, Mak (late).
insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key)
select 'd3c00000-0000-4000-8000-00000000000a', ('d3c00000-0000-4000-8000-0000000000' || c)::uuid, k::public.attendance_kind,
       date_trunc('day', now() at time zone 'Europe/Zagreb') at time zone 'Europe/Zagreb' + t::interval, current_date, 'd3c00000-0000-4000-8000-0000000000e1', 'app', gen_random_uuid()
from (values ('d1', 'check_in', '07:42'), ('d2', 'check_in', '07:30'), ('d2', 'check_out', '08:10'), ('d5', 'check_in', '07:50'), ('d1', 'check_in', '00:00:00') ) v(c, k, t)
where t <> '00:00:00';
insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source, is_late) values
  ('d3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000d3', current_date, current_date + 1, 'd3c00000-0000-4000-8000-0000000000f1', 'guardian', false),
  ('d3c00000-0000-4000-8000-00000000000a', 'd3c00000-0000-4000-8000-0000000000d5', current_date, current_date, 'd3c00000-0000-4000-8000-0000000000f4', 'guardian', true);

create function pg_temp.login(uid text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d3c00000-0000-4000-8000-0000000000' || uid)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.view(p_day date default null, p_group uuid default null) returns text language sql as $$
  select coalesce(string_agg(c.first_name || '=' || s.status, ',' order by c.first_name), '')
  from api.child_day_status(p_day, p_group) s join public.children c on c.id = s.child_id
$$;
-- Guardians cannot read `children` of other families, but they can of their own; the helper joins as the caller.
grant execute on function pg_temp.view(date, uuid) to authenticated;

select ok(not has_function_privilege('anon', 'api.child_day_status(date, uuid)', 'EXECUTE'), 'anon cannot read statuses');
select ok(not (select prosecdef from pg_proc where oid = 'api.child_day_status(date, uuid)'::regprocedure), 'the exposed function is SECURITY INVOKER');
select is((select count(*)::int from pg_proc p, unnest(p.proargnames) a where p.oid = 'api.child_day_status(date, uuid)'::regprocedure and a ~* 'recorded_by|recorder|staff_name'), 0,
  'no recorder column exists in the read model');

-- Educator E1 (S1) ---------------------------------------------------------------------------------------------------
select pg_temp.login('e1');
select is(pg_temp.view(), 'Ivo=present,Jan=departed,Kai=absent,Lin=expected', 'E1 sees S1 with the four statuses (FR-05-1)');
select is((select to_char(arrived_at at time zone 'Europe/Zagreb', 'HH24:MI') from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d1'), '07:42', 'with the arrival time');
select is((select to_char(departed_at at time zone 'Europe/Zagreb', 'HH24:MI') from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d2'), '08:10', 'and the departure time');
select ok((select last_record_id is not null and last_record_kind = 'check_in' from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d1'), 'staff get the last event id for undo and correction');
select is((select count(*)::int from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d5'), 0, 'E1 does not see the S2 child (NEG-07)');
select is(pg_temp.view(current_date, 'd3c00000-0000-4000-8000-000000000052'), '', 'not even when asking for S2');
reset role;
select pg_temp.login('e2');
select is((select status || '/' || absence_reported || '/' || absence_is_late from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d5'), 'present/true/true',
  'a present child with a reported (late) absence shows both, for the confirmation (AC-05-7)');
reset role;

-- Manager -------------------------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select is(pg_temp.view(current_date, 'd3c00000-0000-4000-8000-000000000051'), 'Ivo=present,Jan=departed,Kai=absent,Lin=expected', 'the manager reads a group by day');
select is((select count(*)::int from api.child_day_status(current_date - 1, 'd3c00000-0000-4000-8000-000000000051') where status = 'expected'), 4, 'and past days (nothing recorded yesterday)');
select is((select status from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d6'), 'not_enrolled', 'a child without a group is not enrolled that day');
reset role;
select pg_temp.login('a1', 'aal1');
select is((select count(*)::int from api.child_day_status()), 0, 'without MFA nothing');
reset role;

-- Guardians (FR-05-9, AC-05-6) ---------------------------------------------------------------------------------------
select pg_temp.login('f1');
select is((select string_agg(status, ',' order by status) from api.child_day_status()), 'not_enrolled,present', 'Ana sees Ivo present and Nika without a group');
select is((select to_char(arrived_at at time zone 'Europe/Zagreb', 'HH24:MI') from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d1'), '07:42', '"U vrtiću od 7:42"');
select ok((select bool_and(last_record_id is null and last_record_kind is null) from api.child_day_status()), 'without any staff data');
select is((select count(*)::int from api.child_day_status(current_date - 1)), 0, 'guardians see today only');
select is((select count(*)::int from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d2'), 0, 'not another family''s child (NEG-03)');
reset role;
select pg_temp.login('f3');
select is((select count(*)::int from api.child_day_status()), 0, 'a restricted guardian sees nothing (NEG-05)');
reset role;
select pg_temp.login('f4');
select is((select status from api.child_day_status()), 'present', 'Dora sees Mak present');
reset role;

-- Others ------------------------------------------------------------------------------------------------------------------
select pg_temp.login('c1', 'aal2');
select is((select count(*)::int from api.child_day_status()), 0, 'the platform admin sees nothing (NEG-10)');
reset role;
select pg_temp.login('b1', 'aal2');
select is((select count(*)::int from api.child_day_status()), 0, 'another kindergarten sees nothing (NEG-01)');
reset role;
-- An undone arrival does not count.
insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, corrects_id, idempotency_key)
select organization_id, child_id, 'void', now(), current_date, recorded_by, 'app', id, gen_random_uuid()
from public.attendance_records where child_id = 'd3c00000-0000-4000-8000-0000000000d1';
select pg_temp.login('e1');
select is((select status from api.child_day_status() where child_id = 'd3c00000-0000-4000-8000-0000000000d1'), 'expected', 'after an undo the child is expected again');
reset role;

select * from finish();
rollback;
