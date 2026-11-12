-- D2-D: persons authorized to pick up a child (migration 20261112120000_pickup_authorizations.sql). FR-04-7 (name and
-- validity per child, no account, no contact data), FR-04-8 (guardians read only, managers maintain), D-31 scope for
-- educators, restrictions hide the list from the restricted guardian, no other role gains access. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2d00000-0000-4000-8000-0000000000' || x)::uuid, 'pr-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f2', 'f3', 'b1', 'bf', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2d00000-%';
insert into private.platform_admins (profile_id) values ('d2d00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d2d00000-0000-4000-8000-00000000000a', 'Test Preuzimanje A', 'test-pr-a'),
  ('d2d00000-0000-4000-8000-00000000000b', 'Test Preuzimanje B', 'test-pr-b');
insert into public.facilities (id, organization_id, name) values
  ('d2d00000-0000-4000-8000-0000000000fa', 'd2d00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d2d00000-0000-4000-8000-0000000000fb', 'd2d00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2d00000-0000-4000-8000-0000000000aa', 'd2d00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d2d00000-0000-4000-8000-0000000000bb', 'd2d00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2d00000-0000-4000-8000-000000000051', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000fa', 'd2d00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d2d00000-0000-4000-8000-000000000052', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000fa', 'd2d00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d2d00000-0000-4000-8000-000000000061', 'd2d00000-0000-4000-8000-00000000000b', 'd2d00000-0000-4000-8000-0000000000fb', 'd2d00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d2d00000-0000-4000-8000-0000000001' || x)::uuid, ('d2d00000-0000-4000-8000-00000000000' || o)::uuid, ('d2d00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f2', 'a', 'guardian'), ('f3', 'a', 'guardian'),
             ('b1', 'b', 'org_admin'), ('bf', 'b', 'guardian')) v(x, o, r);
