-- D2-C: access restrictions (migration 20261112113000_access_restrictions.sql). NEG-05: an active restriction on a link
-- removes every right of that link (view, report absence, receive messages) on the next request; future and ended
-- restrictions do not; other links and other guardians are unaffected; nobody but managers can read restrictions;
-- D-31 and D-32 keep working. Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2c00000-0000-4000-8000-0000000000' || x)::uuid, 'ogr-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'f1', 'f2', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2c00000-%';
insert into private.platform_admins (profile_id) values ('d2c00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d2c00000-0000-4000-8000-00000000000a', 'Test Ogranicenja A', 'test-ogr-a'),
  ('d2c00000-0000-4000-8000-00000000000b', 'Test Ogranicenja B', 'test-ogr-b');
insert into public.facilities (id, organization_id, name) values ('d2c00000-0000-4000-8000-0000000000fa', 'd2c00000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2c00000-0000-4000-8000-0000000000aa', 'd2c00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2c00000-0000-4000-8000-000000000051', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000fa', 'd2c00000-0000-4000-8000-0000000000aa', 'S1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during) values
  ('d2c00000-0000-4000-8000-0000000001a1', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000a1', 'org_admin', daterange(current_date - 30, null)),
  ('d2c00000-0000-4000-8000-0000000001e1', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000e1', 'educator', daterange(current_date - 30, null)),
  ('d2c00000-0000-4000-8000-0000000001f1', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000f1', 'guardian', daterange(current_date - 30, null)),
  ('d2c00000-0000-4000-8000-0000000001f2', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000f2', 'guardian', daterange(current_date - 30, null)),
  ('d2c00000-0000-4000-8000-0000000001b1', 'd2c00000-0000-4000-8000-00000000000b', 'd2c00000-0000-4000-8000-0000000000b1', 'org_admin', daterange(current_date - 30, null));
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000001e1', 'd2c00000-0000-4000-8000-000000000051', daterange(current_date - 30, null));
-- D1 in S1; D2 linked but without a group (D-32).
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2c00000-0000-4000-8000-0000000000d1', 'd2c00000-0000-4000-8000-00000000000a', 'Dijete', 'Jedan', null),
  ('d2c00000-0000-4000-8000-0000000000d2', 'd2c00000-0000-4000-8000-00000000000a', 'Dijete', 'Dva', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000d1', 'd2c00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2c00000-0000-4000-8000-000000000a01', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null),
  ('d2c00000-0000-4000-8000-000000000a02', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000f2', 'Bruno', 'Skrbnik', null);
-- L1: Ana–D1 (all rights), L2: Ana–D2 (view), L3: Bruno–D1 (all rights).
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d2c00000-0000-4000-8000-00000000c001', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000d1', 'd2c00000-0000-4000-8000-000000000a01', true, true, true, daterange(current_date - 30, null), null),
  ('d2c00000-0000-4000-8000-00000000c002', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000d2', 'd2c00000-0000-4000-8000-000000000a01', true, false, false, daterange(current_date - 30, null), null),
  ('d2c00000-0000-4000-8000-00000000c003', 'd2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-0000000000d1', 'd2c00000-0000-4000-8000-000000000a02', true, true, true, daterange(current_date - 30, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d2c00000-0000-4000-8000-0000000000' || x)::uuid $$;
-- What a guardian session can reach: visible children, children per right, links, enrolments, groups.
create function pg_temp.reach() returns text language sql as $$
  select concat_ws(' | ',
    'children=' || coalesce((select string_agg(last_name, ',' order by last_name) from public.children), ''),
    'view=' || (select count(*) from private.guardian_child_ids('can_view')),
    'absence=' || (select count(*) from private.guardian_child_ids('can_report_absence')),
    'messages=' || (select count(*) from private.guardian_child_ids('receives_messages')),
    'links=' || (select count(*) from public.child_guardians),
    'enrollments=' || (select count(*) from public.enrollments),
    'groups=' || (select count(*) from public.groups))
$$;
grant execute on function pg_temp.reach() to authenticated;

-- Catalog and grants -----------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.access_restrictions'::regclass), 'RLS is enabled on access_restrictions');
select ok(not has_table_privilege('anon', 'public.access_restrictions', 'SELECT'), 'anon reads no restriction');
select ok(not has_table_privilege('authenticated', 'public.access_restrictions', 'DELETE,TRUNCATE'), 'a restriction is ended, never deleted');
select ok(not has_column_privilege('authenticated', 'public.access_restrictions', 'scope', 'UPDATE') and not has_column_privilege('authenticated', 'public.access_restrictions', 'child_guardian_id', 'UPDATE'),
  'the link and scope of a restriction are not client-changeable');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'access_restrictions'
  and column_name ~* 'reason|razlog|court|sud|note|biljesk|text|opis'), 0, 'no column for a reason or court text (FR-04-5)');
select is((select array_agg(e::text) from unnest(enum_range(null::public.restriction_scope)) e), array['full'], 'only the full scope exists in D2');

-- Baseline without a restriction ---------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.reach(), 'children=Dva,Jedan | view=2 | absence=1 | messages=1 | links=2 | enrollments=1 | groups=1', 'Ana before any restriction: both children with their rights');
reset role;

-- Manager enters restrictions -------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, reference)
  values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c001', daterange(current_date, null), 'INT-2026-001')$$, 'a manager restricts the link Ana–D1 from today');
select is((select created_by::text || ' ' || scope::text from public.access_restrictions where reference = 'INT-2026-001'), 'd2c00000-0000-4000-8000-0000000000a1 full', 'creator and scope are set by the database');
select lives_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, reference)
  values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c003', daterange(current_date + 1, null), 'INT-2026-002')$$, 'a restriction for Bruno–D1 starting tomorrow');
select lives_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, reference)
  values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c002', daterange(current_date - 10, current_date), 'INT-2026-003')$$, 'a restriction for Ana–D2 that ended yesterday');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, reference)
  values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c002', daterange(current_date, null), repeat('x', 101))$$, '23514', null, 'the reference is limited to 100 characters');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, scope, valid_during) values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c002', 'full', daterange(current_date, null))$$,
  '42501', null, 'the scope is not client-chosen (column grant)');
