-- D-41a: regular operations never rewrite the past of a child's relationships (migration
-- 20261118100000_relationship_history_guard.sql). Enrolments, guardian–child links, access restrictions and pickup
-- authorizations: no start in the past on insert, no day before today changed on update, no rename of a pickup person
-- who was already authorised before today. Every role: the authorisation guard answers first; managers with MFA (both
-- org_admin and director) are bound by the history rule. Server operations (withdrawal, D-37 cancellation) keep
-- working. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4100000-0000-4000-8000-0000000000' || x)::uuid, 'rh-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'a2', 'e1', 'f1', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4100000-%';
insert into private.platform_admins (profile_id) values ('d4100000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d4100000-0000-4000-8000-00000000000a', 'Test Povijest A', 'test-rh-a'),
  ('d4100000-0000-4000-8000-00000000000b', 'Test Povijest B', 'test-rh-b');
insert into public.facilities (id, organization_id, name) values
  ('d4100000-0000-4000-8000-0000000000fa', 'd4100000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4100000-0000-4000-8000-0000000000aa', 'd4100000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4100000-0000-4000-8000-000000000051', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000fa', 'd4100000-0000-4000-8000-0000000000aa', 'S1'),
  ('d4100000-0000-4000-8000-000000000052', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000fa', 'd4100000-0000-4000-8000-0000000000aa', 'S2');
insert into public.memberships (organization_id, profile_id, role, valid_during)
select ('d4100000-0000-4000-8000-00000000000' || o)::uuid, ('d4100000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('a2', 'a', 'director'), ('e1', 'a', 'educator'), ('f1', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during)
select m.organization_id, m.id, 'd4100000-0000-4000-8000-000000000051', daterange(current_date - 30, null)
from public.memberships m where m.profile_id = 'd4100000-0000-4000-8000-0000000000e1';
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d4100000-0000-4000-8000-0000000000d1', 'd4100000-0000-4000-8000-00000000000a', 'Ivo', 'Test', null),
  ('d4100000-0000-4000-8000-0000000000d2', 'd4100000-0000-4000-8000-00000000000a', 'Lea', 'Test', null);
-- Ivo: S1 in effect until +10, S2 planned from +10. Ana linked since -30 (with a restriction since -5), Eva planned
-- from +5. Pickups: Mara since -10 (in effect), Iva from tomorrow. Lea: nothing yet.
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d4100000-0000-4000-8000-0000000000e1', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000d1', 'd4100000-0000-4000-8000-000000000051', daterange(current_date - 30, current_date + 10), null),
  ('d4100000-0000-4000-8000-0000000000e2', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000d1', 'd4100000-0000-4000-8000-000000000052', daterange(current_date + 10, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d4100000-0000-4000-8000-000000000a01', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null),
  ('d4100000-0000-4000-8000-000000000a02', 'd4100000-0000-4000-8000-00000000000a', null, 'Eva', 'Skrbnik', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d4100000-0000-4000-8000-00000000c001', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000d1', 'd4100000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d4100000-0000-4000-8000-00000000c002', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000d1', 'd4100000-0000-4000-8000-000000000a02', true, daterange(current_date + 5, null), null);
insert into public.access_restrictions (id, organization_id, child_guardian_id, valid_during, created_by) values
  ('d4100000-0000-4000-8000-00000000f001', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-00000000c001', daterange(current_date - 5, null), null);
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d4100000-0000-4000-8000-00000000b001', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000d1', 'Mara', 'Baka', daterange(current_date - 10, null), null),
  ('d4100000-0000-4000-8000-00000000b002', 'd4100000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-0000000000d1', 'Iva', 'Teta', daterange(current_date + 1, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d4100000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.id(x text) returns uuid language sql as $$ select ('d4100000-0000-4000-8000-00000000' || x)::uuid $$;
grant execute on function pg_temp.uid(text) to authenticated;
grant execute on function pg_temp.id(text) to authenticated;
-- Rows a statement changed, run as the current (client) role: RLS hides rows from roles without rights, so an
-- UPDATE by them silently changes nothing — this makes that explicit.
create function pg_temp.affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function pg_temp.affected(text) to authenticated;
-- Every period of the scenario, read as the owner: proves that refused or invisible writes changed nothing.
create function pg_temp.periods() returns text language sql as $$
  select string_agg(t || ':' || r, ' | ' order by t, r) from (
    select 'e' as t, (valid_during)::text as r from public.enrollments where organization_id = 'd4100000-0000-4000-8000-00000000000a'
    union all select 'l', valid_during::text from public.child_guardians where organization_id = 'd4100000-0000-4000-8000-00000000000a'
    union all select 'r', valid_during::text from public.access_restrictions where organization_id = 'd4100000-0000-4000-8000-00000000000a'
    union all select 'p', first_name || ' ' || valid_during::text from public.pickup_authorizations where organization_id = 'd4100000-0000-4000-8000-00000000000a') x
$$;

-- Catalog ---------------------------------------------------------------------------------------------------------------
select is((select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
           where t.tgname in ('enrollments_history_guard', 'child_guardians_history_guard', 'access_restrictions_history_guard', 'pickup_authorizations_history_guard')
             and t.tgfoid = 'private.guard_relationship_history()'::regprocedure and t.tgenabled = 'O'), 4, 'the history guard is active on all four relationship tables');
select ok(not has_function_privilege('authenticated', 'private.guard_relationship_history()', 'EXECUTE')
  and not has_function_privilege('anon', 'private.guard_relationship_history()', 'EXECUTE'), 'no client can call the guard function');
select ok(not (select prosecdef from pg_proc where oid = 'private.guard_relationship_history()'::regprocedure), 'the guard runs as the caller (SECURITY INVOKER), so it sees the client role');

create temp table before_state as select pg_temp.periods() as p;
grant select on before_state to authenticated;

-- Other roles: the authorisation guard answers first, nothing changes ---------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), 'd4100000-0000-4000-8000-000000000051', daterange(current_date - 3, null))$$,
  '42501', null, 'an educator cannot enter an enrolment (past or not)');
select is(pg_temp.affected($$update public.child_guardians set valid_during = daterange(current_date - 60, null) where id = pg_temp.id('c001')$$), 0, 'an educator cannot move a link (row not writable)');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d1'), 'Novo', 'Ime', daterange(current_date - 3, null))$$,
  '42501', null, 'a guardian cannot add a pickup person');
update public.child_guardians set valid_during = daterange(current_date - 60, null) where id = pg_temp.id('c001');
reset role;
select pg_temp.login(pg_temp.uid('a1'));
select is(pg_temp.affected($$update public.child_guardians set valid_during = daterange(current_date - 60, null) where id = pg_temp.id('c001')$$), 0, 'a manager without MFA cannot change a link (row not writable)');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.id('c001'), daterange(current_date - 3, null))$$,
  '42501', null, 'a platform admin cannot enter a restriction');
