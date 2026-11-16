-- D4-G: negative cases the D4 files 24–27 did not cover for announcements, daily overviews and conversations.
--   NEG-02  one account that is a guardian in two kindergartens reads each kindergarten's communication separately; a
--           restriction in one kindergarten does not affect the other;
--   NEG-06  an ended link removes everything of that kindergarten on the next request;
--   NEG-08  a child moved to another group: the conversation moves with the child — the old group's educator loses it,
--           the new group's educator gets it.
-- Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4900000-0000-4000-8000-0000000000' || x)::uuid, 'd4neg-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['f1', 'e1', 'e2', 'eb']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4900000-%';
insert into public.organizations (id, name, slug) values
  ('d4900000-0000-4000-8000-00000000000a', 'Test D4 A', 'test-d4neg-a'),
  ('d4900000-0000-4000-8000-00000000000b', 'Test D4 B', 'test-d4neg-b');
insert into public.facilities (id, organization_id, name) values
  ('d4900000-0000-4000-8000-0000000000fa', 'd4900000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d4900000-0000-4000-8000-0000000000fb', 'd4900000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4900000-0000-4000-8000-0000000000aa', 'd4900000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d4900000-0000-4000-8000-0000000000bb', 'd4900000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4900000-0000-4000-8000-000000000051', 'd4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000fa', 'd4900000-0000-4000-8000-0000000000aa', 'S1'),
  ('d4900000-0000-4000-8000-000000000052', 'd4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000fa', 'd4900000-0000-4000-8000-0000000000aa', 'S2'),
  ('d4900000-0000-4000-8000-000000000061', 'd4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-0000000000fb', 'd4900000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d4900000-0000-4000-8000-0000000001' || x)::uuid, ('d4900000-0000-4000-8000-00000000000' || o)::uuid, ('d4900000-0000-4000-8000-0000000000' || p)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('fa', 'a', 'f1', 'guardian'), ('fb', 'b', 'f1', 'guardian'), ('e1', 'a', 'e1', 'educator'), ('e2', 'a', 'e2', 'educator'), ('eb', 'b', 'eb', 'educator')) v(x, o, p, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000001e1', 'd4900000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000001e2', 'd4900000-0000-4000-8000-000000000052', daterange(current_date - 30, null)),
  ('d4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-0000000001eb', 'd4900000-0000-4000-8000-000000000061', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d4900000-0000-4000-8000-0000000000ca', 'd4900000-0000-4000-8000-00000000000a', 'Ana', 'Alfa', null),
  ('d4900000-0000-4000-8000-0000000000cb', 'd4900000-0000-4000-8000-00000000000b', 'Bor', 'Beta', null);
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d4900000-0000-4000-8000-00000000e0ca', 'd4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000ca', 'd4900000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d4900000-0000-4000-8000-00000000e0cb', 'd4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-0000000000cb', 'd4900000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d4900000-0000-4000-8000-000000000a01', 'd4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica', null),
  ('d4900000-0000-4000-8000-000000000b01', 'd4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-0000000000f1', 'Oba', 'Vrtica', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, receives_messages, valid_during, created_by) values
  ('d4900000-0000-4000-8000-00000000c0aa', 'd4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000ca', 'd4900000-0000-4000-8000-000000000a01', true, true, daterange(current_date - 30, null), null),
  ('d4900000-0000-4000-8000-00000000c0bb', 'd4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-0000000000cb', 'd4900000-0000-4000-8000-000000000b01', true, true, daterange(current_date - 30, null), null);
-- Each kindergarten published an announcement for the child's group and today's overview; both conversations exist.
insert into public.announcements (organization_id, title, body, audience_scope, audience_ids, audience_roles, status, published_at) values
  ('d4900000-0000-4000-8000-00000000000a', 'Obavijest A', 'Tekst', 'group', array['d4900000-0000-4000-8000-000000000051'::uuid], array['guardians'], 'published', now()),
  ('d4900000-0000-4000-8000-00000000000b', 'Obavijest B', 'Tekst', 'group', array['d4900000-0000-4000-8000-000000000061'::uuid], array['guardians'], 'published', now());
insert into public.daily_entries (organization_id, group_id, entry_date, body, status, published_at) values
  ('d4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-000000000051', current_date, 'Pregled A', 'published', now()),
  ('d4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-000000000061', current_date, 'Pregled B', 'published', now());
insert into public.conversations (organization_id, child_id, guardian_id) values
  ('d4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000ca', 'd4900000-0000-4000-8000-000000000a01'),
  ('d4900000-0000-4000-8000-00000000000b', 'd4900000-0000-4000-8000-0000000000cb', 'd4900000-0000-4000-8000-000000000b01');

create function pg_temp.login(x text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4900000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- What the caller reads of D4, per kindergarten letter, e.g. 'ann:A,B|day:A,B|conv:A,B'.
create function pg_temp.seen() returns text language sql as $$
  select 'ann:' || coalesce((select string_agg(right(title, 1), ',' order by title) from public.announcements), '')
      || '|day:' || coalesce((select string_agg(right(body, 1), ',' order by body) from public.daily_entries), '')
      || '|conv:' || coalesce((select string_agg(case when c.organization_id = 'd4900000-0000-4000-8000-00000000000a' then 'A' else 'B' end, ',' order by c.organization_id)
                               from public.conversations c), '')
$$;
grant execute on function pg_temp.seen() to authenticated;

-- NEG-02 ----------------------------------------------------------------------------------------------------------------
select pg_temp.login('f1');
select is(pg_temp.seen(), 'ann:A,B|day:A,B|conv:A,B', 'one account reads the communication of both kindergartens');
select ok(not exists (select 1 from public.announcements a join public.groups g on g.id = any (a.audience_ids) where g.organization_id <> a.organization_id),
  'no announcement is ever paired with a group of the other kindergarten');
reset role;
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-00000000c0aa', daterange(current_date, null), null);
select pg_temp.login('f1');
select is(pg_temp.seen(), 'ann:B|day:B|conv:B', 'a restriction in A removes A''s announcement, overview and conversation; B is unaffected (NEG-05 per kindergarten)');
select throws_ok($$select api.open_conversation('d4900000-0000-4000-8000-0000000000ca')$$, '42501', 'PERMISSION_DENIED', 'and A''s conversation cannot be opened');
select lives_ok($$select api.open_conversation('d4900000-0000-4000-8000-0000000000cb')$$, 'while B''s still can');
reset role;

-- NEG-06 ----------------------------------------------------------------------------------------------------------------
update public.child_guardians set valid_during = daterange(current_date - 30, current_date) where id = 'd4900000-0000-4000-8000-00000000c0bb';
select pg_temp.login('f1');
select is(pg_temp.seen(), 'ann:|day:|conv:', 'after B''s link ends (and A is restricted) the account reads no communication at all');
reset role;

-- NEG-08: the conversation moves with the child ------------------------------------------------------------------------
select pg_temp.login('e1');
select is((select count(*)::int from public.conversations), 1, 'before the move: the S1 educator has the conversation about Ana');
reset role;
update public.enrollments set valid_during = daterange(current_date - 30, current_date) where id = 'd4900000-0000-4000-8000-00000000e0ca';
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d4900000-0000-4000-8000-00000000000a', 'd4900000-0000-4000-8000-0000000000ca', 'd4900000-0000-4000-8000-000000000052', daterange(current_date, null), null);
select pg_temp.login('e1');
select is((select count(*)::int from public.conversations), 0, 'after the move to S2 the old group''s educator loses it');
reset role;
select pg_temp.login('e2');
select is((select count(*)::int from public.conversations), 1, 'the new group''s educator gets it');
reset role;
select pg_temp.login('eb');
select is((select count(*)::int from public.conversations), 1, 'B''s educator sees only B''s conversation (NEG-01)');
reset role;

select * from finish();
rollback;
