-- D1: staff assignments (FS-03, SR-AUTHZ-06) and invitations (FS-01, SR-AUTHN-04/05, SR-AUTHZ-07).
-- Own synthetic fixtures, rolled back. Covers NEG-01, NEG-07, NEG-08, NEG-09, NEG-11 for the new tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Fixtures ------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('a1000000-0000-4000-8000-0000000000a1', 'ua@t.test', 'authenticated', 'authenticated', now()),
  ('b1000000-0000-4000-8000-0000000000b1', 'ub@t.test', 'authenticated', 'authenticated', now()),
  ('a1000000-0000-4000-8000-0000000000e1', 'ea@t.test', 'authenticated', 'authenticated', now()),
  ('a1000000-0000-4000-8000-0000000000e3', 'e3@t.test', 'authenticated', 'authenticated', now()),
  ('a1000000-0000-4000-8000-0000000000f1', 'ga@t.test', 'authenticated', 'authenticated', now()),
  ('a1000000-0000-4000-8000-0000000000d1', 'da@t.test', 'authenticated', 'authenticated', now()),
  ('c1000000-0000-4000-8000-00000000000c', 'novi@t.test', 'authenticated', 'authenticated', now()),
  ('c1000000-0000-4000-8000-00000000000d', 'neprovjeren@t.test', 'authenticated', 'authenticated', null);
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users
where email in ('ua@t.test', 'ub@t.test', 'ea@t.test', 'e3@t.test', 'ga@t.test', 'da@t.test');

insert into public.organizations (id, name, slug) values
  ('a1000000-0000-4000-8000-00000000000a', 'Test Alfa', 'test-alfa-d1'),
  ('b1000000-0000-4000-8000-00000000000b', 'Test Beta', 'test-beta-d1');
