-- D3-I: the negative cases the D3 files 19–21 did not cover for attendance, absences and the day status.
--   NEG-02  one account that is a guardian in two kindergartens: statuses and absences stay per kindergarten, and a
--           restriction in one kindergarten does not affect the other;
--   NEG-08  a transfer during the day moves educator access on the next request: the old group's educator no longer
--           reads or records the child, the new group's educator continues from the same state;
--   NEG-09  a suspended membership records and reads nothing.
-- Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d3e00000-0000-4000-8000-0000000000' || x)::uuid, 'd3neg-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd3e00000-%';
insert into public.organizations (id, name, slug) values
  ('d3e00000-0000-4000-8000-00000000000a', 'Test NEG A', 'test-d3neg-a'),
  ('d3e00000-0000-4000-8000-00000000000b', 'Test NEG B', 'test-d3neg-b');
insert into public.facilities (id, organization_id, name) values
  ('d3e00000-0000-4000-8000-0000000000fa', 'd3e00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d3e00000-0000-4000-8000-0000000000fb', 'd3e00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d3e00000-0000-4000-8000-0000000000aa', 'd3e00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d3e00000-0000-4000-8000-0000000000bb', 'd3e00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d3e00000-0000-4000-8000-000000000051', 'd3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000000fa', 'd3e00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d3e00000-0000-4000-8000-000000000052', 'd3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000000fa', 'd3e00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d3e00000-0000-4000-8000-000000000061', 'd3e00000-0000-4000-8000-00000000000b', 'd3e00000-0000-4000-8000-0000000000fb', 'd3e00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d3e00000-0000-4000-8000-0000000001' || x)::uuid, ('d3e00000-0000-4000-8000-00000000000' || o)::uuid, ('d3e00000-0000-4000-8000-0000000000' || p)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'a1', 'org_admin'), ('e1', 'a', 'e1', 'educator'), ('e2', 'a', 'e2', 'educator'),
             ('fa', 'a', 'f1', 'guardian'), ('fb', 'b', 'f1', 'guardian')) v(x, o, p, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000001e1', 'd3e00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000001e2', 'd3e00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- CA in A (group S1), CB in B; the same account is the guardian of both, through one guardian record per kindergarten.
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d3e00000-0000-4000-8000-0000000000ca', 'd3e00000-0000-4000-8000-00000000000a', 'Ana', 'Alfa', null),
  ('d3e00000-0000-4000-8000-0000000000cb', 'd3e00000-0000-4000-8000-00000000000b', 'Bor', 'Beta', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000000ca', 'd3e00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d3e00000-0000-4000-8000-00000000000b', 'd3e00000-0000-4000-8000-0000000000cb', 'd3e00000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d3e00000-0000-4000-8000-000000000a01', 'd3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica', null),
  ('d3e00000-0000-4000-8000-000000000b01', 'd3e00000-0000-4000-8000-00000000000b', 'd3e00000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, valid_during, created_by) values
  ('d3e00000-0000-4000-8000-00000000c0aa', 'd3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-0000000000ca', 'd3e00000-0000-4000-8000-000000000a01', true, true, daterange(current_date - 30, null), null),
  ('d3e00000-0000-4000-8000-00000000c0bb', 'd3e00000-0000-4000-8000-00000000000b', 'd3e00000-0000-4000-8000-0000000000cb', 'd3e00000-0000-4000-8000-000000000b01', true, true, daterange(current_date - 30, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d3e00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.c(x text) returns uuid language sql as $$ select ('d3e00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.k(n int) returns uuid language sql as $$ select ('d3e00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- The children a caller sees in the day status, as 'Ana,Bor'.
create function pg_temp.status_children() returns text language sql as $$
  select coalesce(string_agg(c.first_name, ',' order by c.first_name), '')
  from api.child_day_status() s join public.children c on c.id = s.child_id
$$;
grant execute on function pg_temp.c(text), pg_temp.k(int), pg_temp.status_children() to authenticated;

-- NEG-02: one account, two kindergartens ------------------------------------------------------------------------------
select pg_temp.login('f1');
select is((select count(*)::int from api.child_day_status() where child_id in (pg_temp.c('ca'), pg_temp.c('cb'))), 2,
  'the person sees the day status of the linked child in each kindergarten');
select lives_ok($$select api.report_absence(pg_temp.c('ca'), current_date + 1, current_date + 1)$$, 'reports an absence in A');
select lives_ok($$select api.report_absence(pg_temp.c('cb'), current_date + 1, current_date + 1)$$, 'and in B');
select is((select count(*)::int from public.absence_records a join public.children c on c.id = a.child_id and c.organization_id = a.organization_id), 2,
  'each absence belongs to the kindergarten of its child, never mixed');
reset role;
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d3e00000-0000-4000-8000-00000000000a', 'd3e00000-0000-4000-8000-00000000c0aa', daterange(current_date, null), null);
select pg_temp.login('f1');
select is((select string_agg(s.child_id::text, ',') from api.child_day_status() s), pg_temp.c('cb')::text,
  'a restriction in A hides the A child''s status; the B child stays visible (NEG-05 per kindergarten)');
select throws_ok($$select api.report_absence(pg_temp.c('ca'), current_date + 2, current_date + 2)$$, '42501', 'PERMISSION_DENIED',
  'no absence report for the restricted A child');
select is((select string_agg(organization_id::text, ',') from public.absence_records), 'd3e00000-0000-4000-8000-00000000000b',
  'only B''s absences remain visible');
reset role;

-- NEG-08: transfer during the day -----------------------------------------------------------------------------------
select pg_temp.login('e1');
select lives_ok($$select * from api.record_attendance(pg_temp.c('ca'), 'check_in', pg_temp.k(1), now() - interval '1 minute')$$,
  'E1 (S1) records the arrival of CA');
reset role;
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.transfer_child(pg_temp.c('ca'), 'd3e00000-0000-4000-8000-000000000052', current_date)$$,
  'the manager transfers CA to S2 from today');
reset role;
select pg_temp.login('e1');
select is(pg_temp.status_children(), '', 'E1 no longer sees CA in the day status');
select throws_ok($$select * from api.record_attendance(pg_temp.c('ca'), 'check_out', pg_temp.k(2))$$, '42501', 'PERMISSION_DENIED',
  'E1 can no longer record CA');
select is((select count(*)::int from public.attendance_records where child_id = pg_temp.c('ca')), 0, 'nor read its events, including the own arrival');
select is((select count(*)::int from public.absence_records where child_id = pg_temp.c('ca')), 0, 'nor its absences');
reset role;
select pg_temp.login('e2');
select is((select status::text from api.child_day_status() where child_id = pg_temp.c('ca')), 'present',
  'E2 (S2) sees CA as present: the state follows the child, not the group');
select lives_ok($$select * from api.record_attendance(pg_temp.c('ca'), 'check_out', pg_temp.k(3))$$, 'E2 records the departure');
select is((select count(*)::int from public.absence_records where child_id = pg_temp.c('ca')), 1, 'and sees the reported absence');
reset role;

-- NEG-09: suspended membership --------------------------------------------------------------------------------------
update public.memberships set status = 'suspended' where id = 'd3e00000-0000-4000-8000-0000000001e2';
select pg_temp.login('e2');
select throws_ok($$select * from api.record_attendance(pg_temp.c('ca'), 'check_in', pg_temp.k(4))$$, '42501', 'PERMISSION_DENIED',
  'a suspended educator cannot record');
select is(pg_temp.status_children(), '', 'sees no status');
select is((select count(*)::int from public.attendance_records), 0, 'reads no events');
select is((select count(*)::int from public.absence_records), 0, 'and no absences');
reset role;

select * from finish();
rollback;
