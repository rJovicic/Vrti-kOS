-- D-33: educators see a link of a child in their group today marked restricted — no reason, reference, documentation
-- or author, no write path; the flag follows the D-31 scope; nobody else gains access. Migration
-- 20261112115000_link_restriction_flag.sql. Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d3300000-0000-4000-8000-0000000000' || x)::uuid, 'oz-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f2', 'b1', 'be', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd3300000-%';
insert into private.platform_admins (profile_id) values ('d3300000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d3300000-0000-4000-8000-00000000000a', 'Test Oznaka A', 'test-oz-a'),
  ('d3300000-0000-4000-8000-00000000000b', 'Test Oznaka B', 'test-oz-b');
insert into public.facilities (id, organization_id, name) values
  ('d3300000-0000-4000-8000-0000000000fa', 'd3300000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d3300000-0000-4000-8000-0000000000fb', 'd3300000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d3300000-0000-4000-8000-0000000000aa', 'd3300000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d3300000-0000-4000-8000-0000000000bb', 'd3300000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d3300000-0000-4000-8000-000000000051', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000fa', 'd3300000-0000-4000-8000-0000000000aa', 'S1'),
  ('d3300000-0000-4000-8000-000000000052', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000fa', 'd3300000-0000-4000-8000-0000000000aa', 'S2'),
  ('d3300000-0000-4000-8000-000000000061', 'd3300000-0000-4000-8000-00000000000b', 'd3300000-0000-4000-8000-0000000000fb', 'd3300000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during) values
  ('d3300000-0000-4000-8000-0000000001a1', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000a1', 'org_admin', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-0000000001e1', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000e1', 'educator', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-0000000001e2', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000e2', 'educator', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-0000000001f1', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000f1', 'guardian', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-0000000001f2', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000f2', 'guardian', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-0000000001b1', 'd3300000-0000-4000-8000-00000000000b', 'd3300000-0000-4000-8000-0000000000b1', 'org_admin', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-0000000001be', 'd3300000-0000-4000-8000-00000000000b', 'd3300000-0000-4000-8000-0000000000be', 'educator', daterange(current_date - 30, null));
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000001e1', 'd3300000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000001e2', 'd3300000-0000-4000-8000-000000000052', daterange(current_date - 30, null)),
  ('d3300000-0000-4000-8000-00000000000b', 'd3300000-0000-4000-8000-0000000001be', 'd3300000-0000-4000-8000-000000000061', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d3300000-0000-4000-8000-0000000000d1', 'd3300000-0000-4000-8000-00000000000a', 'Dijete', 'Jedan', null);
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d3300000-0000-4000-8000-0000000000e9', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000d1', 'd3300000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d3300000-0000-4000-8000-000000000a01', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000f1', 'Ana', 'Ograničena', null),
  ('d3300000-0000-4000-8000-000000000a02', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000f2', 'Bruno', 'Slobodan', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d3300000-0000-4000-8000-00000000c001', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000d1', 'd3300000-0000-4000-8000-000000000a01', true, true, true, daterange(current_date - 30, null), null),
  ('d3300000-0000-4000-8000-00000000c002', 'd3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000d1', 'd3300000-0000-4000-8000-000000000a02', true, true, false, daterange(current_date - 30, null), null);
-- Ana–D1 restricted from today; a second restriction on Bruno–D1 starts tomorrow (not active).
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, reference, created_by) values
  ('d3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-00000000c001', daterange(current_date, null), 'INT-TAJNO-1', 'd3300000-0000-4000-8000-0000000000a1'),
  ('d3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-00000000c002', daterange(current_date + 1, null), 'INT-TAJNO-2', 'd3300000-0000-4000-8000-0000000000a1');

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d3300000-0000-4000-8000-0000000000' || x)::uuid $$;
-- Overview as the caller sees it: guardian name + restricted flag per link.
create function pg_temp.overview() returns text language sql as $$
  select coalesce(string_agg(coalesce(g.first_name, '?') || ':' || o.is_restricted::text, ',' order by o.id), '')
  from public.child_guardian_overview o left join public.guardians g on g.id = o.guardian_id
$$;
grant execute on function pg_temp.overview() to authenticated;

-- Catalog: read-only, no restriction details ---------------------------------------------------------------------------
select is((select c.relkind::text from pg_class c where c.oid = 'public.child_guardian_overview'::regclass), 'v', 'child_guardian_overview is a view');
select ok((select 'security_invoker=true' = any (reloptions) from pg_class where oid = 'public.child_guardian_overview'::regclass), 'the view runs with the caller''s rights (RLS of child_guardians applies)');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'child_guardian_overview'
  and column_name ~* 'reference|reason|razlog|created_by|author|document|valid.*restrict|restriction_id'), 0, 'no reason, reference, author or restriction validity is exposed');
select ok(not has_table_privilege('authenticated', 'public.child_guardian_overview', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'the view is read-only for clients');
select ok(not has_table_privilege('anon', 'public.child_guardian_overview', 'SELECT'), 'anon cannot read the view');
select ok(not has_function_privilege('anon', 'private.link_is_restricted(uuid)', 'EXECUTE'), 'anon cannot call the flag helper');

-- Educator of the child's group (D-33) ------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.overview(), 'Ana:true,Bruno:false', 'E1 sees both guardians of D1; Ana marked restricted, Bruno (restriction from tomorrow) not');
select is((select count(*)::int from public.access_restrictions), 0, 'E1 still cannot read restrictions (no reason, reference, author)');
select is((select string_agg(can_view::text || can_report_absence::text || receives_messages::text, ',' order by id) from public.child_guardian_overview),
  'truetruetrue,truetruefalse', 'E1 sees the stored rights per link together with the flag');
select throws_ok($$update public.child_guardian_overview set can_view = false$$, '42501', null, 'E1 cannot change rights through the view');
select is_empty($$update public.child_guardians set can_view = false returning id$$, 'E1 cannot change rights on the table');
select is_empty($$update public.access_restrictions set valid_during = daterange(current_date - 1, current_date) returning id$$, 'E1 cannot end or change the restriction (no visible row)');
select ok((select private.link_is_restricted('d3300000-0000-4000-8000-00000000c001')), 'the helper answers for a link E1 may see');
reset role;

-- Other roles gain nothing ----------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.overview(), '', 'E2 (other group) sees no link and no flag');
select is((select private.link_is_restricted('d3300000-0000-4000-8000-00000000c001')), false, 'the helper cannot be used to probe a link E2 may not see');
reset role;
select pg_temp.login(pg_temp.uid('be'));
select is(pg_temp.overview(), '', 'an educator of another kindergarten sees nothing');
select is((select private.link_is_restricted('d3300000-0000-4000-8000-00000000c001')), false, 'and cannot probe it');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select is(pg_temp.overview(), '', 'the restricted guardian sees neither the link nor the restriction');
select is((select private.link_is_restricted('d3300000-0000-4000-8000-00000000c001')), false, 'the restricted guardian cannot probe their own restriction');
reset role;
select pg_temp.login(pg_temp.uid('f2'));
select is(pg_temp.overview(), 'Bruno:false', 'the other guardian sees only their own link, unflagged, and nothing about Ana');
select is((select private.link_is_restricted('d3300000-0000-4000-8000-00000000c001')), false, 'the other guardian cannot probe Ana''s link');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select is(pg_temp.overview(), '', 'a platform admin sees nothing (NEG-10)');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select is(pg_temp.overview(), '', 'a B manager sees no A link');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select is(pg_temp.overview(), '', 'an A manager without MFA sees nothing');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select ok((select count(*) from public.child_guardian_overview where is_restricted) = 1, 'the A manager sees the flag (and may read the restriction itself)');
reset role;

-- Scope ends with the D-31 rules ----------------------------------------------------------------------------------------------
-- Child moves to S2 from today: E1 loses the link and the flag, E2 gains them.
update public.enrollments set valid_during = daterange(current_date - 30, current_date) where id = 'd3300000-0000-4000-8000-0000000000e9';
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d3300000-0000-4000-8000-00000000000a', 'd3300000-0000-4000-8000-0000000000d1', 'd3300000-0000-4000-8000-000000000052', daterange(current_date, null), null);
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.overview(), '', 'after the transfer E1 sees no link and no flag');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.overview(), 'Ana:true,Bruno:false', 'the new group''s educator sees the flag');
reset role;
-- E2's assignment ends: nothing.
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date) where membership_id = 'd3300000-0000-4000-8000-0000000001e2';
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.overview(), '', 'after the assignment ends E2 sees nothing');
reset role;
update public.staff_assignments set valid_during = daterange(current_date - 30, null) where membership_id = 'd3300000-0000-4000-8000-0000000001e2';
-- The restriction ends: the flag disappears; it is not a lasting mark.
update public.access_restrictions set valid_during = daterange(current_date - 1, current_date) where reference = 'INT-TAJNO-1';
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.overview(), 'Ana:false,Bruno:false', 'an ended restriction is no longer flagged');
reset role;
-- The restriction flag is not a pickup ban and changes no right stored on the link.
select is((select string_agg(can_view::text, ',' order by id) from public.child_guardians where organization_id = 'd3300000-0000-4000-8000-00000000000a'), 'true,true',
  'flags and restrictions never rewrite the link rights');
select pg_temp.login(pg_temp.uid('f1'));
select is((select count(*)::int from public.children), 1, 'after the restriction ends Ana sees D1 again');
reset role;
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'child_guardian_overview' and column_name ~* 'pickup|preuzim'), 0,
  'the overview carries no pickup meaning (pickup authorizations are separate, D2-D)');

select * from finish();
rollback;