insert into public.facilities (id, organization_id, name) values
  ('a1000000-0000-4000-8000-0000000000fa', 'a1000000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('b1000000-0000-4000-8000-0000000000fb', 'b1000000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('a1000000-0000-4000-8000-0000000000aa', 'a1000000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('b1000000-0000-4000-8000-0000000000bb', 'b1000000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('a1000000-0000-4000-8000-000000000051', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000fa', 'a1000000-0000-4000-8000-0000000000aa', 'S1'),
  ('a1000000-0000-4000-8000-000000000052', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000fa', 'a1000000-0000-4000-8000-0000000000aa', 'S2'),
  ('b1000000-0000-4000-8000-000000000061', 'b1000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-0000000000fb', 'b1000000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during) values
  ('a1000000-0000-4000-8000-0000000001a1', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000a1', 'org_admin', daterange(current_date - 30, null)),
  ('b1000000-0000-4000-8000-0000000001b1', 'b1000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-0000000000b1', 'org_admin', daterange(current_date - 30, null)),
  ('a1000000-0000-4000-8000-0000000001e1', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'educator', daterange(current_date - 30, null)),
  ('a1000000-0000-4000-8000-0000000001e3', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e3', 'educator', daterange(current_date - 30, null)),
  ('a1000000-0000-4000-8000-0000000001f1', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000f1', 'guardian', daterange(current_date - 30, null)),
  ('a1000000-0000-4000-8000-0000000001d1', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000d1', 'director', daterange(current_date - 30, null));
-- E3: substitute that ended yesterday on S1, and one starting tomorrow on S2 (inserted by migration owner).
insert into public.staff_assignments (organization_id, membership_id, group_id, assignment_type, valid_during, approved_by) values
  ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e3', 'a1000000-0000-4000-8000-000000000051', 'substitute', daterange(current_date - 1, current_date), 'a1000000-0000-4000-8000-0000000000a1'),
  ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e3', 'a1000000-0000-4000-8000-000000000052', 'substitute', daterange(current_date + 1, current_date + 2), 'a1000000-0000-4000-8000-0000000000a1');

create function pg_temp.login(uid uuid, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Staff assignments: manager ---------------------------------------------------------------------------
select pg_temp.login('a1000000-0000-4000-8000-0000000000a1');
select lives_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e1', 'a1000000-0000-4000-8000-000000000051', daterange(current_date - 10, null))$$, 'U1 assigns E1 to S1 (regular, started 10 days ago)');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, assignment_type, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e1', 'a1000000-0000-4000-8000-000000000052', 'substitute', daterange(current_date, null))$$, '23514', null, 'substitute without end date is rejected (FR-03-3)');
select lives_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, assignment_type, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e1', 'a1000000-0000-4000-8000-000000000052', 'substitute', daterange(current_date, current_date + 1))$$, 'U1 adds a one-day substitute E1 → S2');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001f1', 'a1000000-0000-4000-8000-000000000051', daterange(current_date, null))$$, '23514', null, 'a guardian membership cannot be assigned to a group');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e1', 'b1000000-0000-4000-8000-000000000061', daterange(current_date, null))$$, '23503', null, 'composite FK blocks an Alfa educator in a Beta group');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('b1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-0000000001e1', 'b1000000-0000-4000-8000-000000000061', daterange(current_date, null))$$, '42501', null, 'U1 cannot create assignments in Beta (NEG-01)');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e1', 'a1000000-0000-4000-8000-000000000051', daterange(current_date + 5, null))$$, '23P01', null, 'overlapping assignment of the same educator to the same group is rejected');
select throws_ok($$update public.staff_assignments set group_id = 'a1000000-0000-4000-8000-000000000052' where membership_id = 'a1000000-0000-4000-8000-0000000001e1'$$, '42501', null, 'the group of an assignment cannot be changed');
select is((select approved_by from public.staff_assignments where assignment_type = 'substitute' and membership_id = 'a1000000-0000-4000-8000-0000000001e1'), 'a1000000-0000-4000-8000-0000000000a1'::uuid, 'substitute approver is the caller, set by the database');
select ok((select count(*) from public.audit_events where target_table = 'staff_assignments' and action = 'staff_assignments.insert') >= 2, 'assignment creation is audited');
reset role;

select pg_temp.login('a1000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e3', 'a1000000-0000-4000-8000-000000000051', daterange(current_date + 30, null))$$, '42501', null, 'manager without MFA (AAL1) cannot assign staff');
reset role;

select pg_temp.login('b1000000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.staff_assignments where organization_id = 'a1000000-0000-4000-8000-00000000000a'), 0, 'Beta manager sees no Alfa assignments');
select is((select count(*)::int from public.groups where organization_id = 'a1000000-0000-4000-8000-00000000000a'), 0, 'Beta manager sees no Alfa groups');
reset role;

-- Staff assignments: educators -------------------------------------------------------------------------
select pg_temp.login('a1000000-0000-4000-8000-0000000000e1');
select results_eq('select name from public.groups order by name', array['S1', 'S2'], 'E1 sees exactly the groups assigned today (regular S1 + substitute S2)');
select is((select count(*)::int from public.staff_assignments), 2, 'E1 sees only own assignments');
select throws_ok($$insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000001e1', 'a1000000-0000-4000-8000-000000000051', daterange(current_date + 100, null))$$, '42501', null, 'educator cannot assign themselves (privilege escalation)');
select is_empty($$update public.staff_assignments set valid_during = daterange(current_date - 30, null) returning id$$, 'educator cannot extend own assignment');
reset role;

select pg_temp.login('a1000000-0000-4000-8000-0000000000e3');
select is((select count(*)::int from public.groups), 0, 'E3: substitute that ended yesterday and one starting tomorrow give no access today (NEG-08)');
reset role;

select pg_temp.login('a1000000-0000-4000-8000-0000000000f1');
select is((select count(*)::int from public.groups), 0, 'guardian sees no groups through staff policies');
reset role;

-- Ending an assignment revokes access on the next request (NEG-09)
select pg_temp.login('a1000000-0000-4000-8000-0000000000a1');
select lives_ok($$update public.staff_assignments set valid_during = daterange(lower(valid_during), current_date) where membership_id = 'a1000000-0000-4000-8000-0000000001e1' and group_id = 'a1000000-0000-4000-8000-000000000051'$$, 'U1 ends E1 assignment on S1 today');
reset role;
select pg_temp.login('a1000000-0000-4000-8000-0000000000e1');
select results_eq('select name from public.groups order by name', array['S2'], 'E1 immediately loses S1');
reset role;

-- Invitations -------------------------------------------------------------------------------------------
select pg_temp.login('a1000000-0000-4000-8000-0000000000d1');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'odg2@t.test', 'educator', 'Odg', 'Dva')$$, 'director D1 invites an educator');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'boss@t.test', 'org_admin', 'Bo', 'Ss')$$, '42501', null, 'a director cannot hand out org_admin rights (privilege escalation)');
reset role;
select pg_temp.login('a1000000-0000-4000-8000-0000000000a1');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'Novi@T.test', 'educator', 'Nova', 'Osoba')$$, 'U1 invites an educator');
select is((select created_by from public.invitations where email = 'novi@t.test'), 'a1000000-0000-4000-8000-0000000000a1'::uuid, 'creator is set by the database');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name, status) values ('a1000000-0000-4000-8000-00000000000a', 'x@t.test', 'educator', 'X', 'Y', 'accepted')$$, '42501', null, 'status cannot be set by the client');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'novi@t.test', 'educator', 'Nova', 'Osoba')$$, '23505', null, 'only one pending invitation per e-mail, role and kindergarten');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('b1000000-0000-4000-8000-00000000000b', 'uljez@t.test', 'org_admin', 'U', 'Ljez')$$, '42501', null, 'U1 cannot invite into Beta (NEG-01)');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'admin2@t.test', 'org_admin', 'Ad', 'Min')$$, 'an org_admin may invite another org_admin');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'opoziv@t.test', 'guardian', 'Op', 'Oziv')$$, 'U1 invites a guardian');
select lives_ok($$update public.invitations set status = 'revoked' where email = 'opoziv@t.test'$$, 'U1 revokes a pending invitation');
select throws_ok($$update public.invitations set status = 'pending' where email = 'opoziv@t.test'$$, '42501', null, 'a revoked invitation cannot be re-opened');
select throws_ok($$update public.invitations set status = 'accepted' where email = 'novi@t.test'$$, '42501', null, 'a client cannot mark an invitation accepted');
select throws_ok($$update public.invitations set email = 'drugi@t.test' where email = 'novi@t.test'$$, '42501', null, 'the invited e-mail cannot be changed');
select throws_ok($$select * from api.accept_invitations('c1000000-0000-4000-8000-00000000000c', 'novi@t.test')$$, '42501', null, 'authenticated users cannot call the acceptance function');
reset role;

