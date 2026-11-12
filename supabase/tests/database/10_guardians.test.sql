-- D2-B: guardians and guardian–child links (migration 20261112102000_guardians.sql).
-- Several guardians per child, several children per guardian, rights per link, D-31 (educators: names and rights of
-- guardians of children in their groups today, nothing else), D-32 (a linked child without a group is visible),
-- NEG-01/03/04/06/09/10/11, accepted invitation / membership without a link gives nothing. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

-- Fixtures ------------------------------------------------------------------------------------------------------
-- People: manager A, educators E1 (S1) and E2 (S2), guardian accounts G1…G6, a B manager and B guardian, platform admin.
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2b00000-0000-4000-8000-0000000000' || x)::uuid, 'gu-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'b1', 'bf', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2b00000-%';
insert into private.platform_admins (profile_id) values ('d2b00000-0000-4000-8000-0000000000c1');

insert into public.organizations (id, name, slug) values
  ('d2b00000-0000-4000-8000-00000000000a', 'Test Skrbnici A', 'test-skrb-a'),
  ('d2b00000-0000-4000-8000-00000000000b', 'Test Skrbnici B', 'test-skrb-b');
insert into public.facilities (id, organization_id, name) values
  ('d2b00000-0000-4000-8000-0000000000fa', 'd2b00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d2b00000-0000-4000-8000-0000000000fb', 'd2b00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2b00000-0000-4000-8000-0000000000aa', 'd2b00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d2b00000-0000-4000-8000-0000000000bb', 'd2b00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2b00000-0000-4000-8000-000000000051', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000fa', 'd2b00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d2b00000-0000-4000-8000-000000000052', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000fa', 'd2b00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d2b00000-0000-4000-8000-000000000061', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000fb', 'd2b00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, status, valid_during) values
  ('d2b00000-0000-4000-8000-0000000001a1', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000a1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001e1', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000e1', 'educator', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001e2', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000e2', 'educator', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001f1', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f1', 'guardian', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001f2', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f2', 'guardian', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001f3', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f3', 'guardian', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001f4', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f4', 'guardian', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001f5', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f5', 'guardian', 'suspended', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001f6', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f6', 'guardian', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001b1', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000b1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-0000000001bf', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000bf', 'guardian', 'active', daterange(current_date - 30, null));
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000001e1', 'd2b00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000001e2', 'd2b00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- Children: D1 (S1), D2 (S2), D3 (S1), D4 (no group, D-32), DB (B1).
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2b00000-0000-4000-8000-0000000000d1', 'd2b00000-0000-4000-8000-00000000000a', 'Dijete', 'Jedan', null),
  ('d2b00000-0000-4000-8000-0000000000d2', 'd2b00000-0000-4000-8000-00000000000a', 'Dijete', 'Dva', null),
  ('d2b00000-0000-4000-8000-0000000000d3', 'd2b00000-0000-4000-8000-00000000000a', 'Dijete', 'Tri', null),
  ('d2b00000-0000-4000-8000-0000000000d4', 'd2b00000-0000-4000-8000-00000000000a', 'Dijete', 'Četiri', null),
  ('d2b00000-0000-4000-8000-0000000000db', 'd2b00000-0000-4000-8000-00000000000b', 'Dijete', 'Beta', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d1', 'd2b00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d2', 'd2b00000-0000-4000-8000-000000000052', daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d3', 'd2b00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000db', 'd2b00000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);
-- Guardian records: Ana (G1 account), Bruno (G2, link without can_view), Cvita (G4, link expired), Dora (G5, membership
-- suspended), Ema (G6, record ended), Fran (no account yet, second guardian of D1), Gita (D2 in S2), Beta guardian.
-- G3 has an active guardian membership (e.g. an accepted invitation) but no guardian record and no link.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, status, created_by) values
  ('d2b00000-0000-4000-8000-000000000a01', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', 'active', null),
  ('d2b00000-0000-4000-8000-000000000a02', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f2', 'Bruno', 'Skrbnik', 'active', null),
  ('d2b00000-0000-4000-8000-000000000a04', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f4', 'Cvita', 'Skrbnik', 'active', null),
  ('d2b00000-0000-4000-8000-000000000a05', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f5', 'Dora', 'Skrbnik', 'active', null),
  ('d2b00000-0000-4000-8000-000000000a06', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f6', 'Ema', 'Skrbnik', 'ended', null),
  ('d2b00000-0000-4000-8000-000000000a07', 'd2b00000-0000-4000-8000-00000000000a', null, 'Fran', 'Skrbnik', 'active', null),
  ('d2b00000-0000-4000-8000-000000000a08', 'd2b00000-0000-4000-8000-00000000000a', null, 'Gita', 'Skrbnik', 'active', null),
  ('d2b00000-0000-4000-8000-000000000b01', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000bf', 'Beta', 'Skrbnik', 'active', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d2b00000-0000-4000-8000-00000000c101', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d1', 'd2b00000-0000-4000-8000-000000000a01', true, true, true, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c104', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d4', 'd2b00000-0000-4000-8000-000000000a01', true, false, false, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c201', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d1', 'd2b00000-0000-4000-8000-000000000a02', false, false, false, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c403', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d3', 'd2b00000-0000-4000-8000-000000000a04', true, true, false, daterange(current_date - 30, current_date), null),
  ('d2b00000-0000-4000-8000-00000000c503', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d3', 'd2b00000-0000-4000-8000-000000000a05', true, false, false, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c603', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d3', 'd2b00000-0000-4000-8000-000000000a06', true, false, false, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c701', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d1', 'd2b00000-0000-4000-8000-000000000a07', true, false, true, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c802', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d2', 'd2b00000-0000-4000-8000-000000000a08', true, true, true, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000cb01', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000db', 'd2b00000-0000-4000-8000-000000000b01', true, true, true, daterange(current_date - 30, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.children() returns text language sql as $$
  select coalesce(string_agg(last_name, ',' order by last_name), '') from public.children
$$;
create function pg_temp.guardians() returns text language sql as $$
  select coalesce(string_agg(first_name, ',' order by first_name), '') from public.guardians
$$;
grant execute on function pg_temp.children(), pg_temp.guardians() to authenticated;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d2b00000-0000-4000-8000-0000000000' || x)::uuid $$;

-- Catalog and grants ---------------------------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.guardians'::regclass, 'public.child_guardians'::regclass)), 'RLS is enabled on guardians and child_guardians');
select ok(not has_table_privilege('anon', 'public.guardians', 'SELECT') and not has_table_privilege('anon', 'public.child_guardians', 'SELECT'), 'anon reads nothing');
select ok(not has_table_privilege('authenticated', 'public.guardians', 'DELETE,TRUNCATE') and not has_table_privilege('authenticated', 'public.child_guardians', 'DELETE,TRUNCATE'), 'nothing can be deleted by a client');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'guardians'
  and column_name ~* 'mail|phone|telefon|address|adres|oib|birth'), 0, 'guardian records hold no contact data at all (D-31)');
select ok(not has_column_privilege('authenticated', 'public.guardians', 'profile_id', 'SELECT') and not has_column_privilege('authenticated', 'public.guardians', 'created_by', 'SELECT'),
  'no client reads the account link or creator of a guardian record (D-31: names only)');
select ok(not has_column_privilege('authenticated', 'public.guardians', 'profile_id', 'UPDATE') and not has_column_privilege('authenticated', 'public.guardians', 'profile_id', 'INSERT'),
  'no client can attach an account to a guardian record');

-- Manager (AAL2) ---------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select is(pg_temp.guardians(), 'Ana,Bruno,Cvita,Dora,Ema,Fran,Gita', 'A manager sees all A guardian records and no B record (NEG-01)');
select is((select count(*)::int from public.child_guardians where organization_id = 'd2b00000-0000-4000-8000-00000000000b'), 0, 'A manager sees no B link');
select lives_ok($$insert into public.guardians (organization_id, first_name, last_name) values ('d2b00000-0000-4000-8000-00000000000a', 'Hana', 'Nova')$$, 'A manager creates a guardian record');
select is((select status::text from public.guardians where first_name = 'Hana'), 'active', 'status is set by the database');
select throws_ok($$insert into public.guardians (organization_id, first_name, last_name, profile_id) values ('d2b00000-0000-4000-8000-00000000000a', 'Iva', 'Krivo', 'd2b00000-0000-4000-8000-0000000000f3')$$,
  '42501', null, 'a manager cannot attach an account to a guardian (only the acceptance flow can)');
select throws_ok($$insert into public.guardians (organization_id, first_name, last_name) values ('d2b00000-0000-4000-8000-00000000000b', 'Uljez', 'B')$$, '42501', 'PERMISSION_DENIED', 'A manager cannot create a guardian in B');
-- Several guardians per child and several children per guardian, rights per link.
select lives_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, can_report_absence, valid_during)
  values ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d2', (select id from public.guardians where first_name = 'Hana'), true, true, daterange(current_date, null))$$,
  'A manager links Hana to D2 (D2 then has two guardians)');
select lives_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during)
  values ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d3', (select id from public.guardians where first_name = 'Hana'), true, daterange(current_date, null))$$,
  'and to D3 (Hana then has two children, with different rights)');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, valid_during)
  values ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d2', (select id from public.guardians where first_name = 'Hana'), daterange(current_date + 5, null))$$,
  '23P01', null, 'the same guardian cannot be linked twice to the same child for overlapping periods');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, receives_messages, valid_during)
  values ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d4', (select id from public.guardians where first_name = 'Hana'), false, true, daterange(current_date, null))$$,
  '23514', null, 'acting for a child requires the right to view it');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, valid_during)
  values ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d1', 'd2b00000-0000-4000-8000-000000000b01', daterange(current_date, null))$$,
  '23503', null, 'a B guardian cannot be linked to an A child (composite FK)');
