-- Q-T22 (owner, 2026-11-19): cancelling a record entered today by mistake (migration
-- 20261119110000_same_day_cancellation.sql; locks in 20261119100000_child_event_lock.sql). Managers with MFA only;
-- only records starting today; refused when any dependent event exists (attendance, handover, absence, message,
-- restriction — mapped per record type); no deletion; audited; a cancelled record grants nothing and is frozen for
-- clients; D-37 unchanged. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'sd-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'a2', 'e1', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2200000-%';
insert into private.platform_admins (profile_id) values ('d2200000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d2200000-0000-4000-8000-00000000000a', 'Test Danas A', 'test-sd-a'),
  ('d2200000-0000-4000-8000-00000000000b', 'Test Danas B', 'test-sd-b');
insert into public.facilities (id, organization_id, name) values
  ('d2200000-0000-4000-8000-0000000000fa', 'd2200000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2200000-0000-4000-8000-0000000000aa', 'd2200000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2200000-0000-4000-8000-000000000051', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000fa', 'd2200000-0000-4000-8000-0000000000aa', 'S1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d2200000-0000-4000-8000-0000000001' || x)::uuid, ('d2200000-0000-4000-8000-00000000000' || o)::uuid, ('d2200000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('a2', 'a', 'director'), ('e1', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f2', 'a', 'guardian'),
             ('f3', 'a', 'guardian'), ('f4', 'a', 'guardian'), ('f5', 'a', 'guardian'), ('f6', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000001e1', 'd2200000-0000-4000-8000-000000000051', daterange(current_date - 30, null));
-- D1: enrolled since -30. D2…D5: enrolled TODAY (D2 clean; D3 gets attendance, D4 an absence, D5 a message).
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'd2200000-0000-4000-8000-00000000000a', 'Dijete', x, null from unnest(array['d1', 'd2', 'd3', 'd4', 'd5']) x;
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by)
select ('d2200000-0000-4000-8000-00000000e0' || right(x, 2))::uuid, 'd2200000-0000-4000-8000-00000000000a', ('d2200000-0000-4000-8000-0000000000' || x)::uuid,
       'd2200000-0000-4000-8000-000000000051', case when x = 'd1' then daterange(current_date - 30, null) else daterange(current_date, null) end, null
from unnest(array['d1', 'd2', 'd3', 'd4', 'd5']) x;
-- Guardians: G1 (F1) linked to D1 since -30; G2…G6 linked to D1 TODAY; G5 also linked to D5 since -30.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by)
select ('d2200000-0000-4000-8000-000000000a' || right(x, 1) || '0')::uuid, 'd2200000-0000-4000-8000-00000000000a', ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'Skrbnik', x, null
from unnest(array['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) x;
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d2200000-0000-4000-8000-00000000c010', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a10', true, true, true, daterange(current_date - 30, null), null),
  ('d2200000-0000-4000-8000-00000000c020', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a20', true, true, true, daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000c030', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a30', true, true, true, daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000c040', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a40', true, true, true, daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000c050', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a50', true, true, true, daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000c060', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a60', true, true, true, daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000c055', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d5', 'd2200000-0000-4000-8000-000000000a50', true, true, true, daterange(current_date - 30, null), null);
-- A restriction on G6's new link (L6).
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-00000000c060', daterange(current_date, null), null);
-- Pickups for D1: P1 today (clean), P2 today (will be used at handover), P3 since yesterday, P4 from tomorrow.
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d2200000-0000-4000-8000-00000000b001', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'Prva', 'Danas', daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000b002', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'Druga', 'Danas', daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000b003', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'Treca', 'Jucer', daterange(current_date - 1, null), null),
  ('d2200000-0000-4000-8000-00000000b004', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'Cetvrta', 'Sutra', daterange(current_date + 1, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.id(x text) returns uuid language sql as $$ select ('d2200000-0000-4000-8000-00000000' || x)::uuid $$;
create function pg_temp.c(x text) returns uuid language sql as $$ select ('d2200000-0000-4000-8000-0000000000' || x)::uuid $$;
grant execute on function pg_temp.id(text), pg_temp.c(text) to authenticated;

-- Catalog -----------------------------------------------------------------------------------------------------------------
select ok(not (select prosecdef from pg_proc where oid = 'api.cancel_same_day_record(text, uuid, public.cancellation_reason)'::regprocedure)
  and not has_function_privilege('anon', 'api.cancel_same_day_record(text, uuid, public.cancellation_reason)', 'EXECUTE'), 'invoker wrapper, not for anon (SR-API-01)');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'private'::regnamespace
           and p.proname in ('record_attendance', 'record_missed_attendance', 'report_absence', 'record_absence_on_behalf', 'send_message')
           and p.prosrc ~ 'perform private\.lock_child_events\('), 5, 'every writer of a dependent event takes the child lock first');
select ok(not has_column_privilege('authenticated', 'public.pickup_authorizations', 'cancelled_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.child_guardians', 'cancelled_at', 'INSERT')
  and not has_column_privilege('authenticated', 'public.enrollments', 'cancelled_period', 'UPDATE'), 'clients cannot write the cancellation columns');

-- Events that make records dependent (as their real actors) ---------------------------------------------------------------
select pg_temp.login('e1');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d1'), 'check_in', gen_random_uuid(), now() - interval '3 minutes', 'app', null, pg_temp.id('b002'))$$, 'P2 hands D1 over this morning');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d1'), 'check_out', gen_random_uuid(), now() - interval '2 minutes', 'app', pg_temp.id('c040'), null)$$, 'G4 (new link L4) picks D1 up');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d3'), 'check_in', gen_random_uuid(), now() - interval '1 minute', 'app', null, null)$$, 'D3 (enrolled today) arrives');
reset role;
select pg_temp.login('f3');
select lives_ok($$select api.report_absence(pg_temp.c('d1'), current_date + 1, current_date + 1)$$, 'G3 (new link L3) reports an absence today');
reset role;
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.record_absence_on_behalf(pg_temp.c('d4'), current_date + 2, current_date + 2)$$, 'an absence for D4 is recorded today');
reset role;
select pg_temp.login('f5');
select lives_ok($$select api.send_message(api.open_conversation(pg_temp.c('d5')), 'Pitanje o upisu')$$, 'G5 writes about D5 today (D5 enrolled today)');
reset role;

