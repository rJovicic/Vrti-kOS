-- D3-H: handover person (migration 20261116100000_attendance_handover.sql). FR-05-3/4, AC-05-3, D-38 (b): the list holds
-- the child's guardians linked that day (a restricted one marked, not hidden) and the pickup persons valid that day,
-- nothing else; recording accepts only a person from that list, at most one; a correction keeps the person; only staff
-- who may record read the list (NEG-01/07/10, guardians); guardians never see the person. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d3f00000-0000-4000-8000-0000000000' || x)::uuid, 'hand-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd3f00000-%';
insert into private.platform_admins (profile_id) values ('d3f00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d3f00000-0000-4000-8000-00000000000a', 'Test Predaja A', 'test-hand-a'),
  ('d3f00000-0000-4000-8000-00000000000b', 'Test Predaja B', 'test-hand-b');
insert into public.facilities (id, organization_id, name) values
  ('d3f00000-0000-4000-8000-0000000000fa', 'd3f00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d3f00000-0000-4000-8000-0000000000fb', 'd3f00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d3f00000-0000-4000-8000-0000000000aa', 'd3f00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d3f00000-0000-4000-8000-0000000000bb', 'd3f00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d3f00000-0000-4000-8000-000000000051', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000fa', 'd3f00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d3f00000-0000-4000-8000-000000000052', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000fa', 'd3f00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d3f00000-0000-4000-8000-000000000061', 'd3f00000-0000-4000-8000-00000000000b', 'd3f00000-0000-4000-8000-0000000000fb', 'd3f00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d3f00000-0000-4000-8000-0000000001' || x)::uuid, ('d3f00000-0000-4000-8000-00000000000' || o)::uuid, ('d3f00000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000001e1', 'd3f00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000001e2', 'd3f00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- D1 and D2 in S1 (A); DB in B.
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d3f00000-0000-4000-8000-0000000000' || x)::uuid, ('d3f00000-0000-4000-8000-00000000000' || o)::uuid, n, 'Test', null
from (values ('d1', 'a', 'Ivo'), ('d2', 'a', 'Jan'), ('db', 'b', 'Beta')) v(x, o, n);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
select ('d3f00000-0000-4000-8000-00000000000' || o)::uuid, ('d3f00000-0000-4000-8000-0000000000' || c)::uuid, ('d3f00000-0000-4000-8000-0000000000' || g)::uuid,
       daterange(current_date - 30, null), null
from (values ('a', 'd1', '51'), ('a', 'd2', '51'), ('b', 'db', '61')) v(o, c, g);
-- Guardians of D1: Ana (account f1), Bea (link restricted today), Cvita (link ended yesterday); Dora is D2's guardian.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d3f00000-0000-4000-8000-000000000a01', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null),
  ('d3f00000-0000-4000-8000-000000000a02', 'd3f00000-0000-4000-8000-00000000000a', null, 'Bea', 'Skrbnik', null),
  ('d3f00000-0000-4000-8000-000000000a03', 'd3f00000-0000-4000-8000-00000000000a', null, 'Cvita', 'Skrbnik', null),
  ('d3f00000-0000-4000-8000-000000000a04', 'd3f00000-0000-4000-8000-00000000000a', null, 'Dora', 'Druga', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d3f00000-0000-4000-8000-00000000c001', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d1', 'd3f00000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d3f00000-0000-4000-8000-00000000c002', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d1', 'd3f00000-0000-4000-8000-000000000a02', true, daterange(current_date - 30, null), null),
  ('d3f00000-0000-4000-8000-00000000c003', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d1', 'd3f00000-0000-4000-8000-000000000a03', true, daterange(current_date - 30, current_date), null),
  ('d3f00000-0000-4000-8000-00000000c004', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d2', 'd3f00000-0000-4000-8000-000000000a04', true, daterange(current_date - 30, null), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-00000000c002', daterange(current_date, null), null);
-- Pickup persons: Oto (D1, today), Pia (D1, from tomorrow), Rok (D2), Sara (B's child).
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d3f00000-0000-4000-8000-00000000b001', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d1', 'Oto', 'Osoba', daterange(current_date - 5, null), null),
  ('d3f00000-0000-4000-8000-00000000b002', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d1', 'Pia', 'Osoba', daterange(current_date + 1, null), null),
  ('d3f00000-0000-4000-8000-00000000b003', 'd3f00000-0000-4000-8000-00000000000a', 'd3f00000-0000-4000-8000-0000000000d2', 'Rok', 'Osoba', daterange(current_date - 5, null), null),
  ('d3f00000-0000-4000-8000-00000000b004', 'd3f00000-0000-4000-8000-00000000000b', 'd3f00000-0000-4000-8000-0000000000db', 'Sara', 'Osoba', daterange(current_date - 5, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d3f00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.d(x text) returns uuid language sql as $$ select ('d3f00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.link(n int) returns uuid language sql as $$ select ('d3f00000-0000-4000-8000-00000000c00' || n)::uuid $$;
create function pg_temp.pick(n int) returns uuid language sql as $$ select ('d3f00000-0000-4000-8000-00000000b00' || n)::uuid $$;
create function pg_temp.k(n int) returns uuid language sql as $$ select ('d3f00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.ago(m int) returns timestamptz language sql as $$
  -- m minutes ago, but never before the kindergarten's local midnight: early in the day the times are scaled into the
  -- part of today that has passed, keeping their order (larger m = earlier). Valid for m < 1000.
  select greatest(now() - make_interval(mins => m),
                  date_trunc('day', now() at time zone 'Europe/Zagreb') at time zone 'Europe/Zagreb'
                  + (now() - date_trunc('day', now() at time zone 'Europe/Zagreb') at time zone 'Europe/Zagreb') * ((1000 - m) / 1000.0))
$$;
create function pg_temp.list(c text) returns text language sql as $$
  select coalesce(string_agg(kind || ':' || first_name || case when restricted then '!' else '' end, ',' order by kind, first_name), '')
  from api.handover_candidates(pg_temp.d(c))
$$;
grant execute on function pg_temp.d(text), pg_temp.link(int), pg_temp.pick(int), pg_temp.k(int), pg_temp.ago(int), pg_temp.list(text) to authenticated;

-- Catalog ------------------------------------------------------------------------------------------------------------
select ok(not (select prosecdef from pg_proc where oid = 'api.handover_candidates(uuid)'::regprocedure), 'the list RPC is SECURITY INVOKER (SR-API-01)');
select ok(not has_function_privilege('anon', 'api.handover_candidates(uuid)', 'EXECUTE'), 'anon cannot read the list (NEG-15)');
select is(pg_get_function_result('api.handover_candidates(uuid)'::regprocedure),
  'TABLE(kind text, id uuid, first_name text, last_name text, restricted boolean)', 'names and the restriction mark only: no contact, reason or reference');
select ok(pg_get_function_result('api.child_day_status(date, uuid)'::regprocedure) !~ 'handover', 'the day status (guardians) has no handover column');

-- The list (educator E1 of S1) ---------------------------------------------------------------------------------------
select pg_temp.login('e1');
select is(pg_temp.list('d1'), 'guardian:Ana,guardian:Bea!,pickup:Oto',
  'D1: linked guardians with Bea marked restricted (D-38 b), today''s pickup person; no ended link, no future person, nothing of D2');
select is(pg_temp.list('d2'), 'guardian:Dora,pickup:Rok', 'D2 has its own list');

-- Recording with a person ----------------------------------------------------------------------------------------------
select lives_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_in', pg_temp.k(1), pg_temp.ago(120), 'app', pg_temp.link(1))$$,
  'arrival handed over by Ana');
select lives_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(2), pg_temp.ago(100), 'app', pg_temp.link(2))$$,
  'departure with Bea although her link is restricted: a restriction is not a pickup ban (D-38 b, D-33)');
select lives_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_in', pg_temp.k(3), pg_temp.ago(80), 'app', null, pg_temp.pick(1))$$,
  'arrival with the pickup person Oto');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(4), null, 'app', pg_temp.link(1), pg_temp.pick(1))$$,
  'P0001', 'HANDOVER_INVALID', 'not two persons at once');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(5), null, 'app', pg_temp.link(3))$$,
  'P0001', 'HANDOVER_INVALID', 'not a guardian whose link has ended');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(6), null, 'app', null, pg_temp.pick(2))$$,
  'P0001', 'HANDOVER_INVALID', 'not a pickup person valid only from tomorrow');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(7), null, 'app', pg_temp.link(4))$$,
  'P0001', 'HANDOVER_INVALID', 'not another child''s guardian');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(8), null, 'app', null, pg_temp.pick(4))$$,
  'P0001', 'HANDOVER_INVALID', 'not another kindergarten''s person (NEG-01)');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(9), null, 'app', null, gen_random_uuid())$$,
  'P0001', 'HANDOVER_INVALID', 'not an unknown id (no free entry of a new person, FR-05-4)');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_in', pg_temp.k(3), pg_temp.ago(80), 'app', pg_temp.link(1))$$,
  'P0001', 'IDEMPOTENCY_KEY_REUSED', 'a replay with another person is not the same request');