insert into public.staff_assignments (id, organization_id, membership_id, group_id, valid_during) values
  ('d2d00000-0000-4000-8000-00000000a5e1', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000001e1', 'd2d00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d2d00000-0000-4000-8000-00000000a5e2', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000001e2', 'd2d00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- D1 in S1, D2 in S2, D3 without a group (D-32), DB in B1.
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2d00000-0000-4000-8000-0000000000d1', 'd2d00000-0000-4000-8000-00000000000a', 'Dijete', 'Jedan', null),
  ('d2d00000-0000-4000-8000-0000000000d2', 'd2d00000-0000-4000-8000-00000000000a', 'Dijete', 'Dva', null),
  ('d2d00000-0000-4000-8000-0000000000d3', 'd2d00000-0000-4000-8000-00000000000a', 'Dijete', 'Tri', null),
  ('d2d00000-0000-4000-8000-0000000000db', 'd2d00000-0000-4000-8000-00000000000b', 'Dijete', 'Beta', null);
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d2d00000-0000-4000-8000-0000000000e1', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'd2d00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d2d00000-0000-4000-8000-0000000000e2', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d2', 'd2d00000-0000-4000-8000-000000000052', daterange(current_date - 30, null), null),
  ('d2d00000-0000-4000-8000-0000000000eb', 'd2d00000-0000-4000-8000-00000000000b', 'd2d00000-0000-4000-8000-0000000000db', 'd2d00000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);
-- Guardians: Ana (D1 + D3, can_view), Bruno (D1 without can_view), Cvita (D1, restricted), Beta guardian (DB).
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2d00000-0000-4000-8000-000000000a01', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null),
  ('d2d00000-0000-4000-8000-000000000a02', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000f2', 'Bruno', 'Skrbnik', null),
  ('d2d00000-0000-4000-8000-000000000a03', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000f3', 'Cvita', 'Skrbnik', null),
  ('d2d00000-0000-4000-8000-000000000b01', 'd2d00000-0000-4000-8000-00000000000b', 'd2d00000-0000-4000-8000-0000000000bf', 'Beta', 'Skrbnik', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d2d00000-0000-4000-8000-00000000c011', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'd2d00000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d2d00000-0000-4000-8000-00000000c013', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d3', 'd2d00000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d2d00000-0000-4000-8000-00000000c021', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'd2d00000-0000-4000-8000-000000000a02', false, daterange(current_date - 30, null), null),
  ('d2d00000-0000-4000-8000-00000000c031', 'd2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'd2d00000-0000-4000-8000-000000000a03', true, daterange(current_date - 30, null), null),
  ('d2d00000-0000-4000-8000-00000000c0b1', 'd2d00000-0000-4000-8000-00000000000b', 'd2d00000-0000-4000-8000-0000000000db', 'd2d00000-0000-4000-8000-000000000b01', true, daterange(current_date - 30, null), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-00000000c031', daterange(current_date, null), null);
-- Authorizations: D1 today (Mara), D1 ended yesterday (Stari), D1 from tomorrow (Buduci), D2 today (Iva), D3 today (Lovro), DB today (Beta).
insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'Mara', 'Baka', daterange(current_date - 10, null), null),
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'Stari', 'Ovlasteni', daterange(current_date - 10, current_date), null),
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'Buduci', 'Ovlasteni', daterange(current_date + 1, null), null),
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d2', 'Iva', 'Teta', daterange(current_date - 10, null), null),
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d3', 'Lovro', 'Djed', daterange(current_date - 10, null), null),
  ('d2d00000-0000-4000-8000-00000000000b', 'd2d00000-0000-4000-8000-0000000000db', 'Beta', 'Ovlasteni', daterange(current_date - 10, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d2d00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.names() returns text language sql as $$
  select coalesce(string_agg(first_name, ',' order by first_name), '') from public.pickup_authorizations
$$;
grant execute on function pg_temp.names() to authenticated;

-- Catalog and grants ---------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.pickup_authorizations'::regclass), 'RLS is enabled on pickup_authorizations');
select ok(not has_table_privilege('anon', 'public.pickup_authorizations', 'SELECT'), 'anon reads nothing');
select ok(not has_table_privilege('authenticated', 'public.pickup_authorizations', 'DELETE,TRUNCATE'), 'an authorization is ended, never deleted');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'pickup_authorizations'
  and column_name ~* 'phone|telefon|mail|address|adres|relation|odnos|oib|document|dokument|photo'), 0, 'no contact data, relationship or documents are stored (Q-T13 open)');
select ok(not has_column_privilege('authenticated', 'public.pickup_authorizations', 'created_by', 'SELECT'), 'no client reads who entered an authorization');
select ok(not has_column_privilege('authenticated', 'public.pickup_authorizations', 'child_id', 'UPDATE'), 'an authorization cannot be moved to another child');

-- Manager (AAL2) -------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select is(pg_temp.names(), 'Buduci,Iva,Lovro,Mara,Stari', 'A manager sees all A authorizations incl. past and future, no B (NEG-01)');
select lives_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'Nova', 'Osoba', daterange(current_date, current_date + 30))$$, 'A manager adds a bounded authorization');
reset role;
select is((select created_by from public.pickup_authorizations where first_name = 'Nova'), pg_temp.uid('a1'), 'the creator is set by the database');
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', '', 'X', daterange(current_date, null))$$, '23514', null, 'an empty name is rejected');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000db', 'Krivo', 'Dijete', daterange(current_date, null))$$, '23503', null, 'an A authorization cannot name a B child (composite FK)');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000b', 'd2d00000-0000-4000-8000-0000000000db', 'Uljez', 'A', daterange(current_date, null))$$, '42501', 'PERMISSION_DENIED', 'A manager cannot authorize in B');
select throws_ok($$update public.pickup_authorizations set child_id = 'd2d00000-0000-4000-8000-0000000000d2' where first_name = 'Mara'$$, '42501', null, 'the child of an authorization never changes');
select lives_ok($$update public.pickup_authorizations set valid_during = daterange(current_date - 10, current_date + 60) where first_name = 'Mara'$$, 'A manager limits an authorization in time');
select throws_ok($$delete from public.pickup_authorizations where first_name = 'Nova'$$, '42501', null, 'a manager cannot delete an authorization');
reset role;
select ok((select count(*) from audit.audit_events where target_table = 'pickup_authorizations' and actor_id = pg_temp.uid('a1') and actor_role = 'org_admin') >= 2,
  'authorizations are audited with the actor role');
select ok(not exists (select 1 from audit.audit_events where target_table = 'pickup_authorizations' and details::text ~ 'Nova|Osoba|Mara'), 'the audit holds no names');
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select is(pg_temp.names(), '', 'a manager without MFA sees nothing');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'Bez', 'MFA', daterange(current_date, null))$$, '42501', 'PERMISSION_DENIED', 'and cannot add an authorization');
reset role;

