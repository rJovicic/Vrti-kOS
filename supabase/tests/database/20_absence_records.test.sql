-- D3-B: absence reports (migration 20261115110000_absence_records.sql). FR-06-1…8, AC-06-1/3/4/5/6: guardians with
-- can_report_absence report a date range without reason or text; limits; no overlap; cancel days that have not passed
-- (whole or split, history kept); managers on behalf; educators read but do not record; who reads; late flag;
-- NEG-01/03/04/05/07/10. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d3b00000-0000-4000-8000-0000000000' || x)::uuid, 'abs-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f2', 'f3', 'f4', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd3b00000-%';
insert into private.platform_admins (profile_id) values ('d3b00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug, absence_cutoff_local) values
  ('d3b00000-0000-4000-8000-00000000000a', 'Test Izostanci A', 'test-abs-a', '00:00:01'),
  ('d3b00000-0000-4000-8000-00000000000b', 'Test Izostanci B', 'test-abs-b', null);
insert into public.facilities (id, organization_id, name) values
  ('d3b00000-0000-4000-8000-0000000000fa', 'd3b00000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d3b00000-0000-4000-8000-0000000000aa', 'd3b00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d3b00000-0000-4000-8000-000000000051', 'd3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000fa', 'd3b00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d3b00000-0000-4000-8000-000000000052', 'd3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000fa', 'd3b00000-0000-4000-8000-0000000000aa', 'S2');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d3b00000-0000-4000-8000-0000000001' || x)::uuid, ('d3b00000-0000-4000-8000-00000000000' || o)::uuid, ('d3b00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f2', 'a', 'guardian'),
             ('f3', 'a', 'guardian'), ('f4', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000001e1', 'd3b00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000001e2', 'd3b00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d3b00000-0000-4000-8000-0000000000d1', 'd3b00000-0000-4000-8000-00000000000a', 'Lea', 'Test', null),
  ('d3b00000-0000-4000-8000-0000000000d2', 'd3b00000-0000-4000-8000-00000000000a', 'Mia', 'Test', null),
  ('d3b00000-0000-4000-8000-0000000000db', 'd3b00000-0000-4000-8000-00000000000b', 'Beta', 'Test', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000d1', 'd3b00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000d2', 'd3b00000-0000-4000-8000-000000000052', daterange(current_date - 30, null), null);
-- Lea: Ana (all rights), Bruno (view only), Cvita (all rights, restricted). Mia: Dora (all rights).
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by)
select ('d3b00000-0000-4000-8000-000000000a0' || n)::uuid, 'd3b00000-0000-4000-8000-00000000000a', ('d3b00000-0000-4000-8000-0000000000f' || n)::uuid, nm, 'Skrbnik', null
from (values ('1', 'Ana'), ('2', 'Bruno'), ('3', 'Cvita'), ('4', 'Dora')) v(n, nm);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, valid_during, created_by) values
  ('d3b00000-0000-4000-8000-00000000c001', 'd3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000d1', 'd3b00000-0000-4000-8000-000000000a01', true, true, daterange(current_date - 30, null), null),
  ('d3b00000-0000-4000-8000-00000000c002', 'd3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000d1', 'd3b00000-0000-4000-8000-000000000a02', true, false, daterange(current_date - 30, null), null),
  ('d3b00000-0000-4000-8000-00000000c003', 'd3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000d1', 'd3b00000-0000-4000-8000-000000000a03', true, true, daterange(current_date - 30, null), null),
  ('d3b00000-0000-4000-8000-00000000c004', 'd3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-0000000000d2', 'd3b00000-0000-4000-8000-000000000a04', true, true, daterange(current_date - 30, null), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d3b00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-00000000c003', daterange(current_date, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d3b00000-0000-4000-8000-0000000000' || x)::uuid $$;
grant execute on function pg_temp.uid(text) to authenticated;
create function pg_temp.lea() returns text language sql as $$
  select coalesce(string_agg((starts_on - current_date) || '..' || (ends_on - current_date) || ':' || status, ' | ' order by starts_on, status), '')
  from public.absence_records where child_id = pg_temp.uid('d1')
$$;
grant execute on function pg_temp.lea() to authenticated;

-- Catalog ------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.absence_records'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('authenticated', 'public.absence_records', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients write only through the RPCs');
select ok(not has_table_privilege('anon', 'public.absence_records', 'SELECT'), 'anon reads nothing (NEG-15)');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'absence_records'
  and column_name ~* 'reason|note|comment|text|diagnos|illness|bolest'), 0, 'no reason and no free-text column (FR-06-2, Q-P16)');