select is((select replayed from api.record_attendance(pg_temp.d('d1'), 'check_in', pg_temp.k(3), pg_temp.ago(80), 'app', null, pg_temp.pick(1))), true,
  'the same request again is a replay');
reset role;
select is((select string_agg(kind::text || ':' || coalesce(handover_child_guardian_id::text, '') || coalesce(handover_pickup_id::text, ''), ',' order by occurred_at)
           from public.attendance_records where child_id = pg_temp.d('d1')),
  'check_in:' || pg_temp.link(1) || ',check_out:' || pg_temp.link(2) || ',check_in:' || pg_temp.pick(1),
  'exactly the three accepted events are stored with their person; refused requests stored nothing');

-- A correction keeps the person ----------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.correct_attendance((select id from public.attendance_records where idempotency_key = pg_temp.k(3)), 'entry_error', pg_temp.k(20), pg_temp.ago(90), 'admin')$$,
  'the manager corrects the time of Oto''s arrival');
reset role;
select is((select handover_pickup_id from public.attendance_records where corrects_id = (select id from public.attendance_records where idempotency_key = pg_temp.k(3)) and kind = 'check_in'),
  pg_temp.pick(1), 'the corrected event keeps the person');
select pg_temp.login('a1', 'aal2');
select is(pg_temp.list('d1'), 'guardian:Ana,guardian:Bea!,pickup:Oto', 'the manager reads the same list');
reset role;

-- Who may not read the list ----------------------------------------------------------------------------------------------
select pg_temp.login('e2');
select throws_ok($$select pg_temp.list('d1')$$, '42501', 'PERMISSION_DENIED', 'an educator of another group (NEG-07)');
reset role;
select pg_temp.login('f1');
select throws_ok($$select pg_temp.list('d1')$$, '42501', 'PERMISSION_DENIED', 'a guardian, even of this child');
reset role;
select pg_temp.login('a1');
select throws_ok($$select pg_temp.list('d1')$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select pg_temp.list('d1')$$, '42501', 'PERMISSION_DENIED', 'another kindergarten''s manager (NEG-01)');
reset role;
select pg_temp.login('c1', 'aal2');
select throws_ok($$select pg_temp.list('d1')$$, '42501', 'PERMISSION_DENIED', 'the platform admin (NEG-10)');
reset role;
select pg_temp.login('e2');
select throws_ok($$select * from api.record_attendance(pg_temp.d('d1'), 'check_out', pg_temp.k(30), null, 'app', pg_temp.link(1))$$,
  '42501', 'PERMISSION_DENIED', 'authorization comes before the person check: E2 learns nothing about D1''s persons');
reset role;

select * from finish();
rollback;