select pg_temp.login('a1000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'aal1@t.test', 'org_admin', 'A', 'B')$$, '42501', null, 'manager without MFA cannot invite');
reset role;
select pg_temp.login('a1000000-0000-4000-8000-0000000000e1');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('a1000000-0000-4000-8000-00000000000a', 'boss@t.test', 'org_admin', 'B', 'Oss')$$, '42501', null, 'educator cannot invite (privilege escalation)');
select is((select count(*)::int from public.invitations), 0, 'educator sees no invitations');
reset role;
select pg_temp.login('b1000000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.invitations where organization_id = 'a1000000-0000-4000-8000-00000000000a'), 0, 'Beta manager sees no Alfa invitations');
reset role;

-- Expired and revoked invitations for the same person (created by the owner, as the service would)
insert into public.invitations (organization_id, email, role, first_name, last_name, created_by, created_at, expires_at) values
  ('a1000000-0000-4000-8000-00000000000a', 'novi@t.test', 'director', 'Nova', 'Osoba', 'a1000000-0000-4000-8000-0000000000a1', now() - interval '9 days', now() - interval '2 days');
insert into public.invitations (organization_id, email, role, first_name, last_name, created_by, status) values
  ('a1000000-0000-4000-8000-00000000000a', 'novi@t.test', 'org_admin', 'Nova', 'Osoba', 'a1000000-0000-4000-8000-0000000000a1', 'revoked');

-- Acceptance (as the Edge Function's service role) ----------------------------------------------------
set local role service_role;
select results_eq($$select role::text from api.accept_invitations('c1000000-0000-4000-8000-00000000000c', 'NOVI@t.test')$$, array['educator'], 'only the pending, unexpired invitation is accepted (expired and revoked are ignored)');
select is_empty($$select * from api.accept_invitations('c1000000-0000-4000-8000-00000000000c', 'novi@t.test')$$, 'an accepted invitation cannot be used again');
select throws_ok($$select * from api.accept_invitations('c1000000-0000-4000-8000-00000000000d', 'neprovjeren@t.test')$$, '42501', null, 'an unverified e-mail cannot accept');
select throws_ok($$select * from api.accept_invitations('c1000000-0000-4000-8000-00000000000c', 'ua@t.test')$$, '42501', null, 'a user cannot accept invitations addressed to another e-mail');
reset role;
select is((select role::text from public.memberships where profile_id = 'c1000000-0000-4000-8000-00000000000c'), 'educator', 'membership created with the invited role only');
select is((select first_name || ' ' || last_name from public.profiles where id = 'c1000000-0000-4000-8000-00000000000c'), 'Nova Osoba', 'profile created from the invitation, not from user metadata');
select ok(exists (select 1 from public.audit_events where action = 'invitation.accepted' and actor_id = 'c1000000-0000-4000-8000-00000000000c'), 'acceptance is audited with the accepting user');

select * from finish();
rollback;