select throws_ok($$update public.access_restrictions set child_guardian_id = 'd2c00000-0000-4000-8000-00000000c003' where reference = 'INT-2026-001'$$, '42501', null, 'a restriction cannot be moved to another link');
select throws_ok($$delete from public.access_restrictions where reference = 'INT-2026-001'$$, '42501', null, 'a manager cannot delete a restriction');
select is((select count(*)::int from public.access_restrictions), 3, 'the manager reads the restrictions of their kindergarten');
reset role;
select ok(exists (select 1 from audit.audit_events where target_table = 'access_restrictions' and action = 'access_restrictions.insert' and actor_role = 'org_admin'),
  'entering a restriction is audited with the actor role (FR-04-6)');
select ok(not exists (select 1 from audit.audit_events where target_table = 'access_restrictions' and details::text ~ 'INT-2026'), 'the audit holds no reference text');

select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c002', daterange(current_date, null))$$,
  '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot enter a restriction');
select is((select count(*)::int from public.access_restrictions), 0, 'a manager without MFA reads no restriction');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c002', daterange(current_date, null))$$,
  '42501', 'PERMISSION_DENIED', 'a B manager cannot restrict an A link (NEG-01)');
select is((select count(*)::int from public.access_restrictions), 0, 'a B manager reads no A restriction');
reset role;

-- The restricted guardian: everything through that link is gone; the other link stays (NEG-05) --------------------------
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.reach(), 'children=Dva | view=1 | absence=0 | messages=0 | links=1 | enrollments=0 | groups=0',
  'Ana: D1 is gone for viewing, absence reporting and messages; D2 (no group, ended restriction) stays');
select is((select count(*)::int from public.children where id = 'd2c00000-0000-4000-8000-0000000000d1'), 0, 'Ana cannot read D1 by id');
select is((select count(*)::int from public.child_guardians where id = 'd2c00000-0000-4000-8000-00000000c001'), 0, 'Ana does not see the restricted link (it would reveal the child)');
select is((select count(*)::int from public.access_restrictions), 0, 'Ana cannot read any restriction, not even her own');
select is((select count(*)::int from private.guardian_child_ids('can_report_absence') x where x = 'd2c00000-0000-4000-8000-0000000000d1'), 0, 'absence reporting for D1 is blocked although the right is set');
select is((select count(*)::int from private.guardian_child_ids('receives_messages') x where x = 'd2c00000-0000-4000-8000-0000000000d1'), 0, 'messages for D1 are blocked although the right is set');
select is((select count(*)::int from public.guardians), 1, 'Ana still sees her own guardian record (no child information)');
reset role;

