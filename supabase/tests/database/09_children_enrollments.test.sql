-- D2-A: children and enrolments (migration 20261112101000_children_enrollments.sql).
-- NEG-01 cross-tenant, NEG-07 educator outside own groups, NEG-08 after the end of an assignment / after a transfer,
-- NEG-10 platform admin, guardians (no access before D2-B), AAL2 for managers, immutable columns, one group at a
-- time, audit with actor role. Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Fixtures ------------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('d2a00000-0000-4000-8000-0000000000a1', 'ch-admin-a@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000e1', 'ch-odg-s1@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000e2', 'ch-odg-s2@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000e3', 'ch-odg-istekao@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000e4', 'ch-odg-suspendiran@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000f1', 'ch-roditelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000b1', 'ch-admin-b@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000b2', 'ch-odg-b@t.test', 'authenticated', 'authenticated', now()),
  ('d2a00000-0000-4000-8000-0000000000c1', 'ch-platforma@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where id::text like 'd2a00000-%';
insert into private.platform_admins (profile_id) values ('d2a00000-0000-4000-8000-0000000000c1');

insert into public.organizations (id, name, slug) values
  ('d2a00000-0000-4000-8000-00000000000a', 'Test Djeca A', 'test-djeca-a'),
  ('d2a00000-0000-4000-8000-00000000000b', 'Test Djeca B', 'test-djeca-b');
insert into public.facilities (id, organization_id, name) values
  ('d2a00000-0000-4000-8000-0000000000fa', 'd2a00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d2a00000-0000-4000-8000-0000000000fb', 'd2a00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2a00000-0000-4000-8000-0000000000aa', 'd2a00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d2a00000-0000-4000-8000-0000000000bb', 'd2a00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2a00000-0000-4000-8000-000000000051', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000fa', 'd2a00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d2a00000-0000-4000-8000-000000000052', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000fa', 'd2a00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d2a00000-0000-4000-8000-000000000061', 'd2a00000-0000-4000-8000-00000000000b', 'd2a00000-0000-4000-8000-0000000000fb', 'd2a00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, status, valid_during) values
  ('d2a00000-0000-4000-8000-0000000001a1', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000a1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001e1', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000e1', 'educator', 'active', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001e2', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000e2', 'educator', 'active', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001e3', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000e3', 'educator', 'active', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001e4', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000e4', 'educator', 'suspended', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001f1', 'd2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000f1', 'guardian', 'active', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001b1', 'd2a00000-0000-4000-8000-00000000000b', 'd2a00000-0000-4000-8000-0000000000b1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('d2a00000-0000-4000-8000-0000000001b2', 'd2a00000-0000-4000-8000-00000000000b', 'd2a00000-0000-4000-8000-0000000000b2', 'educator', 'active', daterange(current_date - 30, null));
-- E1 → S1 (regular), E2 → S2 (regular), E3 → S1 substitute that ended yesterday, E4 (suspended) → S1, EB → B1.
insert into public.staff_assignments (organization_id, membership_id, group_id, assignment_type, valid_during, approved_by) values
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000001e1', 'd2a00000-0000-4000-8000-000000000051', 'regular', daterange(current_date - 30, null), null),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000001e2', 'd2a00000-0000-4000-8000-000000000052', 'regular', daterange(current_date - 30, null), null),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000001e3', 'd2a00000-0000-4000-8000-000000000051', 'substitute', daterange(current_date - 5, current_date), 'd2a00000-0000-4000-8000-0000000000a1'),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000001e4', 'd2a00000-0000-4000-8000-000000000051', 'regular', daterange(current_date - 30, null), null),
  ('d2a00000-0000-4000-8000-00000000000b', 'd2a00000-0000-4000-8000-0000000001b2', 'd2a00000-0000-4000-8000-000000000061', 'regular', daterange(current_date - 30, null), null);
-- Children: D1 in S1; D2 in S2; D3 was in S1 until yesterday and is in S2 from today (transfer); D4 not enrolled;
-- D5 enrolment in S1 starts tomorrow; DB in B1.
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2a00000-0000-4000-8000-0000000000d1', 'd2a00000-0000-4000-8000-00000000000a', 'Dijete', 'Jedan', null),
  ('d2a00000-0000-4000-8000-0000000000d2', 'd2a00000-0000-4000-8000-00000000000a', 'Dijete', 'Dva', null),
  ('d2a00000-0000-4000-8000-0000000000d3', 'd2a00000-0000-4000-8000-00000000000a', 'Dijete', 'Tri', null),
  ('d2a00000-0000-4000-8000-0000000000d4', 'd2a00000-0000-4000-8000-00000000000a', 'Dijete', 'Četiri', null),
  ('d2a00000-0000-4000-8000-0000000000d5', 'd2a00000-0000-4000-8000-00000000000a', 'Dijete', 'Pet', null),
  ('d2a00000-0000-4000-8000-0000000000db', 'd2a00000-0000-4000-8000-00000000000b', 'Dijete', 'Beta', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d1', 'd2a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d2', 'd2a00000-0000-4000-8000-000000000052', daterange(current_date - 30, null), null),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d3', 'd2a00000-0000-4000-8000-000000000051', daterange(current_date - 30, current_date), null),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d3', 'd2a00000-0000-4000-8000-000000000052', daterange(current_date, null), null),
  ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d5', 'd2a00000-0000-4000-8000-000000000051', daterange(current_date + 1, null), null),
  ('d2a00000-0000-4000-8000-00000000000b', 'd2a00000-0000-4000-8000-0000000000db', 'd2a00000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.names() returns text language sql as $$
  select coalesce(string_agg(last_name, ',' order by last_name), '') from public.children
$$;
grant execute on function pg_temp.names() to authenticated;

-- Catalog and grants ---------------------------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.children'::regclass, 'public.enrollments'::regclass)), 'RLS is enabled on children and enrollments');
select ok(not has_table_privilege('anon', 'public.children', 'SELECT') and not has_table_privilege('anon', 'public.enrollments', 'SELECT'), 'anon reads nothing (NEG-15)');
select ok(not has_table_privilege('authenticated', 'public.children', 'DELETE,TRUNCATE') and not has_table_privilege('authenticated', 'public.enrollments', 'DELETE,TRUNCATE'), 'no client can delete children or enrolments');
select ok(not has_column_privilege('authenticated', 'public.children', 'status', 'UPDATE') and not has_column_privilege('authenticated', 'public.children', 'organization_id', 'UPDATE'), 'status and kindergarten of a child are not client-writable');
select ok(not has_function_privilege('anon', 'private.educator_child_ids()', 'EXECUTE'), 'anon cannot call the educator helper');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'children'
  and column_name ~* 'birth|oib|address|photo|health|allerg|medical|rođen'), 0, 'children hold no date of birth, OIB, address, photo or health data (Q-P03, D-9)');

