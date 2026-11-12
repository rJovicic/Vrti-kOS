-- R-52: cross-tenant reads of academic_years and audit_events (NEG-01). Every role of kindergarten A reads its own
-- rows and none of kindergarten B's, and vice versa. Positive controls prove the queries can see rows at all.
-- Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures ------------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('e5200000-0000-4000-8000-0000000000a1', 'r52-uprava-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5200000-0000-4000-8000-0000000000a2', 'r52-odgojitelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5200000-0000-4000-8000-0000000000a3', 'r52-roditelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5200000-0000-4000-8000-0000000000b1', 'r52-uprava-b@t.test', 'authenticated', 'authenticated', now()),
  ('e5200000-0000-4000-8000-0000000000c1', 'r52-platforma@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where id::text like 'e5200000-%';
insert into private.platform_admins (profile_id) values ('e5200000-0000-4000-8000-0000000000c1');

insert into public.organizations (id, name, slug) values
  ('e5200000-0000-4000-8000-00000000000a', 'Test R52 A', 'test-r52-a'),
  ('e5200000-0000-4000-8000-00000000000b', 'Test R52 B', 'test-r52-b');
insert into public.academic_years (organization_id, name, starts_on, ends_on, status) values
  ('e5200000-0000-4000-8000-00000000000a', 'A 2026./2027.', current_date - 60, current_date + 300, 'active'),
  ('e5200000-0000-4000-8000-00000000000a', 'A 2025./2026.', current_date - 425, current_date - 61, 'closed'),
  ('e5200000-0000-4000-8000-00000000000b', 'B 2026./2027.', current_date - 60, current_date + 300, 'active');
insert into public.memberships (organization_id, profile_id, role, valid_during) values
  ('e5200000-0000-4000-8000-00000000000a', 'e5200000-0000-4000-8000-0000000000a1', 'org_admin', daterange(current_date - 30, null)),
  ('e5200000-0000-4000-8000-00000000000a', 'e5200000-0000-4000-8000-0000000000a2', 'educator', daterange(current_date - 30, null)),
  ('e5200000-0000-4000-8000-00000000000a', 'e5200000-0000-4000-8000-0000000000a3', 'guardian', daterange(current_date - 30, null)),
  ('e5200000-0000-4000-8000-00000000000b', 'e5200000-0000-4000-8000-0000000000b1', 'org_admin', daterange(current_date - 30, null));
-- Audit rows: the inserts above were audited by triggers; add one explicit row per kindergarten as well.
insert into public.audit_events (organization_id, action, target_table, details) values
  ('e5200000-0000-4000-8000-00000000000a', 'test.r52', 'academic_years', '{}'),
  ('e5200000-0000-4000-8000-00000000000b', 'test.r52', 'academic_years', '{}');

create function pg_temp.login(uid uuid, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Manager of A (AAL2) --------------------------------------------------------------------------------------------
select pg_temp.login('e5200000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.academic_years where organization_id = 'e5200000-0000-4000-8000-00000000000a'), 2, 'A manager reads A academic years (positive control)');
select is((select count(*)::int from public.academic_years where organization_id = 'e5200000-0000-4000-8000-00000000000b'), 0, 'A manager reads no B academic years');
select ok((select count(*) from public.audit_events where organization_id = 'e5200000-0000-4000-8000-00000000000a') >= 1, 'A manager reads A audit events (positive control)');
select is((select count(*)::int from public.audit_events where organization_id = 'e5200000-0000-4000-8000-00000000000b'), 0, 'A manager reads no B audit events');
select is((select count(*)::int from public.audit_events where organization_id is distinct from 'e5200000-0000-4000-8000-00000000000a'), 0,
  'A manager reads only A audit events (no other kindergarten, no global rows)');
reset role;

-- Manager of B (AAL2), the other direction ------------------------------------------------------------------------
select pg_temp.login('e5200000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.academic_years where organization_id = 'e5200000-0000-4000-8000-00000000000a'), 0, 'B manager reads no A academic years');
select is((select count(*)::int from public.audit_events where organization_id = 'e5200000-0000-4000-8000-00000000000a'), 0, 'B manager reads no A audit events');
select results_eq($$select name from public.academic_years$$, array['B 2026./2027.'], 'B manager sees exactly the B academic year');
reset role;

-- Non-manager members of A ----------------------------------------------------------------------------------------
select pg_temp.login('e5200000-0000-4000-8000-0000000000a2', 'aal1');
select is((select count(*)::int from public.academic_years where organization_id = 'e5200000-0000-4000-8000-00000000000b'), 0, 'A educator reads no B academic years');
select is((select count(*)::int from public.academic_years), 2, 'A educator reads A academic years (positive control)');
select is((select count(*)::int from public.audit_events), 0, 'an educator reads no audit events at all');
reset role;
select pg_temp.login('e5200000-0000-4000-8000-0000000000a3', 'aal1');
select is((select count(*)::int from public.academic_years where organization_id = 'e5200000-0000-4000-8000-00000000000b'), 0, 'A guardian reads no B academic years');
select is((select count(*)::int from public.audit_events), 0, 'a guardian reads no audit events at all');
reset role;

-- A manager without MFA, and a platform admin ------------------------------------------------------------------
select pg_temp.login('e5200000-0000-4000-8000-0000000000a1', 'aal1');
select is((select count(*)::int from public.audit_events), 0, 'an A manager without MFA (AAL1) reads no audit events');
reset role;
select pg_temp.login('e5200000-0000-4000-8000-0000000000c1');
select is((select count(*)::int from public.academic_years where organization_id in ('e5200000-0000-4000-8000-00000000000a', 'e5200000-0000-4000-8000-00000000000b')),
  0, 'a platform admin reads no kindergarten academic years');
select is((select count(*)::int from public.audit_events where target_table <> 'organizations'), 0,
  'a platform admin reads only organization configuration events, no kindergarten activity');
reset role;

select * from finish();
rollback;