-- Who may cancel ----------------------------------------------------------------------------------------------------------
select pg_temp.login('e1');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, '42501', 'PERMISSION_DENIED', 'an educator cannot cancel');
reset role;
select pg_temp.login('f1');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot cancel');
reset role;
select pg_temp.login('a1');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot cancel');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, '42501', 'PERMISSION_DENIED', 'a manager of another kindergarten cannot cancel');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', gen_random_uuid(), 'entered_in_error')$$, '42501', 'PERMISSION_DENIED', 'an unknown id gets the same answer');
reset role;
select pg_temp.login('c1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, '42501', 'PERMISSION_DENIED', 'a platform admin cannot cancel');
reset role;
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('access_restriction', pg_temp.id('c060'), 'entered_in_error')$$, '22023', null, 'restrictions are not a cancellable record type');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), null)$$, '22023', null, 'a reason code is required');
reset role;

-- Only records starting today ---------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b003'), 'entered_in_error')$$, 'P0001', 'CANCEL_TODAY_ONLY', 'a record from yesterday stays protected');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d1'), 'entered_in_error')$$, 'P0001', 'CANCEL_TODAY_ONLY', 'an enrolment from earlier stays protected');
select throws_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c010'), 'entered_in_error')$$, 'P0001', 'CANCEL_TODAY_ONLY', 'a link from earlier stays protected');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b004'), 'entered_in_error')$$, 'P0001', 'CANCEL_TODAY_ONLY', 'a record from tomorrow goes through D-37, not here');

-- Dependencies, per record type -------------------------------------------------------------------------------------------
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b002'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'pickup: a handover depends on it');
select throws_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c040'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'link: a handover depends on it');
select throws_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c030'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'link: the guardian reported an absence through it');
select throws_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c060'), 'entered_in_error')$$, 'P0001', 'CANCEL_RECORD_REFERENCED', 'link: an access restriction refers to it');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d3'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'enrolment: an attendance record exists');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d4'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'enrolment: an absence was recorded');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d5'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'enrolment: a message was exchanged');
reset role;
select pg_temp.login('f5');
select lives_ok($$select api.send_message(api.open_conversation(pg_temp.c('d1')), 'Poruka preko nove veze')$$, 'G5 writes through the new link L5');
reset role;
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c050'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS', 'link: a message in that guardian''s conversation');
reset role;