-- Guardians (read only, FR-04-8) ----------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.names(), 'Lovro,Mara,Nova', 'Ana sees the current authorizations of her children (D1, and D3 without a group), not past or future ones');
select is((select count(*)::int from public.pickup_authorizations where child_id = 'd2d00000-0000-4000-8000-0000000000d2'), 0, 'Ana sees nothing for a child she is not linked to (FR-04-9)');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'Moja', 'Prijateljica', daterange(current_date, null))$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot add a person in the MVP (FR-04-8)');
select is_empty($$update public.pickup_authorizations set last_name = 'Promjena' returning id$$, 'a guardian cannot change an authorization');
reset role;
select pg_temp.login(pg_temp.uid('f2'));
select is(pg_temp.names(), '', 'a guardian without the right to view the child sees no authorization (NEG-04)');
reset role;
select pg_temp.login(pg_temp.uid('f3'));
select is(pg_temp.names(), '', 'a guardian with an active restriction sees no authorization of that child (NEG-05)');
reset role;
select pg_temp.login(pg_temp.uid('bf'));
select is(pg_temp.names(), 'Beta', 'a B guardian sees only the B child''s authorization');
reset role;

-- Educators (D-31 scope) -----------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.names(), 'Mara,Nova', 'E1 sees the current authorizations of children in S1 today (handover), nothing else');
select is((select count(*)::int from public.pickup_authorizations where child_id = 'd2d00000-0000-4000-8000-0000000000d3'), 0, 'E1 sees nothing for a child without a group');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'X', 'Y', daterange(current_date, null))$$, '42501', 'PERMISSION_DENIED', 'an educator cannot add an authorization');
select is_empty($$update public.pickup_authorizations set valid_during = daterange(current_date - 1, current_date) returning id$$, 'an educator cannot end an authorization');
select throws_ok($$select created_by from public.pickup_authorizations$$, '42501', null, 'an educator cannot read who entered an authorization');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.names(), 'Iva', 'E2 sees only the authorization of the S2 child');
reset role;

-- Other roles ----------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select is(pg_temp.names(), '', 'a platform admin reads no authorization (NEG-10)');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select is((select count(*)::int from public.pickup_authorizations where organization_id = 'd2d00000-0000-4000-8000-00000000000a'), 0, 'a B manager reads no A authorization');
reset role;

-- Scope over time ------------------------------------------------------------------------------------------------------
-- D1 moves from S1 to S2 today.
update public.enrollments set valid_during = daterange(current_date - 30, current_date) where id = 'd2d00000-0000-4000-8000-0000000000e1';
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d2d00000-0000-4000-8000-00000000000a', 'd2d00000-0000-4000-8000-0000000000d1', 'd2d00000-0000-4000-8000-000000000052', daterange(current_date, null), null);
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.names(), '', 'after the transfer E1 no longer sees the authorizations of D1 (NEG-08)');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.names(), 'Iva,Mara,Nova', 'the new group''s educator sees them');
reset role;
-- E2's assignment ends.
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date) where id = 'd2d00000-0000-4000-8000-00000000a5e2';
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.names(), '', 'after the assignment ends E2 sees nothing');
reset role;
-- The restriction on Cvita ends: she sees the list again.
update public.access_restrictions set valid_during = daterange(current_date - 1, current_date) where child_guardian_id = 'd2d00000-0000-4000-8000-00000000c031';
select pg_temp.login(pg_temp.uid('f3'));
select is(pg_temp.names(), 'Mara,Nova', 'after the restriction ends Cvita sees the current list again');
reset role;
-- Ana's link to D1 ends: she keeps D3 only.
update public.child_guardians set valid_during = daterange(current_date - 30, current_date) where id = 'd2d00000-0000-4000-8000-00000000c011';
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.names(), 'Lovro', 'after her link to D1 ends Ana sees only D3''s authorization (NEG-06)');
reset role;
-- Authorizations do not depend on guardian links: the list stays complete for the manager.
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select is((select count(*)::int from public.pickup_authorizations where child_id = 'd2d00000-0000-4000-8000-0000000000d1'), 4,
  'authorizations are independent of guardian links and restrictions (no automatic pickup rule)');
reset role;
-- Separate from accounts: an authorized person needs no account and gains no access through the list.
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'pickup_authorizations' and column_name ~* 'profile|user|account'), 0,
  'an authorized person is not tied to an account');
select is((select count(*)::int from pg_policies where tablename <> 'pickup_authorizations' and (qual ~ 'pickup_authorizations' or coalesce(with_check, '') ~ 'pickup_authorizations')), 0,
  'no other table''s access depends on pickup authorizations');

select * from finish();
rollback;
