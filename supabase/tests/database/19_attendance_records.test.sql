-- D3-A: attendance events (migration 20261115100000_attendance_records.sql). FR-05-1…10, AC-05-2/4/8, SR-AUTHZ-12,
-- SR-API-08: who may record, today only for educators, idempotency, the arrival → departure order, undo within
-- 10 s by the recorder, corrections with a reason keeping the original, append-only, audit, NEG-01/03/07/08/10.
-- Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d3a00000-0000-4000-8000-0000000000' || x)::uuid, 'att-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd3a00000-%';
insert into private.platform_admins (profile_id) values ('d3a00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d3a00000-0000-4000-8000-00000000000a', 'Test Dolasci A', 'test-att-a'),
  ('d3a00000-0000-4000-8000-00000000000b', 'Test Dolasci B', 'test-att-b');
insert into public.facilities (id, organization_id, name) values
  ('d3a00000-0000-4000-8000-0000000000fa', 'd3a00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d3a00000-0000-4000-8000-0000000000fb', 'd3a00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d3a00000-0000-4000-8000-0000000000aa', 'd3a00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d3a00000-0000-4000-8000-0000000000bb', 'd3a00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d3a00000-0000-4000-8000-000000000051', 'd3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-0000000000fa', 'd3a00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d3a00000-0000-4000-8000-000000000052', 'd3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-0000000000fa', 'd3a00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d3a00000-0000-4000-8000-000000000061', 'd3a00000-0000-4000-8000-00000000000b', 'd3a00000-0000-4000-8000-0000000000fb', 'd3a00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d3a00000-0000-4000-8000-0000000001' || x)::uuid, ('d3a00000-0000-4000-8000-00000000000' || o)::uuid, ('d3a00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (id, organization_id, membership_id, group_id, valid_during) values
  ('d3a00000-0000-4000-8000-00000000a5e1', 'd3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-0000000001e1', 'd3a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d3a00000-0000-4000-8000-00000000a5e2', 'd3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-0000000001e2', 'd3a00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- D1, D2 in S1; D3 in S2; D4 left S1 yesterday (not enrolled today); DB in B.
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d3a00000-0000-4000-8000-0000000000' || x)::uuid, ('d3a00000-0000-4000-8000-00000000000' || o)::uuid, n, 'Test', null
from (values ('d1', 'a', 'Ivo'), ('d2', 'a', 'Jan'), ('d3', 'a', 'Kai'), ('d4', 'a', 'Lin'), ('db', 'b', 'Beta')) v(x, o, n);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
select ('d3a00000-0000-4000-8000-00000000000' || o)::uuid, ('d3a00000-0000-4000-8000-0000000000' || c)::uuid, ('d3a00000-0000-4000-8000-0000000000' || g)::uuid, r, null
from (values ('a', 'd1', '51', daterange(current_date - 30, null)), ('a', 'd2', '51', daterange(current_date - 30, null)),
             ('a', 'd3', '52', daterange(current_date - 30, null)), ('a', 'd4', '51', daterange(current_date - 30, current_date)),
             ('b', 'db', '61', daterange(current_date - 30, null))) v(o, c, g, r);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d3a00000-0000-4000-8000-000000000a01', 'd3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null);
insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, can_report_absence, valid_during, created_by) values
  ('d3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-0000000000d1', 'd3a00000-0000-4000-8000-000000000a01', true, true, daterange(current_date - 30, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d3a00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.k(n int) returns uuid language sql as $$ select ('d3a00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
grant execute on function pg_temp.uid(text), pg_temp.k(int) to authenticated;
-- Effective (not voided) events of a child today as text, e.g. 'check_in,check_out'.
create function pg_temp.seq(c text) returns text language sql as $$
  select coalesce(string_agg(kind::text, ',' order by occurred_at, (kind = 'check_out')), '') from private.attendance_effective(pg_temp.uid(c), current_date)
$$;
-- Today, a given number of minutes ago, always inside today (tests run at any hour).
create function pg_temp.ago(m int) returns timestamptz language sql as $$
  -- m minutes ago, but never before the kindergarten's local midnight: early in the day the times are scaled into the
  -- part of today that has passed, keeping their order (larger m = earlier). Valid for m < 1000.
  select greatest(now() - make_interval(mins => m),
                  date_trunc('day', now() at time zone 'Europe/Zagreb') at time zone 'Europe/Zagreb'
                  + (now() - date_trunc('day', now() at time zone 'Europe/Zagreb') at time zone 'Europe/Zagreb') * ((1000 - m) / 1000.0))
$$;
grant execute on function pg_temp.ago(int) to authenticated;

-- Catalog ------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.attendance_records'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('authenticated', 'public.attendance_records', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients write only through the RPCs');
select ok(not has_table_privilege('anon', 'public.attendance_records', 'SELECT'), 'anon reads nothing (NEG-15)');
select ok(not (select bool_or(prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api' and p.proname like '%attendance%'),
  'the exposed attendance RPCs are SECURITY INVOKER (SR-API-01)');
select ok(not has_function_privilege('anon', 'api.record_attendance(uuid, public.attendance_kind, uuid, timestamptz, text, uuid, uuid)', 'EXECUTE'), 'anon cannot record');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'attendance_records'
  and column_name ~* 'note|comment|text|reason_text|name'), 0, 'no free-text column');

-- Educator E1 (S1) ---------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select is((select replayed from api.record_attendance(pg_temp.uid('d1'), 'check_in', pg_temp.k(1), pg_temp.ago(120))), false, 'E1 records the arrival of D1');
select is((select replayed from api.record_attendance(pg_temp.uid('d1'), 'check_in', pg_temp.k(1), pg_temp.ago(120))), true, 'the same key again is a replay (AC-05-2)');
reset role;
select is((select count(*)::int from public.attendance_records where child_id = pg_temp.uid('d1')), 1, 'exactly one event is stored for the replayed key');
select is((select recorded_by::text || '/' || source || '/' || (local_date = current_date)::text from public.attendance_records where idempotency_key = pg_temp.k(1)),
  pg_temp.uid('e1')::text || '/app/true', 'recorder, source and local date are set by the database');
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d2'), 'check_in', pg_temp.k(1))$$, 'P0001', 'IDEMPOTENCY_KEY_REUSED', 'a key cannot be reused for another child');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d1'), 'check_in', pg_temp.k(2), pg_temp.ago(110))$$, 'P0001', 'ATTENDANCE_STATE_CONFLICT', 'a present child cannot arrive twice (double entry, two educators)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d2'), 'check_out', pg_temp.k(3))$$, 'P0001', 'ATTENDANCE_STATE_CONFLICT', 'a child who has not arrived cannot leave');
select lives_ok($$select * from api.record_attendance(pg_temp.uid('d1'), 'check_out', pg_temp.k(4), pg_temp.ago(60))$$, 'E1 records the departure');
select lives_ok($$select * from api.record_attendance(pg_temp.uid('d1'), 'check_in', pg_temp.k(5), pg_temp.ago(30))$$, 'a child who returns arrives again');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d1'), 'check_out', pg_temp.k(6), pg_temp.ago(45))$$, 'P0001', 'ATTENDANCE_STATE_CONFLICT',
  'a late replay that would break the order by occurred_at is refused (FR-05-8)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d3'), 'check_in', pg_temp.k(7))$$, '42501', 'PERMISSION_DENIED', 'E1 cannot record a child of another group (NEG-07)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('db'), 'check_in', pg_temp.k(8))$$, '42501', 'PERMISSION_DENIED', 'nor a child of another kindergarten (NEG-01)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d4'), 'check_in', pg_temp.k(9))$$, '42501', 'PERMISSION_DENIED', 'nor a child who left the group (NEG-08)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d2'), 'check_in', pg_temp.k(10), now() - interval '1 day')$$, 'P0001', 'ATTENDANCE_TIME_INVALID', 'educators do not record past days (FR-05-10)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d2'), 'check_in', pg_temp.k(11), now() + interval '1 hour')$$, 'P0001', 'ATTENDANCE_TIME_INVALID', 'nor future times');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d2'), 'void', pg_temp.k(12))$$, '22023', 'INVALID_ARGUMENTS', 'void is never recorded directly');