-- Successful cancellations: no deletion, nothing granted any more -----------------------------------------------------------
select pg_temp.login('f2');
select is((select count(*)::int from public.children where id = pg_temp.c('d1')), 1, 'before: G2 sees D1 through the new link L2');
reset role;
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, 'an org_admin with MFA cancels P1 (no dependents)');
select lives_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d2'), 'entered_in_error')$$, 'and D2''s enrolment of today');
reset role;
select pg_temp.login('a2', 'aal2');
select lives_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c020'), 'entered_in_error')$$, 'a director with MFA cancels L2');
reset role;
select is((select count(*)::int from public.pickup_authorizations where id = pg_temp.id('b001')), 1, 'the pickup row still exists (no deletion)');
select is((select isempty(valid_during) and cancelled_at is not null and cancelled_period = daterange(current_date, null) from public.pickup_authorizations where id = pg_temp.id('b001')),
  true, 'it is marked cancelled, with the original period kept');
select is((select count(*)::int from public.enrollments where id = pg_temp.id('e0d2') and cancelled_at is not null), 1, 'the enrolment row is kept and marked');
select is((select string_agg(action || ':' || (details ->> 'record_type') || ':' || (details ->> 'reason') || ':' || (details ->> 'starts_on'), ',' order by id)
           from audit.audit_events where action = 'record.cancel_same_day' and organization_id = 'd2200000-0000-4000-8000-00000000000a'),
  'record.cancel_same_day:pickup_authorization:entered_in_error:' || current_date || ',record.cancel_same_day:enrollment:entered_in_error:' || current_date
  || ',record.cancel_same_day:child_guardian:entered_in_error:' || current_date, 'each cancellation is audited with type, reason and date only');
select pg_temp.login('f2');
select is((select count(*)::int from public.children where id = pg_temp.c('d1')), 0, 'after: G2 no longer sees D1');
reset role;
select pg_temp.login('e1');
select is((select count(*)::int from api.handover_candidates(pg_temp.c('d1')) where first_name = 'Prva'), 0, 'the cancelled pickup person is no longer offered at handover');
select throws_ok($$select * from api.record_attendance(pg_temp.c('d1'), 'check_in', gen_random_uuid(), now(), 'app', null, pg_temp.id('b001'))$$, 'P0001', 'HANDOVER_INVALID', 'nor accepted');
select is((select count(*)::int from public.children where id = pg_temp.c('d2')), 0, 'the educator no longer sees D2 (enrolment cancelled)');
reset role;

-- Cancelled records are final; the regular paths still behave ---------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, 'P0001', 'RECORD_ALREADY_CANCELLED', 'a record is cancelled once');
select throws_ok($$update public.pickup_authorizations set first_name = 'Nova' where id = pg_temp.id('b001')$$, 'P0001', 'RECORD_ALREADY_CANCELLED', 'a cancelled record is frozen for clients');
select throws_ok($$update public.child_guardians set valid_during = daterange(current_date, null) where id = pg_temp.id('c020')$$, 'P0001', 'RECORD_ALREADY_CANCELLED', 'and cannot be revived');
select throws_ok($$update public.pickup_authorizations set cancelled_at = now() where id = pg_temp.id('b002')$$, '42501', null, 'a client cannot mark a record cancelled itself');
select throws_ok($$update public.pickup_authorizations set valid_during = 'empty' where id = pg_temp.id('b002')$$, '23514', null, 'nor empty its period');
select lives_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during) values ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d1'), pg_temp.id('0a20'), true, daterange(current_date, null))$$,
  'the correct link can be entered again today (the cancelled one overlaps nothing)');
select lives_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b004'), 'plan_changed')$$, 'D-37 for tomorrow''s record is unchanged');
reset role;
select is((select count(*)::int from public.pickup_authorizations where id = pg_temp.id('b004')), 0, 'and still removes the not-yet-effective record, as approved for D-37');
select is((select count(*)::int from public.attendance_records where child_id in (pg_temp.c('d1'), pg_temp.c('d3'))), 3, 'no attendance record was touched');
select is((select count(*)::int from public.absence_records where child_id in (pg_temp.c('d1'), pg_temp.c('d4'))), 2, 'no absence record was touched');
select is((select count(*)::int from public.messages where organization_id = 'd2200000-0000-4000-8000-00000000000a'), 2, 'no message was touched');
select is((select count(*)::int from public.pickup_authorizations where id = pg_temp.id('b002') and cancelled_at is null), 1, 'the refused pickup is unchanged');