select ok(not (select bool_or(prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api' and p.proname like '%absence%'),
  'the exposed absence RPCs are SECURITY INVOKER (SR-API-01)');

-- Guardian reports ---------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f1'));
select isnt(api.report_absence(pg_temp.uid('d1'), current_date + 1, current_date + 3), null, 'Ana reports Lea absent for three days (AC-06-1)');
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 3, current_date + 4)$$, 'P0001', 'ABSENCE_OVERLAP', 'an overlapping report is refused');
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 6, current_date + 5)$$, 'P0001', 'ABSENCE_DATES_INVALID', 'the end cannot be before the start');
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date - 1, current_date)$$, 'P0001', 'ABSENCE_DATES_INVALID', 'no report starting in the past');
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 31, current_date + 31)$$, 'P0001', 'ABSENCE_DATES_INVALID', 'at most 30 days ahead (Q-T14 assumption)');
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 5, current_date + 36)$$, 'P0001', 'ABSENCE_DATES_INVALID', 'at most 30 days long');
select throws_ok($$select api.report_absence(pg_temp.uid('d2'), current_date + 1, current_date + 1)$$, '42501', 'PERMISSION_DENIED', 'not for another family''s child (AC-06-3, NEG-03)');
select throws_ok($$select api.report_absence(pg_temp.uid('db'), current_date + 1, current_date + 1)$$, '42501', 'PERMISSION_DENIED', 'not for a child of another kindergarten (NEG-01)');
select throws_ok($$select api.record_absence_on_behalf(pg_temp.uid('d1'), current_date + 8, current_date + 8)$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot use the staff path');
select lives_ok($$select api.report_absence(pg_temp.uid('d1'), current_date, current_date)$$, 'Ana reports today');
reset role;
select is((select is_late from public.absence_records where child_id = pg_temp.uid('d1') and starts_on = current_date), true,
  'a report for today after the cut-off is marked late (FR-06-8, AC-06-6)');
select is((select is_late from public.absence_records where child_id = pg_temp.uid('d1') and starts_on = current_date + 1), false, 'a future report is not late');
select is((select reported_by::text || '/' || source from public.absence_records where child_id = pg_temp.uid('d1') and starts_on = current_date + 1),
  pg_temp.uid('f1')::text || '/guardian', 'reporter and source are set by the database');
select pg_temp.login(pg_temp.uid('f2'));
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 10, current_date + 10)$$, '42501', 'PERMISSION_DENIED', 'without can_report_absence no report (NEG-04, AC-06-x)');
select is(pg_temp.lea(), '0..0:active | 1..3:active', 'the other guardian with can_view sees the reports (FR-06-6, AC-06-6)');
reset role;
select pg_temp.login(pg_temp.uid('f3'));
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 10, current_date + 10)$$, '42501', 'PERMISSION_DENIED', 'a restricted guardian cannot report (NEG-05)');
select is(pg_temp.lea(), '', 'and sees nothing');
reset role;

-- Readers ----------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.lea(), '0..0:active | 1..3:active', 'the educator of Lea''s group sees the reports (FR-06-5)');
select throws_ok($$select api.report_absence(pg_temp.uid('d1'), current_date + 10, current_date + 10)$$, '42501', 'PERMISSION_DENIED', 'an educator does not report');
select throws_ok($$select api.record_absence_on_behalf(pg_temp.uid('d1'), current_date + 10, current_date + 10)$$, '42501', 'PERMISSION_DENIED', 'nor on behalf (N-10 open → denied)');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.lea(), '', 'an educator of another group sees nothing (NEG-07)');
reset role;
select pg_temp.login(pg_temp.uid('f4'));
select is(pg_temp.lea(), '', 'another family sees nothing (NEG-03)');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select is((select count(*)::int from public.absence_records), 0, 'the platform admin reads nothing (NEG-10)');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select is((select count(*)::int from public.absence_records), 0, 'another kindergarten''s manager reads nothing (NEG-01)');
select throws_ok($$select api.record_absence_on_behalf(pg_temp.uid('d1'), current_date + 8, current_date + 8)$$, '42501', 'PERMISSION_DENIED', 'nor records for it');
reset role;