select throws_ok($$update public.child_guardians set child_id = 'd2b00000-0000-4000-8000-0000000000d2' where id = 'd2b00000-0000-4000-8000-00000000c101'$$,
  '42501', null, 'the child or guardian of a link never changes');
select lives_ok($$update public.child_guardians set can_report_absence = false where id = 'd2b00000-0000-4000-8000-00000000c104'$$, 'A manager changes the rights of one link');
select throws_ok($$delete from public.child_guardians where id = 'd2b00000-0000-4000-8000-00000000c104'$$, '42501', null, 'a link is ended, never deleted');
reset role;
select ok((select count(*) from audit.audit_events where target_table in ('guardians', 'child_guardians') and actor_id = pg_temp.uid('a1') and actor_role = 'org_admin') >= 4,
  'guardian records and links are audited with the actor role');
select ok(not exists (select 1 from audit.audit_events where target_table in ('guardians', 'child_guardians') and details::text ~ 'Hana|Nova|Skrbnik'), 'the audit holds no names');

select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select is(pg_temp.guardians(), '', 'a manager without MFA sees no guardian');
reset role;

-- Guardians ----------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.children(), 'Četiri,Jedan', 'G1 sees exactly the children linked to them: D1 (in a group) and D4 (no group yet, D-32)');
select is((select string_agg(g.name, ',') from public.groups g), 'S1', 'G1 sees only the current group of their child (FR-04-8), not other groups');
select is((select count(*)::int from public.enrollments), 1, 'G1 sees only the current enrolment of their child');
select is((select count(*)::int from public.child_guardians), 2, 'G1 sees only their own links (not the other guardians of D1)');
select is(pg_temp.guardians(), 'Ana', 'G1 sees only their own guardian record (FR-04-9: not other guardians)');
select is((select count(*)::int from public.children where id = 'd2b00000-0000-4000-8000-0000000000d3'), 0, 'G1 cannot see another child of the same group by id (NEG-03, FR-04-9)');
select is_empty($$update public.child_guardians set can_report_absence = true where id = 'd2b00000-0000-4000-8000-00000000c104' returning id$$, 'G1 cannot change the rights of their own link (NEG-11)');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, valid_during) values ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000d3', 'd2b00000-0000-4000-8000-000000000a01', daterange(current_date, null))$$,
  '42501', 'PERMISSION_DENIED', 'G1 cannot link themselves to another child');