-- Correction 2026-11-19 (migration 20261119130000): an absence depends on a record through the days it covers, not
-- only through the day it was reported. Own data; earlier assertions above are unchanged.
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'sd-' || x || '@t.test', 'authenticated', 'authenticated', now() from unnest(array['f7', 'f8']) x;
insert into public.profiles (id, first_name, last_name) select id, 'Racun', split_part(email, '@', 1) from auth.users where email in ('sd-f7@t.test', 'sd-f8@t.test');
insert into public.memberships (organization_id, profile_id, role, valid_during)
select 'd2200000-0000-4000-8000-00000000000a', ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'guardian', daterange(current_date - 30, null) from unnest(array['f7', 'f8']) x;
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d2200000-0000-4000-8000-0000000000' || x)::uuid, 'd2200000-0000-4000-8000-00000000000a', 'Dijete', x, null from unnest(array['d6', 'd7', 'd8', 'd9']) x;
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by)
select ('d2200000-0000-4000-8000-00000000e0' || x)::uuid, 'd2200000-0000-4000-8000-00000000000a', ('d2200000-0000-4000-8000-0000000000' || x)::uuid,
       'd2200000-0000-4000-8000-000000000051', daterange(current_date, null), null from unnest(array['d6', 'd7', 'd8', 'd9']) x;
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2200000-0000-4000-8000-000000000a70', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000f7', 'Skrbnik', 'f7', null),
  ('d2200000-0000-4000-8000-000000000a80', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000f8', 'Skrbnik', 'f8', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, valid_during, created_by) values
  ('d2200000-0000-4000-8000-00000000c070', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a70', true, true, daterange(current_date, null), null),
  ('d2200000-0000-4000-8000-00000000c080', 'd2200000-0000-4000-8000-00000000000a', 'd2200000-0000-4000-8000-0000000000d1', 'd2200000-0000-4000-8000-000000000a80', true, true, daterange(current_date, null), null);
-- Absences as they were recorded on earlier days (created_at in the past).
insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source, status, cancelled_by, cancelled_at, created_at) values
  ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d6'), current_date, current_date + 1, 'd2200000-0000-4000-8000-0000000000a1', 'staff_on_behalf', 'active', null, null, now() - interval '1 day'),
  ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d7'), current_date - 5, current_date - 2, 'd2200000-0000-4000-8000-0000000000a1', 'staff_on_behalf', 'active', null, null, now() - interval '10 days'),
  ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d8'), current_date + 3, current_date + 4, 'd2200000-0000-4000-8000-0000000000a1', 'staff_on_behalf', 'active', null, null, now() - interval '1 day'),
  ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d9'), current_date, current_date, 'd2200000-0000-4000-8000-0000000000a1', 'staff_on_behalf', 'cancelled', 'd2200000-0000-4000-8000-0000000000a1', now() - interval '1 day', now() - interval '2 days'),
  ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d1'), current_date + 5, current_date + 6, 'd2200000-0000-4000-8000-0000000000f7', 'guardian', 'active', null, null, now() - interval '1 day'),
  ('d2200000-0000-4000-8000-00000000000a', pg_temp.c('d1'), current_date - 9, current_date - 8, 'd2200000-0000-4000-8000-0000000000f8', 'guardian', 'active', null, null, now() - interval '12 days');
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d6'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS',
  'enrolment: an absence reported yesterday that covers today is a dependency');
select lives_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d7'), 'entered_in_error')$$,
  'enrolment: an absence reported earlier that ended before today is not');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d8'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS',
  'enrolment: an absence reported earlier for future days only is a dependency');
select throws_ok($$select api.cancel_same_day_record('enrollment', pg_temp.id('e0d9'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS',
  'enrolment: a cancelled absence for today is recorded history and counts too');
select throws_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c070'), 'entered_in_error')$$, 'P0001', 'RECORD_HAS_DEPENDENTS',
  'link: the same guardian reported earlier an absence covering days from today on');
select lives_ok($$select api.cancel_same_day_record('child_guardian', pg_temp.id('c080'), 'entered_in_error')$$,
  'link: an earlier absence of that guardian that ended before today does not block');
reset role;
select is((select count(*)::int from public.absence_records where child_id in (pg_temp.c('d1'), pg_temp.c('d6'), pg_temp.c('d7'), pg_temp.c('d8'), pg_temp.c('d9'))), 7,
  'no absence record was touched by any of these cancellations');

select * from finish();
rollback;
