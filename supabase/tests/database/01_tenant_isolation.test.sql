-- NEG-01, NEG-02, NEG-09, NEG-10, NEG-11, NEG-13, NEG-15 for the D0 tables (security-requirements §11).
-- Own synthetic fixtures (kindergartens "Test Alfa"/"Test Beta"), independent of the demo seed. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- Fixtures (as postgres) -------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000a1', 'ua@t.test', 'authenticated', 'authenticated'), -- Alfa org_admin
  ('b0000000-0000-4000-8000-0000000000b1', 'ub@t.test', 'authenticated', 'authenticated'), -- Beta org_admin
  ('a0000000-0000-4000-8000-0000000000e1', 'ea@t.test', 'authenticated', 'authenticated'), -- Alfa educator
  ('a0000000-0000-4000-8000-0000000000f1', 'ga@t.test', 'authenticated', 'authenticated'), -- Alfa guardian
  ('c0000000-0000-4000-8000-000000000012', 'm12@t.test', 'authenticated', 'authenticated'), -- guardian in both
  ('a0000000-0000-4000-8000-0000000000e9', 'sx@t.test', 'authenticated', 'authenticated'), -- suspended educator
  ('a0000000-0000-4000-8000-0000000000d9', 'xx@t.test', 'authenticated', 'authenticated'), -- expired director
  ('f0000000-0000-4000-8000-0000000000f0', 'pa@t.test', 'authenticated', 'authenticated'); -- platform admin
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where email like '%@t.test';
insert into private.platform_admins (profile_id) values ('f0000000-0000-4000-8000-0000000000f0');

insert into public.organizations (id, name, slug) values
  ('a0000000-0000-4000-8000-00000000000a', 'Test Alfa', 'test-alfa'),
  ('b0000000-0000-4000-8000-00000000000b', 'Test Beta', 'test-beta');
-- Alfa publishes privacy notice v1 (FR-01-5); acknowledging it is tested below, its rules in 08_privacy_notice.
insert into public.privacy_notices (organization_id, version, title, body, is_demo) values
  ('a0000000-0000-4000-8000-00000000000a', 'v1', 'Obavijest (test)', 'Sintetički tekst za test.', true);