update public.enrollments set valid_during = daterange(current_date - 90, current_date + 10) where id = pg_temp.uid('e1');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), pg_temp.id('0a02'), true, daterange(current_date - 3, null))$$,
  '42501', null, 'a manager of another kindergarten cannot link a guardian here');
update public.pickup_authorizations set valid_during = daterange(current_date - 90, null), first_name = 'Druga' where id = pg_temp.id('b001');
update public.access_restrictions set valid_during = daterange(current_date - 90, null) where id = pg_temp.id('f001');
reset role;
select is(pg_temp.periods(), (select p from before_state), 'none of these attempts changed a single period or name (RLS hides the rows from the other roles)');

-- Enrolments ----------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), 'd4100000-0000-4000-8000-000000000051', daterange(current_date - 1, null))$$,
  'P0001', 'HISTORY_IMMUTABLE', 'an enrolment cannot start yesterday');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), 'd4100000-0000-4000-8000-000000000051', daterange(null, current_date + 5))$$,
  'P0001', 'HISTORY_IMMUTABLE', 'an enrolment cannot have an open (unbounded) start');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 40, current_date + 10) where id = pg_temp.uid('e1')$$, 'P0001', 'HISTORY_IMMUTABLE', 'the start of an enrolment in effect cannot move back');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 20, current_date + 10) where id = pg_temp.uid('e1')$$, 'P0001', 'HISTORY_IMMUTABLE', 'nor forward (days -30..-21 would disappear)');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 30, current_date - 1) where id = pg_temp.uid('e1')$$, 'P0001', 'HISTORY_IMMUTABLE', 'an enrolment cannot end before yesterday');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 1, null) where id = pg_temp.uid('e2')$$, 'P0001', 'HISTORY_IMMUTABLE', 'a planned enrolment cannot be moved into the past');
select lives_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), 'd4100000-0000-4000-8000-000000000051', daterange(current_date, null))$$,
  'an enrolment can start today');
select lives_ok($$update public.enrollments set valid_during = daterange(current_date - 30, current_date + 8) where id = pg_temp.uid('e1')$$, 'a future end can be moved');
select lives_ok($$update public.enrollments set valid_during = daterange(current_date + 8, null) where id = pg_temp.uid('e2')$$, 'a planned start can be moved to another future day');
reset role;
select pg_temp.login(pg_temp.uid('a2'), 'aal2');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 45, current_date + 8) where id = pg_temp.uid('e1')$$, 'P0001', 'HISTORY_IMMUTABLE', 'a director with MFA is bound by the same rule');
reset role;

-- Guardian–child links ------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), pg_temp.id('0a01'), true, daterange(current_date - 1, null))$$,
  'P0001', 'HISTORY_IMMUTABLE', 'a link cannot start yesterday');
