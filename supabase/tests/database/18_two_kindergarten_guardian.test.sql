-- NEG-02 (D2-I): one account that is a guardian in two kindergartens never gets mixed data. Each kindergarten has its
-- own guardian record attached to the same account; children, links, enrolments, groups and pickup persons of one
-- kindergarten never appear through the other, and a restriction or ended link in one does not leak or change the
-- other. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('d2b00000-0000-4000-8000-0000000000f1', 'two-kg@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name) values ('d2b00000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica');
insert into public.organizations (id, name, slug) values
  ('d2b00000-0000-4000-8000-00000000000a', 'Test Oba A', 'test-oba-a'),
  ('d2b00000-0000-4000-8000-00000000000b', 'Test Oba B', 'test-oba-b');
insert into public.facilities (id, organization_id, name) values
  ('d2b00000-0000-4000-8000-0000000000fa', 'd2b00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d2b00000-0000-4000-8000-0000000000fb', 'd2b00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2b00000-0000-4000-8000-0000000000aa', 'd2b00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d2b00000-0000-4000-8000-0000000000bb', 'd2b00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2b00000-0000-4000-8000-000000000051', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000fa', 'd2b00000-0000-4000-8000-0000000000aa', 'GA'),
  ('d2b00000-0000-4000-8000-000000000061', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000fb', 'd2b00000-0000-4000-8000-0000000000bb', 'GB');
insert into public.memberships (organization_id, profile_id, role, valid_during) values
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f1', 'guardian', daterange(current_date - 30, null)),
  ('d2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000f1', 'guardian', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2b00000-0000-4000-8000-0000000000ca', 'd2b00000-0000-4000-8000-00000000000a', 'Ana', 'Alfa', null),
  ('d2b00000-0000-4000-8000-0000000000cb', 'd2b00000-0000-4000-8000-00000000000b', 'Bor', 'Beta', null),
  ('d2b00000-0000-4000-8000-0000000000cc', 'd2b00000-0000-4000-8000-00000000000b', 'Cid', 'Beta', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000ca', 'd2b00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000cb', 'd2b00000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000cc', 'd2b00000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);
-- One guardian record per kindergarten, both attached to the same account.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2b00000-0000-4000-8000-000000000a01', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica', null),
  ('d2b00000-0000-4000-8000-000000000b01', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d2b00000-0000-4000-8000-00000000c0aa', 'd2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000ca', 'd2b00000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d2b00000-0000-4000-8000-00000000c0bb', 'd2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000cb', 'd2b00000-0000-4000-8000-000000000b01', true, daterange(current_date - 30, null), null);
insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-0000000000ca', 'PA', 'Alfa', daterange(current_date - 10, null), null),
  ('d2b00000-0000-4000-8000-00000000000b', 'd2b00000-0000-4000-8000-0000000000cb', 'PB', 'Beta', daterange(current_date - 10, null), null);

create function pg_temp.login() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'd2b00000-0000-4000-8000-0000000000f1', 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.seen(t text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select coalesce(string_agg(organization_id::text || ''/'' || id::text, '','' order by id), '''') from public.%I', t) into r;
  return r;
end $$;
grant execute on function pg_temp.seen(text) to authenticated;

select pg_temp.login();
select is((select string_agg(first_name, ',' order by first_name) from public.children), 'Ana,Bor', 'the person sees exactly the linked child in each kindergarten');
select is((select count(*)::int from public.children where id = 'd2b00000-0000-4000-8000-0000000000cc'), 0, 'a child of B without a link stays invisible although the person is a guardian in B (NEG-03)');
select is((select string_agg(g.name, ',' order by g.name) from public.groups g), 'GA,GB', 'only the groups of the linked children');
select is((select count(*)::int from public.child_guardians), 2, 'own links only, one per kindergarten');
select is((select string_agg(organization_id::text, ',' order by organization_id) from public.guardians), 'd2b00000-0000-4000-8000-00000000000a,d2b00000-0000-4000-8000-00000000000b',
  'one own guardian record per kindergarten');
select is((select string_agg(first_name, ',' order by first_name) from public.pickup_authorizations), 'PA,PB', 'pickup persons of the linked children only');
select ok(not exists (select 1 from public.enrollments e join public.children c on c.id = e.child_id where e.organization_id <> c.organization_id),
  'no enrolment is ever shown with a child of the other kindergarten');
reset role;

-- A restriction in A affects A only.
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d2b00000-0000-4000-8000-00000000000a', 'd2b00000-0000-4000-8000-00000000c0aa', daterange(current_date, null), null);
select pg_temp.login();
select is((select string_agg(first_name, ',') from public.children), 'Bor', 'a restriction in A hides the A child, the B child stays visible (NEG-05 per kindergarten)');
select is((select count(*)::int from public.pickup_authorizations where organization_id = 'd2b00000-0000-4000-8000-00000000000a'), 0, 'and A''s pickup persons');
select is((select count(*)::int from public.access_restrictions), 0, 'the restriction itself is invisible to the person');
reset role;

-- The link in B ends: nothing of B remains; A stays restricted.
update public.child_guardians set valid_during = daterange(current_date - 30, current_date) where id = 'd2b00000-0000-4000-8000-00000000c0bb';
select pg_temp.login();
select is((select count(*)::int from public.children), 0, 'after B''s link ends and A is restricted, the person sees no child (NEG-06)');
select is((select count(*)::int from public.groups), 0, 'and no group of either kindergarten');
reset role;

select * from finish();
rollback;