select throws_ok($$insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key)
  values ('d3a00000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), 'check_in', now(), current_date, pg_temp.uid('e1'), 'app', pg_temp.k(13))$$, '42501', null, 'no direct insert');
reset role;
select is(pg_temp.seq('d1'), 'check_in,check_out,check_in', 'D1: arrived, left, returned');

-- Undo (10 s, recorder, no reason) -----------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select lives_ok($$select api.undo_attendance((select record_id from api.record_attendance(pg_temp.uid('d2'), 'check_in', pg_temp.k(20), pg_temp.ago(5))), pg_temp.k(21))$$,
  'E1 undoes an arrival right away');
reset role;
select is(pg_temp.seq('d2'), '', 'D2 is expected again');
select is((select count(*)::int from public.attendance_records where child_id = pg_temp.uid('d2')), 2, 'the original event stays, the undo is a new row');
select is((select correction_reason from public.attendance_records where idempotency_key = pg_temp.k(21)), null, 'an undo carries no reason');
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select api.undo_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(20)), pg_temp.k(22))$$, 'P0001', 'ATTENDANCE_ALREADY_VOIDED', 'an event is undone once');
reset role;
-- An arrival by E1 recorded 20 seconds ago (written as the owner to set the time).
insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, recorded_at, source, idempotency_key)
values ('d3a00000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), 'check_in', pg_temp.ago(1), current_date, pg_temp.uid('e1'), now() - interval '20 seconds', 'app', pg_temp.k(23));
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select api.undo_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(23)), pg_temp.k(24))$$, 'P0001', 'ATTENDANCE_UNDO_EXPIRED', 'after 10 s undo is refused (AC-05-4)');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.undo_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(5)), pg_temp.k(25))$$, '42501', 'PERMISSION_DENIED', 'only the recorder can undo');
reset role;