select is((select count(*)::int from private.guardian_child_ids('can_report_absence')), 1, 'rights are per link: G1 may report absences for D1 only');
select is((select count(*)::int from private.guardian_child_ids('nepostojece')), 0, 'an unknown right grants nothing (fail closed)');
reset role;
select pg_temp.login(pg_temp.uid('f2'));
select is(pg_temp.children(), '', 'a link without can_view shows no child (NEG-04)');
reset role;
select pg_temp.login(pg_temp.uid('f3'));
select is(pg_temp.children() || pg_temp.guardians() || (select count(*)::text from public.child_guardians), '0',
  'an active guardian membership without a link (e.g. an accepted invitation) gives access to nothing');
reset role;
select pg_temp.login(pg_temp.uid('f4'));
select is(pg_temp.children(), '', 'a link that ended yesterday gives nothing (NEG-06)');
reset role;
select pg_temp.login(pg_temp.uid('f5'));
select is(pg_temp.children(), '', 'a suspended guardian membership gives nothing (NEG-09)');
reset role;
select pg_temp.login(pg_temp.uid('f6'));
select is(pg_temp.children(), '', 'an ended guardian record gives nothing');
reset role;
select pg_temp.login(pg_temp.uid('bf'));
select is(pg_temp.children(), 'Beta', 'a B guardian sees only the B child (NEG-01)');
reset role;