-- Manager on behalf (FR-06-7, AC-06-5) -----------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select isnt(api.record_absence_on_behalf(pg_temp.uid('d2'), current_date + 2, current_date + 2), null, 'a manager records an absence on behalf of a guardian');
reset role;
select is((select source || '/' || reported_by from public.absence_records where child_id = pg_temp.uid('d2')), 'staff_on_behalf/' || pg_temp.uid('a1')::text, 'source "staff on behalf" and the manager as author');
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select throws_ok($$select api.record_absence_on_behalf(pg_temp.uid('d2'), current_date + 4, current_date + 4)$$, '42501', 'PERMISSION_DENIED', 'not without MFA');
reset role;

-- Cancel (FR-06-4, AC-06-4) -------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f2'));
select throws_ok($$select api.cancel_absence((select id from public.absence_records where child_id = pg_temp.uid('d1') and starts_on = current_date + 1))$$, '42501', 'PERMISSION_DENIED',
  'only the reporter or a manager cancels');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select lives_ok($$select api.cancel_absence((select id from public.absence_records where child_id = pg_temp.uid('d1') and starts_on = current_date + 1))$$, 'Ana cancels a report that has not started');
select throws_ok($$select api.cancel_absence((select id from public.absence_records where child_id = pg_temp.uid('d1') and starts_on = current_date + 1))$$, 'P0001', 'ABSENCE_ALREADY_CANCELLED', 'a report is cancelled once');
reset role;
select is(pg_temp.lea(), '0..0:active | 1..3:cancelled', 'the cancelled report stays as history');
-- A report that started three days ago (written as the owner) and runs two more days: cancelling splits it.
insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source)
values ('d3b00000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), current_date - 3, current_date + 1, pg_temp.uid('f4'), 'guardian');
select pg_temp.login(pg_temp.uid('f4'));
select lives_ok($$select api.cancel_absence((select id from public.absence_records where child_id = pg_temp.uid('d2') and starts_on = current_date - 3))$$, 'Dora cancels a report that has started');
reset role;
select is((select string_agg((starts_on - current_date) || '..' || (ends_on - current_date) || ':' || status, ' | ' order by starts_on, status) from public.absence_records
           where child_id = pg_temp.uid('d2') and source = 'guardian'), '-3..-1:active | 0..1:cancelled', 'the past part stays active, today and later are cancelled');
select ok((select split_from is not null from public.absence_records where child_id = pg_temp.uid('d2') and status = 'cancelled'), 'the cancelled part points to the original');
-- A report entirely in the past cannot be cancelled.
insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source)
values ('d3b00000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), current_date - 10, current_date - 8, pg_temp.uid('f4'), 'guardian');
select pg_temp.login(pg_temp.uid('f4'));
select throws_ok($$select api.cancel_absence((select id from public.absence_records where child_id = pg_temp.uid('d2') and starts_on = current_date - 10))$$, 'P0001', 'ABSENCE_ALREADY_PAST', 'past days are history');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.cancel_absence((select id from public.absence_records where child_id = pg_temp.uid('d2') and source = 'staff_on_behalf'))$$, 'a manager cancels any report of the kindergarten');
reset role;

-- No direct writes, audit ------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f1'));
select throws_ok($$update public.absence_records set ends_on = current_date + 20 where child_id = pg_temp.uid('d1')$$, '42501', null, 'no direct change');
reset role;
select ok((select count(*) from audit.audit_events where target_table = 'absence_records' and organization_id = 'd3b00000-0000-4000-8000-00000000000a'
           and actor_role in ('guardian', 'org_admin')) >= 6, 'reports, cancellations and the on-behalf entry are audited with the actor role');

select * from finish();
rollback;