-- Other guardian of the same child: unaffected, and does not see the restriction ------------------------------------------
select pg_temp.login(pg_temp.uid('f2'));
select is(pg_temp.reach(), 'children=Jedan | view=1 | absence=1 | messages=1 | links=1 | enrollments=1 | groups=1', 'Bruno keeps D1 with all rights (his restriction starts tomorrow)');
select is((select count(*)::int from public.access_restrictions), 0, 'Bruno does not see restrictions of another guardian (FR-04-6)');
select is((select count(*)::int from public.guardians), 1, 'Bruno sees only his own guardian record, not Ana');
reset role;

-- Educator (D-31 unchanged) and platform admin -------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select is((select string_agg(first_name, ',' order by first_name) from public.guardians), 'Ana,Bruno', 'the educator still sees the names of both guardians of D1 (D-31 unchanged)');
select is((select count(*)::int from public.child_guardians), 2, 'and their links to D1 with the stored rights (D-31 unchanged; see D-33)');
select is((select count(*)::int from public.access_restrictions), 0, 'the educator cannot read restrictions');
select throws_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c003', daterange(current_date, null))$$,
  '42501', 'PERMISSION_DENIED', 'the educator cannot enter a restriction');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select is((select count(*)::int from public.access_restrictions), 0, 'a platform admin reads no restriction (NEG-10)');
reset role;

-- Activity over time ----------------------------------------------------------------------------------------------------
-- The manager ends Ana's restriction: access returns immediately.
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$update public.access_restrictions set valid_during = daterange(current_date - 1, current_date) where reference = 'INT-2026-001'$$, 'the manager ends the restriction');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.reach(), 'children=Dva,Jedan | view=2 | absence=1 | messages=1 | links=2 | enrollments=1 | groups=1', 'Ana has both children with their rights again on the next request');
reset role;
-- The restriction on Bruno becomes active (moved to start today, as if a day passed).
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$update public.access_restrictions set valid_during = daterange(current_date, null) where reference = 'INT-2026-002'$$, 'Bruno''s restriction starts today');
reset role;
select pg_temp.login(pg_temp.uid('f2'));
select is(pg_temp.reach(), 'children= | view=0 | absence=0 | messages=0 | links=0 | enrollments=0 | groups=0', 'Bruno loses everything as soon as his restriction is active');
reset role;
-- A restriction on a link to a child without a group (D-32) works the same.
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during) values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c002', daterange(current_date, current_date + 30))$$,
  'a bounded restriction on Ana–D2 (child without a group)');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.reach(), 'children=Jedan | view=1 | absence=1 | messages=1 | links=1 | enrollments=1 | groups=1', 'Ana loses D2 (no group, D-32) and keeps D1');
reset role;
-- Two links (Ana–D1 and Bruno–D1) restricted at once never affect a third party: rights stored on the links are unchanged.
select is((select string_agg(can_view::text || can_report_absence::text || receives_messages::text, ',' order by id) from public.child_guardians where organization_id = 'd2c00000-0000-4000-8000-00000000000a'),
  'truetruetrue,truefalsefalse,truetruetrue', 'restrictions never rewrite the rights stored on the links');
-- One restriction per check: more than one active restriction on a link is harmless.
select lives_ok($$insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values ('d2c00000-0000-4000-8000-00000000000a', 'd2c00000-0000-4000-8000-00000000c003', daterange(current_date - 1, null), null)$$, 'a second restriction on Bruno–D1 (overlap allowed)');
select pg_temp.login(pg_temp.uid('f2'));
select is(pg_temp.reach(), 'children= | view=0 | absence=0 | messages=0 | links=0 | enrollments=0 | groups=0', 'Bruno still has nothing');
reset role;
select is((select count(*)::int from audit.audit_events where target_table = 'access_restrictions' and organization_id = 'd2c00000-0000-4000-8000-00000000000a'), 7,
  'every insert (5) and change (2) of a restriction is audited');

select * from finish();
rollback;