-- Educators (D-31) -----------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.guardians(), 'Ana,Bruno,Dora,Fran,Hana', 'E1 sees the names of guardians with a current link to children of S1 (D1, D3), active records only');
select ok(not exists (select 1 from public.guardians where first_name in ('Cvita', 'Ema', 'Gita', 'Beta')), 'E1 does not see guardians of other groups, expired links, ended records or other kindergartens');
select is((select count(*)::int from public.child_guardians where child_id = 'd2b00000-0000-4000-8000-0000000000d4'), 0, 'E1 does not see links of a child outside their groups (D4 has no group)');
select is((select string_agg(can_view::text || '/' || can_report_absence::text, ',' order by id) from public.child_guardians where child_id = 'd2b00000-0000-4000-8000-0000000000d1'),
  'true/true,false/false,true/false', 'E1 sees the rights of each guardian for D1');
select throws_ok($$select profile_id from public.guardians$$, '42501', null, 'E1 cannot read the account link of a guardian');
select is_empty($$update public.guardians set first_name = 'X' returning id$$, 'E1 cannot change guardian records');
select is_empty($$update public.child_guardians set can_view = false returning id$$, 'E1 cannot change rights');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.guardians(), 'Gita,Hana', 'E2 sees only the guardians of S2');
reset role;
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date) where membership_id = 'd2b00000-0000-4000-8000-0000000001e1';
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.guardians() || (select count(*)::text from public.child_guardians), '0', 'after the assignment ends E1 sees no guardian and no link');
reset role;

-- Platform admin -----------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select is(pg_temp.guardians() || (select count(*)::text from public.child_guardians), '0', 'a platform admin reads no guardian and no link (NEG-10)');
reset role;

-- Server-side attach (acceptance flow, D2-F) keeps one account per kindergarten -------------------------------------
select throws_ok($$update public.guardians set profile_id = 'd2b00000-0000-4000-8000-0000000000f1' where id = 'd2b00000-0000-4000-8000-000000000a07'$$,
  '23505', null, 'one account cannot be attached to two guardian records of the same kindergarten');

select * from finish();
rollback;