-- Manager (AAL2) ---------------------------------------------------------------------------------------------------
select pg_temp.login('d2a00000-0000-4000-8000-0000000000a1', 'aal2');
select is(pg_temp.names(), 'Četiri,Dva,Jedan,Pet,Tri', 'A manager sees all A children and no B child (NEG-01)');
select is((select count(*)::int from public.enrollments where organization_id = 'd2a00000-0000-4000-8000-00000000000b'), 0, 'A manager sees no B enrolment');
select lives_ok($$insert into public.children (organization_id, first_name, last_name, internal_ref) values ('d2a00000-0000-4000-8000-00000000000a', 'Novo', 'Dijete', 'A-006')$$, 'A manager creates a child');
select is((select created_by::text || ' ' || status::text from public.children where internal_ref = 'A-006'), 'd2a00000-0000-4000-8000-0000000000a1 active', 'creator and status are set by the database');
select throws_ok($$insert into public.children (organization_id, first_name, last_name, internal_ref) values ('d2a00000-0000-4000-8000-00000000000a', 'Drugo', 'Dijete', 'A-006')$$, '23505', null, 'the internal reference is unique per kindergarten');
select throws_ok($$insert into public.children (id, organization_id, first_name, last_name) values ('d2a00000-0000-4000-8000-0000000000d7', 'd2a00000-0000-4000-8000-00000000000a', 'X', 'Y')$$, '42501', null, 'the id cannot be chosen by the client');
select throws_ok($$insert into public.children (organization_id, first_name, last_name, status) values ('d2a00000-0000-4000-8000-00000000000a', 'X', 'Y', 'withdrawn')$$, '42501', null, 'status cannot be set by the client');
select throws_ok($$insert into public.children (organization_id, first_name, last_name) values ('d2a00000-0000-4000-8000-00000000000b', 'Uljez', 'Dijete')$$, '42501', 'PERMISSION_DENIED', 'A manager cannot create a child in B (NEG-01)');
select throws_ok($$insert into public.children (organization_id, first_name, last_name) values ('d2a00000-0000-4000-8000-00000000000a', '', 'Y')$$, '23514', null, 'an empty name is rejected');
select lives_ok($$update public.children set last_name = 'Dijete-Novo' where internal_ref = 'A-006'$$, 'A manager corrects a name');
select throws_ok($$update public.children set status = 'withdrawn', withdrawn_on = current_date where internal_ref = 'A-006'$$, '42501', null, 'withdrawal is not a bare update');
select throws_ok($$delete from public.children where internal_ref = 'A-006'$$, '42501', null, 'a manager cannot delete a child');
select is_empty($$update public.children set last_name = 'Hakirano' where id = 'd2a00000-0000-4000-8000-0000000000db' returning id$$, 'A manager cannot change a B child');
select lives_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d2a00000-0000-4000-8000-00000000000a', (select id from public.children where internal_ref = 'A-006'), 'd2a00000-0000-4000-8000-000000000051', daterange(current_date, null))$$, 'A manager enrols the child in S1');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d2a00000-0000-4000-8000-00000000000a', (select id from public.children where internal_ref = 'A-006'), 'd2a00000-0000-4000-8000-000000000052', daterange(current_date + 10, null))$$, '23P01', null, 'a child cannot be in two groups at the same time (FR-04-2)');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d4', 'd2a00000-0000-4000-8000-000000000061', daterange(current_date, null))$$, '23503', null, 'composite FK blocks an A child in a B group');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d2a00000-0000-4000-8000-00000000000b', 'd2a00000-0000-4000-8000-0000000000db', 'd2a00000-0000-4000-8000-000000000061', daterange(current_date + 400, null))$$, '42501', 'PERMISSION_DENIED', 'A manager cannot enrol in B (NEG-01)');
select throws_ok($$update public.enrollments set group_id = 'd2a00000-0000-4000-8000-000000000052' where child_id = (select id from public.children where internal_ref = 'A-006')$$, '42501', null, 'the group of an enrolment cannot be changed (end it and open a new one)');
select lives_ok($$update public.enrollments set valid_during = daterange(current_date, current_date + 30) where child_id = (select id from public.children where internal_ref = 'A-006')$$, 'A manager ends an enrolment by its validity');
select throws_ok($$delete from public.enrollments where child_id = (select id from public.children where internal_ref = 'A-006')$$, '42501', null, 'a manager cannot delete an enrolment');
reset role;
select ok((select count(*) from audit.audit_events where target_table in ('children', 'enrollments') and actor_id = 'd2a00000-0000-4000-8000-0000000000a1' and actor_role = 'org_admin') >= 4,
  'child and enrolment changes are audited with the actor role');
