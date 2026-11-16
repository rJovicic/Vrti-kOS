-- D-42: one conversation per child and guardian (migration 20261118110000_conversation_per_guardian.sql).
-- Negative suite required by the owner (2026-11-16): second guardian of the same child, guardian of another child,
-- guardian of another kindergarten, former educator, educator of another group, managers (org_admin, director),
-- platform admin, notifications and "deep links" by id, direct DB/API bypass attempts; plus: every educator assigned
-- to the child's group today has access (Q-T20), relationship changes act on the next request, the same person has
-- separate conversations per child. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4200000-0000-4000-8000-0000000000' || x)::uuid, 'pg-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'a2', 'e1', 'e2', 'e3', 'f1', 'f2', 'f3', 'f4', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4200000-%';
insert into private.platform_admins (profile_id) values ('d4200000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d4200000-0000-4000-8000-00000000000a', 'Test Razgovor A', 'test-pg-a'),
  ('d4200000-0000-4000-8000-00000000000b', 'Test Razgovor B', 'test-pg-b');
insert into public.facilities (id, organization_id, name) values
  ('d4200000-0000-4000-8000-0000000000fa', 'd4200000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d4200000-0000-4000-8000-0000000000fb', 'd4200000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4200000-0000-4000-8000-0000000000aa', 'd4200000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d4200000-0000-4000-8000-0000000000bb', 'd4200000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4200000-0000-4000-8000-000000000051', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000fa', 'd4200000-0000-4000-8000-0000000000aa', 'Galebovi'),
  ('d4200000-0000-4000-8000-000000000052', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000fa', 'd4200000-0000-4000-8000-0000000000aa', 'Skoljke'),
  ('d4200000-0000-4000-8000-000000000061', 'd4200000-0000-4000-8000-00000000000b', 'd4200000-0000-4000-8000-0000000000fb', 'd4200000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d4200000-0000-4000-8000-0000000001' || x)::uuid, ('d4200000-0000-4000-8000-00000000000' || o)::uuid, ('d4200000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('a2', 'a', 'director'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('e3', 'a', 'educator'),
             ('f1', 'a', 'guardian'), ('f2', 'a', 'guardian'), ('f3', 'a', 'guardian'), ('f4', 'b', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
-- E1 and E3 in Galebovi today, E2 in Skoljke.
insert into public.staff_assignments (id, organization_id, membership_id, group_id, valid_during) values
  ('d4200000-0000-4000-8000-00000000a5e1', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000001e1', 'd4200000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4200000-0000-4000-8000-00000000a5e3', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000001e3', 'd4200000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4200000-0000-4000-8000-00000000a5e2', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000001e2', 'd4200000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- D1 and D3 in Galebovi, D2 in Skoljke; DB in kindergarten B.
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d4200000-0000-4000-8000-0000000000d1', 'd4200000-0000-4000-8000-00000000000a', 'Lana', 'Babic', null),
  ('d4200000-0000-4000-8000-0000000000d2', 'd4200000-0000-4000-8000-00000000000a', 'Tea', 'Zic', null),
  ('d4200000-0000-4000-8000-0000000000d3', 'd4200000-0000-4000-8000-00000000000a', 'Luka', 'Babic', null),
  ('d4200000-0000-4000-8000-0000000000db', 'd4200000-0000-4000-8000-00000000000b', 'Bor', 'Beta', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d1', 'd4200000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d2', 'd4200000-0000-4000-8000-000000000052', daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d3', 'd4200000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000000b', 'd4200000-0000-4000-8000-0000000000db', 'd4200000-0000-4000-8000-000000000061', daterange(current_date - 30, null), null);
-- F1 (Ana) → D1 and D3; F2 (Ivan, second guardian of D1); F3 (Petra) → D2; F4 → DB in kindergarten B. All with messages.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d4200000-0000-4000-8000-000000000a10', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000f1', 'Ana', 'Babic', null),
  ('d4200000-0000-4000-8000-000000000a20', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000f2', 'Ivan', 'Babic', null),
  ('d4200000-0000-4000-8000-000000000a30', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000f3', 'Petra', 'Zic', null),
  ('d4200000-0000-4000-8000-000000000a50', 'd4200000-0000-4000-8000-00000000000a', null, 'Bez', 'Racuna', null),
  ('d4200000-0000-4000-8000-000000000b40', 'd4200000-0000-4000-8000-00000000000b', 'd4200000-0000-4000-8000-0000000000f4', 'Bruno', 'Beta', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, receives_messages, valid_during, created_by) values
  ('d4200000-0000-4000-8000-00000000c011', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d1', 'd4200000-0000-4000-8000-000000000a10', true, true, daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000c013', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d3', 'd4200000-0000-4000-8000-000000000a10', true, true, daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000c021', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d1', 'd4200000-0000-4000-8000-000000000a20', true, true, daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000c032', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d2', 'd4200000-0000-4000-8000-000000000a30', true, true, daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000c051', 'd4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-0000000000d1', 'd4200000-0000-4000-8000-000000000a50', true, true, daterange(current_date - 30, null), null),
  ('d4200000-0000-4000-8000-00000000c04b', 'd4200000-0000-4000-8000-00000000000b', 'd4200000-0000-4000-8000-0000000000db', 'd4200000-0000-4000-8000-000000000b40', true, true, daterange(current_date - 30, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4200000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.c(x text) returns uuid language sql as $$ select ('d4200000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.g(x text) returns uuid language sql as $$ select ('d4200000-0000-4000-8000-000000000' || x)::uuid $$;
-- The conversation of (child, guardian), read as the owner: the "deep link" an attacker would try.
create function pg_temp.conv(child text, guardian text) returns uuid language sql security definer as $$
  select id from public.conversations where child_id = pg_temp.c(child) and guardian_id = pg_temp.g(guardian) $$;
create function pg_temp.msg(p_body text) returns uuid language sql security definer as $$ select id from public.messages where body = p_body $$;
-- What the caller reads directly through RLS: bodies of visible messages and the number of visible conversations.
create function pg_temp.seen() returns text language sql as $$
  select (select count(*) from public.conversations) || ':' || coalesce((select string_agg(coalesce(body, '-'), ',' order by body) from public.messages), '')
$$;
grant execute on function pg_temp.c(text), pg_temp.g(text), pg_temp.conv(text, text), pg_temp.msg(text), pg_temp.seen() to authenticated;

-- Catalog -------------------------------------------------------------------------------------------------------------
select is((select attnotnull from pg_attribute where attrelid = 'public.conversations'::regclass and attname = 'guardian_id'), true, 'every conversation names its guardian');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.conversations'::regclass and conname = 'conversations_child_guardian_key')
  and not exists (select 1 from pg_constraint where conrelid = 'public.conversations'::regclass and conname = 'conversations_organization_id_child_id_key'),
  'one conversation per child AND guardian (the per-child key is gone)');
select ok(to_regprocedure('private.child_participant_ids(uuid)') is null, 'the per-child participant rule no longer exists');
select ok(not (select prosecdef from pg_proc where oid = 'api.open_conversation(uuid, uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'api.message_contacts()'::regprocedure), 'the exposed RPCs are SECURITY INVOKER (SR-API-01)');
select ok(not has_function_privilege('anon', 'api.open_conversation(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'api.message_contacts()', 'EXECUTE'), 'anon cannot call them');

-- Both guardians of D1 open their own conversation ---------------------------------------------------------------------
select pg_temp.login('f1');
select is(api.open_conversation(pg_temp.c('d1')), pg_temp.conv('d1', 'a10'), 'Ana opens her own conversation about Lana');
select lives_ok($$select api.send_message(pg_temp.conv('d1', 'a10'), 'ANA-1')$$, 'Ana writes');
reset role;
select pg_temp.login('f2');
select is(api.open_conversation(pg_temp.c('d1')), pg_temp.conv('d1', 'a20'), 'Ivan opens his own conversation about Lana');
select isnt(pg_temp.conv('d1', 'a20'), pg_temp.conv('d1', 'a10'), 'two guardians, two conversations');
select lives_ok($$select api.send_message(pg_temp.conv('d1', 'a20'), 'IVAN-1')$$, 'Ivan writes');
reset role;
select pg_temp.login('e1');
select lives_ok($$select api.send_message(pg_temp.conv('d1', 'a10'), 'E1-ANI')$$, 'the educator answers Ana');
reset role;

-- Second guardian of the same child ------------------------------------------------------------------------------------
select pg_temp.login('f2');
select is(pg_temp.seen(), '1:IVAN-1', 'Ivan sees only his conversation and his message, nothing of Ana''s');
select throws_ok($$select * from api.conversation_messages(pg_temp.conv('d1', 'a10'))$$, '42501', 'PERMISSION_DENIED', 'Ana''s messages by id are refused (deep link)');
select throws_ok($$select * from api.conversation_participants(pg_temp.conv('d1', 'a10'))$$, '42501', 'PERMISSION_DENIED', 'so is the participant list');
select throws_ok($$select api.send_message(pg_temp.conv('d1', 'a10'), 'upad')$$, '42501', 'PERMISSION_DENIED', 'and writing into it');
select throws_ok($$select api.withdraw_message(pg_temp.msg('ANA-1'))$$, '42501', 'PERMISSION_DENIED', 'and withdrawing Ana''s message');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'), pg_temp.g('a10'))$$, '42501', 'PERMISSION_DENIED', 'naming Ana''s guardian record does not open her conversation');
select throws_ok($$select * from api.conversation_messages(gen_random_uuid())$$, '42501', 'PERMISSION_DENIED', 'an unknown id gets the same answer (existence not revealed)');
select is((select count(*)::int from public.notifications where resource_id = pg_temp.conv('d1', 'a10')), 0, 'no notification about Ana''s conversation reaches Ivan');
select is((select string_agg(guardian_name || '/' || is_me::text, ',') from api.message_contacts()), 'Ivan Babic/true', 'Ivan''s contact list holds only himself');
select throws_ok($$insert into public.messages (organization_id, conversation_id, sender_id, body) values ('d4200000-0000-4000-8000-00000000000a', pg_temp.conv('d1', 'a10'), pg_temp.c('f2'), 'x')$$,
  '42501', null, 'no direct insert into her conversation');
select throws_ok($$update public.conversations set guardian_id = pg_temp.g('a20') where id = pg_temp.conv('d1', 'a10')$$, '42501', null, 'no direct re-assignment of a conversation');
reset role;
select pg_temp.login('f1');
select is(pg_temp.seen(), '1:ANA-1,E1-ANI', 'Ana sees her conversation with the educator''s answer and nothing of Ivan''s');
select is((select count(*)::int from public.notifications where resource_id = pg_temp.conv('d1', 'a20')), 0, 'Ivan''s messages notify nobody but the educators');
select is((select count(*)::int from public.notifications where resource_id = pg_temp.conv('d1', 'a10')), 1, 'Ana is notified of the answer in her own conversation');
reset role;
select is((select string_agg(split_part(p.last_name, '-', 2), ',' order by p.last_name) from public.notifications n join public.profiles p on p.id = n.recipient_id
           where n.resource_id = pg_temp.conv('d1', 'a20')), 'e1,e3', 'Ivan''s message notified only the two educators of the group');

-- Same person, two children: separate conversations ---------------------------------------------------------------------
select pg_temp.login('f1');
select isnt(api.open_conversation(pg_temp.c('d3')), pg_temp.conv('d1', 'a10'), 'Ana''s conversation about Luka is a different one');
select is((select count(*)::int from api.conversation_messages(pg_temp.conv('d3', 'a10'))), 0, 'and starts empty');
reset role;

-- Guardian of another child, another kindergarten -----------------------------------------------------------------------
select pg_temp.login('f3');
select is(pg_temp.seen(), '0:', 'the guardian of another child reads nothing');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'))$$, '42501', 'PERMISSION_DENIED', 'and cannot open a conversation about Lana');
select throws_ok($$select * from api.conversation_messages(pg_temp.conv('d1', 'a10'))$$, '42501', 'PERMISSION_DENIED', 'nor read one by id');
reset role;
select pg_temp.login('f4');
select is(pg_temp.seen(), '0:', 'a guardian of another kindergarten reads nothing (NEG-01)');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'), pg_temp.g('a10'))$$, '42501', 'PERMISSION_DENIED', 'and cannot open one');
reset role;

-- Educators: the whole team of the group, nobody else (Q-T20) ------------------------------------------------------------
select pg_temp.login('e3');
select is(pg_temp.seen(), '3:ANA-1,E1-ANI,IVAN-1', 'every educator of the group sees every guardian''s conversation about the group''s children');
select is(api.open_conversation(pg_temp.c('d1'), pg_temp.g('a20')), pg_temp.conv('d1', 'a20'), 'and opens Ivan''s by naming him');
select is((select string_agg(guardian_name, ',' order by guardian_name) from api.message_contacts() where child_id = pg_temp.c('d1')), 'Ana Babic,Ivan Babic',
  'the contact list names the guardians who can take part (not the one without an account)');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'), pg_temp.g('a50'))$$, '42501', 'PERMISSION_DENIED', 'no conversation with a guardian who cannot take part');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'))$$, '42501', 'PERMISSION_DENIED', 'an educator must name the guardian');
reset role;
select pg_temp.login('e2');
select is(pg_temp.seen(), '0:', 'an educator of another group reads nothing (NEG-07)');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'), pg_temp.g('a10'))$$, '42501', 'PERMISSION_DENIED', 'and cannot open one');
select is((select count(*)::int from api.message_contacts() where child_id = pg_temp.c('d1')), 0, 'and has no contacts for Lana');
reset role;
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date) where id = 'd4200000-0000-4000-8000-00000000a5e3';
select pg_temp.login('e3');
select is(pg_temp.seen(), '0:', 'a former educator keeps no access to the history (AC-11-2)');
select throws_ok($$select * from api.conversation_messages(pg_temp.conv('d1', 'a20'))$$, '42501', 'PERMISSION_DENIED', 'not even by id');
reset role;

-- Managers and platform admin -------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select is(pg_temp.seen(), '0:', 'an org_admin with MFA reads no conversation (D-42, Q-T16)');
select throws_ok($$select * from api.conversation_messages(pg_temp.conv('d1', 'a10'))$$, '42501', 'PERMISSION_DENIED', 'not through the RPC');
select is((select count(*)::int from api.message_contacts()), 0, 'and has no contacts');
reset role;
select pg_temp.login('a2', 'aal2');
select is(pg_temp.seen(), '0:', 'a director with MFA reads nothing either');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'), pg_temp.g('a10'))$$, '42501', 'PERMISSION_DENIED', 'nor opens one');
reset role;
select pg_temp.login('c1', 'aal2');
select is(pg_temp.seen(), '0:', 'the platform admin reads nothing (NEG-10)');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select * from api.conversation_messages(pg_temp.conv('d1', 'a10'))$$, '42501', 'PERMISSION_DENIED', 'the manager of another kindergarten neither');
reset role;

-- Relationship changes act on the next request ---------------------------------------------------------------------------
update public.child_guardians set receives_messages = false where id = 'd4200000-0000-4000-8000-00000000c021';
select pg_temp.login('f2');
select is(pg_temp.seen(), '0:', 'without receives_messages Ivan loses his own conversation');
reset role;
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by)
values ('d4200000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-00000000c011', daterange(current_date, null), null);
select pg_temp.login('f1');
select is(pg_temp.seen(), '1:', 'a restriction on Ana–Lana removes that conversation at once; Ana keeps the one about Luka');
reset role;
select pg_temp.login('e1');
select is((select count(*)::int from api.conversation_participants(pg_temp.conv('d1', 'a10')) where kind = 'guardian'), 0, 'the educators no longer see Ana as a participant there');
select throws_ok($$select api.open_conversation(pg_temp.c('d1'), pg_temp.g('a10'))$$, '42501', 'PERMISSION_DENIED', 'nor can they reopen it with her');
reset role;

select * from finish();
rollback;