update public.organizations set privacy_notice_version = 'v1' where id = 'a0000000-0000-4000-8000-00000000000a';
insert into public.facilities (id, organization_id, name) values
  ('a0000000-0000-4000-8000-0000000000fa', 'a0000000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('b0000000-0000-4000-8000-0000000000fb', 'b0000000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('a0000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-00000000000a', '2026./2027.', '2026-09-01', '2027-08-31', 'active'),
  ('b0000000-0000-4000-8000-0000000000bb', 'b0000000-0000-4000-8000-00000000000b', '2026./2027.', '2026-09-01', '2027-08-31', 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('a0000000-0000-4000-8000-00000000006a', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000fa', 'a0000000-0000-4000-8000-0000000000aa', 'S1'),
  ('b0000000-0000-4000-8000-00000000006b', 'b0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-0000000000fb', 'b0000000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, status, valid_during) values
  ('a0000000-0000-4000-8000-0000000001a1', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('b0000000-0000-4000-8000-0000000001b1', 'b0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-0000000000b1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('a0000000-0000-4000-8000-0000000001e1', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000e1', 'educator', 'active', daterange(current_date - 30, null)),
  ('a0000000-0000-4000-8000-0000000001f1', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000f1', 'guardian', 'active', daterange(current_date - 30, null)),
  ('a0000000-0000-4000-8000-000000000112', 'a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000012', 'guardian', 'active', daterange(current_date - 30, null)),
  ('b0000000-0000-4000-8000-000000000112', 'b0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000012', 'guardian', 'active', daterange(current_date - 30, null)),
  ('a0000000-0000-4000-8000-0000000001e9', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000e9', 'educator', 'suspended', daterange(current_date - 30, null)),
  ('a0000000-0000-4000-8000-0000000001d9', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000d9', 'director', 'active', daterange(current_date - 30, current_date));

create function pg_temp.login(uid uuid, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Alfa manager (AAL2) ----------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-0000000000a1');
select results_eq('select slug from public.organizations order by slug', array['test-alfa'], 'U1 sees only own kindergarten');
select results_eq('select name from public.facilities order by name', array['Objekt A'], 'U1 sees only Alfa facilities');
select results_eq('select name from public.groups order by name', array['S1'], 'U1 sees only Alfa groups');
select is((select count(*)::int from public.memberships where organization_id = 'b0000000-0000-4000-8000-00000000000b'), 0, 'U1 sees no Beta memberships');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-4000-8000-0000000000b1'), 0, 'U1 cannot see Beta manager profile');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e1'), 1, 'U1 sees profiles of own members');
select throws_ok($$insert into public.facilities (organization_id, name) values ('b0000000-0000-4000-8000-00000000000b', 'Uljez')$$, '42501', null, 'U1 cannot create a facility in Beta (NEG-01)');
select is_empty($$update public.groups set name = 'Hijacked' where id = 'b0000000-0000-4000-8000-00000000006b' returning id$$, 'U1 cannot rename a Beta group (NEG-01)');
select throws_ok($$insert into public.groups (organization_id, facility_id, academic_year_id, name) values ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000fb', 'a0000000-0000-4000-8000-0000000000aa', 'Mix')$$, '23503', null, 'composite FK blocks Alfa group in Beta facility (SR-TEN-04)');
select throws_ok($$update public.facilities set organization_id = 'b0000000-0000-4000-8000-00000000000b' where id = 'a0000000-0000-4000-8000-0000000000fa'$$, '42501', null, 'organization_id cannot be updated');
select throws_ok($$delete from public.facilities where id = 'a0000000-0000-4000-8000-0000000000fa'$$, '42501', null, 'no DELETE grant');
select throws_ok($$insert into public.memberships (organization_id, profile_id, role) values ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1', 'director')$$, '42501', null, 'memberships cannot be inserted by clients');
select throws_ok($$update public.memberships set role = 'org_admin' where id = 'a0000000-0000-4000-8000-0000000001e1'$$, '42501', null, 'role cannot be changed through UPDATE');
select throws_ok($$update public.memberships set status = 'ended' where id = 'a0000000-0000-4000-8000-0000000001a1'$$, '42501', null, 'manager cannot change own membership (SR-AUTHZ-07, NEG-11)');
select throws_ok($$update public.organizations set slug = 'x-alfa' where id = 'a0000000-0000-4000-8000-00000000000a'$$, '42501', null, 'slug is not client-updatable');
select lives_ok($$update public.organizations set name = 'Test Alfa 2' where id = 'a0000000-0000-4000-8000-00000000000a'$$, 'U1 can rename own kindergarten');
select is_empty($$update public.organizations set name = 'Pwned' where id = 'b0000000-0000-4000-8000-00000000000b' returning id$$, 'U1 cannot rename Beta');
select lives_ok($$insert into public.facilities (organization_id, name) values ('a0000000-0000-4000-8000-00000000000a', 'Objekt Novi')$$, 'U1 can create a facility in Alfa');
select ok((select count(*) from public.audit_events where organization_id = 'a0000000-0000-4000-8000-00000000000a' and action = 'facilities.insert') >= 1, 'facility creation is audited');
select ok(not exists (select 1 from public.audit_events where details::text like '%Objekt Novi%'), 'audit holds no personal/content values');
select throws_ok($$update public.audit_events set action = 'x'$$, '42501', null, 'audit cannot be updated (NEG-13)');
select throws_ok($$delete from public.audit_events$$, '42501', null, 'audit cannot be deleted (NEG-13)');

-- Revocation takes effect on the next query (NEG-09)
select lives_ok($$update public.memberships set status = 'suspended' where id = 'a0000000-0000-4000-8000-0000000001e1'$$, 'U1 suspends educator E1');
reset role;
select pg_temp.login('a0000000-0000-4000-8000-0000000000e1');
select is((select count(*)::int from public.organizations), 0, 'suspended E1 sees nothing on the next request');
reset role;
update public.memberships set status = 'active' where id = 'a0000000-0000-4000-8000-0000000001e1';

-- Manager without MFA (AAL1) -----------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-0000000000a1', 'aal1');
select is((select count(*)::int from public.groups), 0, 'manager without AAL2 sees no groups (SR-AUTHN-07)');
select throws_ok($$insert into public.facilities (organization_id, name) values ('a0000000-0000-4000-8000-00000000000a', 'Bez MFA')$$, '42501', null, 'manager without AAL2 cannot write');
reset role;

-- Alfa educator ------------------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-0000000000e1');
select results_eq('select slug from public.organizations', array['test-alfa'], 'E1 sees own kindergarten');
select is((select count(*)::int from public.groups), 0, 'E1 sees no groups before assignments exist (deny by default)');
select is((select count(*)::int from public.memberships), 1, 'E1 sees only own membership');
select results_eq($$select split_part(last_name, '@', 1) from public.profiles order by 1$$, array['ea', 'ua'], 'E1 sees own profile and active staff colleagues only (no guardians, no suspended/expired staff)');
select throws_ok($$insert into public.facilities (organization_id, name) values ('a0000000-0000-4000-8000-00000000000a', 'X')$$, '42501', null, 'E1 cannot create facilities');
select throws_ok($$update public.memberships set status = 'ended' where id = 'a0000000-0000-4000-8000-0000000001e1'$$, '42501', null, 'E1 cannot change own membership status (NEG-11)');
select lives_ok($$update public.memberships set notice_ack_version = 'v1', notice_ack_at = now() where id = 'a0000000-0000-4000-8000-0000000001e1'$$, 'E1 can acknowledge the privacy notice');
reset role;

-- Alfa guardian ------------------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-0000000000f1');
select is((select count(*)::int from public.profiles where id <> 'a0000000-0000-4000-8000-0000000000f1'), 0, 'G1 sees no other people');
select lives_ok($$update public.profiles set first_name = 'Ivana' where id = 'a0000000-0000-4000-8000-0000000000f1'$$, 'G1 can edit own name');
select is_empty($$update public.profiles set first_name = 'Hack' where id = 'a0000000-0000-4000-8000-0000000000a1' returning id$$, 'G1 cannot edit another profile');
reset role;

-- Multi-kindergarten guardian (NEG-02) ---------------------------------------------------------------
select pg_temp.login('c0000000-0000-4000-8000-000000000012');
select results_eq('select slug from public.organizations order by slug', array['test-alfa', 'test-beta'], 'M12 sees both kindergartens');
select is((select count(*)::int from public.facilities f where not exists (select 1 from public.organizations o where o.id = f.organization_id)), 0, 'every facility M12 sees belongs to a kindergarten M12 belongs to');
reset role;

-- Suspended and expired memberships ----------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-0000000000e9');
select is((select count(*)::int from public.facilities), 0, 'suspended membership sees nothing');
reset role;
select pg_temp.login('a0000000-0000-4000-8000-0000000000d9');
select is((select count(*)::int from public.organizations), 0, 'expired membership (valid_to = today) sees nothing');
reset role;

-- Platform admin (NEG-10) ------------------------------------------------------------------------------
select pg_temp.login('f0000000-0000-4000-8000-0000000000f0');
select ok((select count(*) from public.organizations where slug in ('test-alfa', 'test-beta')) = 2, 'platform admin sees kindergarten list');
select is((select count(*)::int from public.memberships), 0, 'platform admin sees no memberships');
select is((select count(*)::int from public.profiles), 1, 'platform admin sees only own profile');
reset role;

-- Anonymous (NEG-15) ------------------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.organizations', '42501', null, 'anon cannot read organizations');
reset role;

select * from finish();
rollback;