select ok(not exists (select 1 from audit.audit_events where target_table in ('children', 'enrollments') and details::text ~ 'Dijete|Novo'), 'the audit holds no child names');

select pg_temp.login('d2a00000-0000-4000-8000-0000000000a1', 'aal1');
select is(pg_temp.names(), '', 'a manager without MFA (AAL1) sees no child');
select throws_ok($$insert into public.children (organization_id, first_name, last_name) values ('d2a00000-0000-4000-8000-00000000000a', 'Bez', 'MFA')$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot create a child');
reset role;

-- Educators ------------------------------------------------------------------------------------------------------
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e1');
select is(pg_temp.names(), 'Dijete-Novo,Jedan', 'E1 sees exactly the children enrolled today in S1 (NEG-07): not S2, not transferred, not future, not unenrolled');
select is((select count(*)::int from public.enrollments), 2, 'E1 sees only the current enrolments of S1 (no history of the transferred child, no future one)');
select is((select count(*)::int from public.children where id = 'd2a00000-0000-4000-8000-0000000000d3'), 0, 'after a transfer the previous educator no longer sees the child (NEG-08)');
select is((select count(*)::int from public.children where id = 'd2a00000-0000-4000-8000-0000000000db'), 0, 'E1 sees no B child by id');
select throws_ok($$insert into public.children (organization_id, first_name, last_name) values ('d2a00000-0000-4000-8000-00000000000a', 'X', 'Y')$$, '42501', 'PERMISSION_DENIED', 'an educator cannot create a child');
select is_empty($$update public.children set last_name = 'Promjena' where id = 'd2a00000-0000-4000-8000-0000000000d1' returning id$$, 'an educator cannot change a child they can see');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during) values ('d2a00000-0000-4000-8000-00000000000a', 'd2a00000-0000-4000-8000-0000000000d4', 'd2a00000-0000-4000-8000-000000000051', daterange(current_date, null))$$, '42501', 'PERMISSION_DENIED', 'an educator cannot enrol a child into their group');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e2');
select is(pg_temp.names(), 'Dva,Tri', 'E2 sees S2 including the child transferred in today');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e3');
select is(pg_temp.names(), '', 'a substitute whose assignment ended yesterday sees no child (NEG-08)');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e4');
select is(pg_temp.names(), '', 'a suspended educator sees no child (NEG-09)');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000b2');
select is(pg_temp.names(), 'Beta', 'a B educator sees only the B child');
reset role;

-- Losing the assignment takes effect on the next query ------------------------------------------------------------------
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date)
 where membership_id = 'd2a00000-0000-4000-8000-0000000001e1';
select pg_temp.login('d2a00000-0000-4000-8000-0000000000e1');
select is(pg_temp.names(), '', 'E1 loses the children as soon as the assignment ends (NEG-08)');
select is((select count(*)::int from public.enrollments), 0, 'and the enrolments');
reset role;

-- Guardians and platform admin --------------------------------------------------------------------------------------
select pg_temp.login('d2a00000-0000-4000-8000-0000000000f1');
select is(pg_temp.names(), '', 'a guardian sees no child before a guardian link exists (NEG-03; links arrive in D2-B)');
select is((select count(*)::int from public.enrollments), 0, 'a guardian sees no enrolment');
reset role;
select pg_temp.login('d2a00000-0000-4000-8000-0000000000c1', 'aal2');
select is((select count(*)::int from public.children) + (select count(*)::int from public.enrollments), 0, 'a platform admin reads no child and no enrolment (NEG-10)');
reset role;

select * from finish();
rollback;