select throws_ok($$update public.child_guardians set valid_during = daterange(current_date - 60, null) where id = pg_temp.id('c001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'the start of a link in effect cannot move back');
select throws_ok($$update public.child_guardians set valid_during = daterange(current_date - 30, current_date - 2) where id = pg_temp.id('c001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'a link cannot be ended in the past');
select throws_ok($$update public.child_guardians set valid_during = daterange(current_date - 3, null) where id = pg_temp.id('c002')$$, 'P0001', 'HISTORY_IMMUTABLE', 'a planned link cannot be moved into the past');
select lives_ok($$update public.child_guardians set can_report_absence = true where id = pg_temp.id('c001')$$, 'rights of a link can still change (they apply from now)');
select lives_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d2'), pg_temp.id('0a01'), true, daterange(current_date, null))$$,
  'a link can start today');
select lives_ok($$update public.child_guardians set valid_during = daterange(current_date, null) where id = pg_temp.id('c002')$$, 'a planned link can start today instead');
select lives_ok($$update public.child_guardians set valid_during = daterange(current_date - 30, current_date + 1) where id = pg_temp.id('c001')$$, 'a link can end today (last day today)');
reset role;

-- Access restrictions -------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.id('c002'), daterange(current_date - 1, null))$$,
  'P0001', 'HISTORY_IMMUTABLE', 'a restriction cannot start yesterday');
select throws_ok($$update public.access_restrictions set valid_during = daterange(current_date - 10, null) where id = pg_temp.id('f001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'the start of a restriction cannot move back');
select throws_ok($$update public.access_restrictions set valid_during = daterange(current_date - 5, current_date - 2) where id = pg_temp.id('f001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'a restriction cannot be lifted in the past');
select lives_ok($$update public.access_restrictions set reference = 'INT-1' where id = pg_temp.id('f001')$$, 'the internal reference can still change (it decides nothing)');
select lives_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.id('c002'), daterange(current_date, null))$$,
  'a restriction can start today');
select lives_ok($$update public.access_restrictions set valid_during = daterange(current_date - 5, current_date) where id = pg_temp.id('f001')$$, 'a restriction can be lifted as of today (no past day changes)');
reset role;

-- Pickup authorizations -----------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d1'), 'Nova', 'Osoba', daterange(current_date - 1, null))$$,
  'P0001', 'HISTORY_IMMUTABLE', 'a pickup person cannot be authorised from yesterday');
select throws_ok($$update public.pickup_authorizations set valid_during = daterange(current_date - 20, null) where id = pg_temp.id('b001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'the start of an authorisation cannot move back');
select throws_ok($$update public.pickup_authorizations set valid_during = daterange(current_date - 10, current_date - 3) where id = pg_temp.id('b001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'an authorisation cannot be ended in the past');
select throws_ok($$update public.pickup_authorizations set first_name = 'Marija' where id = pg_temp.id('b001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'a person authorised before today cannot be renamed (handover history points to it)');
select throws_ok($$update public.pickup_authorizations set last_name = 'Druga' where id = pg_temp.id('b001')$$, 'P0001', 'HISTORY_IMMUTABLE', 'nor the last name');
select lives_ok($$update public.pickup_authorizations set first_name = 'Ivana' where id = pg_temp.id('b002')$$, 'a person not yet authorised can be renamed');
select lives_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during) values ('d4100000-0000-4000-8000-00000000000a', pg_temp.uid('d1'), 'Nova', 'Osoba', daterange(current_date, current_date + 7))$$,
  'a pickup person can be authorised from today');
select lives_ok($$update public.pickup_authorizations set valid_during = daterange(current_date - 10, current_date + 3) where id = pg_temp.id('b001')$$, 'an authorisation can be ended in the future');
reset role;

-- Server operations keep working (they enforce the same dates themselves) ----------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date - 1)$$, 'P0001', null, 'a withdrawal with a past last day is still refused by the RPC (D-36)');
select lives_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b002'), 'entered_in_error')$$, 'a not-yet-effective record can still be cancelled (D-37)');
select lives_ok($$select api.withdraw_child(pg_temp.uid('d2'), current_date)$$, 'a withdrawal with last day today still closes the child''s records as the owner');
reset role;
select is((select string_agg(upper(valid_during)::text, ',') from public.child_guardians where child_id = pg_temp.uid('d2')), (current_date + 1)::text, 'the withdrawal closed Lea''s link with today as last day');
select is((select lower(valid_during) from public.enrollments where id = pg_temp.uid('e1')), current_date - 30, 'and every past start stays as it was');

-- Audit: refused writes leave no trace of a change; accepted ones are audited --------------------------------------------
select ok((select count(*) from public.audit_events where target_id = pg_temp.id('b001') and action like '%update%') >= 1, 'accepted changes are audited');
select is((select string_agg(first_name || ' ' || last_name, ',' order by first_name) from public.pickup_authorizations where organization_id = 'd4100000-0000-4000-8000-00000000000a'), 'Mara Baka,Nova Osoba', 'no refused rename survived (Iva was cancelled under D-37)');

select * from finish();
rollback;