-- Corrections with a reason ------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select api.correct_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(23)), null, pg_temp.k(30))$$, '22023', 'INVALID_ARGUMENTS', 'a correction needs a reason');
select lives_ok($$select api.correct_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(23)), 'entry_error', pg_temp.k(31), pg_temp.ago(15))$$,
  'E1 corrects today''s arrival time with a reason');
reset role;
select is((select count(*)::int from public.attendance_records where child_id = pg_temp.uid('d2') and correction_reason = 'entry_error'), 2, 'a void and a replacement, both with the reason');
select ok(exists (select 1 from public.attendance_records where idempotency_key = pg_temp.k(23)), 'the original event stays (SR-AUTHZ-12)');
select is((select to_char(occurred_at, 'HH24:MI') from private.attendance_effective(pg_temp.uid('d2'), current_date)), to_char(pg_temp.ago(15), 'HH24:MI'), 'the effective arrival is the corrected time');
-- A record of yesterday (written as the owner).
insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key)
values ('d3a00000-0000-4000-8000-00000000000a', pg_temp.uid('d1'), 'check_in', now() - interval '1 day', current_date - 1, pg_temp.uid('e1'), 'app', pg_temp.k(40));
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select api.correct_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(40)), 'forgot', pg_temp.k(41))$$, 'P0001', 'ATTENDANCE_TIME_INVALID', 'educators do not correct past days (AC-05-8)');
select throws_ok($$select api.record_missed_attendance(pg_temp.uid('d1'), 'check_out', now() - interval '1 day' + interval '1 minute', 'forgot', pg_temp.k(42))$$, 'P0001', 'ATTENDANCE_TIME_INVALID', 'nor add a missed event of yesterday');
reset role;

-- Managers --------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.record_missed_attendance(pg_temp.uid('d1'), 'check_out', now() - interval '1 day' + interval '1 minute', 'forgot', pg_temp.k(43))$$, 'a manager adds yesterday''s forgotten departure with a reason');
select lives_ok($$select * from api.record_attendance(pg_temp.uid('d3'), 'check_in', pg_temp.k(44), pg_temp.ago(50), 'admin')$$, 'a manager records any child of the kindergarten');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d4'), 'check_in', pg_temp.k(45))$$, 'P0001', 'CHILD_NOT_ENROLLED', 'not for a child without an enrolment today');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('db'), 'check_in', pg_temp.k(46))$$, '42501', 'PERMISSION_DENIED', 'not for another kindergarten (NEG-01)');
select is((select count(*)::int from public.attendance_records where child_id = pg_temp.uid('d1') and local_date = current_date - 1), 2, 'managers read past days');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d3'), 'check_out', pg_temp.k(47))$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot record');
reset role;

-- Reads -----------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e2'));
select is((select string_agg(distinct child_id::text, ',') from public.attendance_records), pg_temp.uid('d3')::text, 'E2 reads only the events of the S2 child (NEG-07)');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select is((select count(*)::int from public.attendance_records), 0, 'a guardian reads no event row (status comes through the D3-C read model, without the recorder)');
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d1'), 'check_out', pg_temp.k(50))$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot record (NEG-03 for writes)');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select is((select count(*)::int from public.attendance_records), 0, 'the platform admin reads nothing (NEG-10)');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select is((select count(*)::int from public.attendance_records), 0, 'another kindergarten''s manager reads nothing (NEG-01)');
reset role;
-- E1's assignment ends today: no more recording (NEG-08).
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date) where id = 'd3a00000-0000-4000-8000-00000000a5e1';
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select * from api.record_attendance(pg_temp.uid('d2'), 'check_out', pg_temp.k(51))$$, '42501', 'PERMISSION_DENIED', 'after the assignment ends E1 cannot record (NEG-08)');
reset role;

-- Append-only and audit ------------------------------------------------------------------------------------------------
select throws_ok($$update public.attendance_records set occurred_at = now() where idempotency_key = pg_temp.k(1)$$, '42501', 'ATTENDANCE_APPEND_ONLY', 'not even the owner can change an event');
select is((select count(*)::int from audit.audit_events where target_table = 'attendance_records' and organization_id = 'd3a00000-0000-4000-8000-00000000000a'), 4,
  'undo, correction (void and replacement) and the missed event are audited; ordinary events are not');
select ok((select bool_and(actor_role in ('educator', 'org_admin')) from audit.audit_events where target_table = 'attendance_records' and organization_id = 'd3a00000-0000-4000-8000-00000000000a'),
  'with the actor role');

select * from finish();
rollback;
