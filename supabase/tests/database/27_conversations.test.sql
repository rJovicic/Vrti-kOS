-- D4-F: conversations (migration 20261116140000_conversations.sql), per child AND guardian since D-42
-- (20261118110000_conversation_per_guardian.sql; the D-42 negative suite is in 31_conversation_per_guardian). AC-11-1 (participants from relationships:
-- receives_messages, no restriction; educators of the group today), AC-11-2 (former educator loses the conversation),
-- AC-11-3 (managers no access to content), FR-11-2 (who can see it), FR-11-3/5 (text only, withdraw within 5 minutes),
-- notifications, audit without text, NEG-01/03/09/10. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4f00000-0000-4000-8000-0000000000' || x)::uuid, 'msg-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'e3', 'f1', 'f2', 'f6', 'f9', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4f00000-%';
insert into private.platform_admins (profile_id) values ('d4f00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d4f00000-0000-4000-8000-00000000000a', 'Test Poruke A', 'test-msg-a'),
  ('d4f00000-0000-4000-8000-00000000000b', 'Test Poruke B', 'test-msg-b');
insert into public.facilities (id, organization_id, name) values
  ('d4f00000-0000-4000-8000-0000000000fa', 'd4f00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d4f00000-0000-4000-8000-0000000000fb', 'd4f00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4f00000-0000-4000-8000-0000000000aa', 'd4f00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d4f00000-0000-4000-8000-0000000000bb', 'd4f00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4f00000-0000-4000-8000-000000000051', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000fa', 'd4f00000-0000-4000-8000-0000000000aa', 'Galebovi'),
  ('d4f00000-0000-4000-8000-000000000052', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000fa', 'd4f00000-0000-4000-8000-0000000000aa', 'Skoljke'),
  ('d4f00000-0000-4000-8000-000000000061', 'd4f00000-0000-4000-8000-00000000000b', 'd4f00000-0000-4000-8000-0000000000fb', 'd4f00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d4f00000-0000-4000-8000-0000000001' || x)::uuid, ('d4f00000-0000-4000-8000-00000000000' || o)::uuid, ('d4f00000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('e3', 'a', 'educator'), ('f1', 'a', 'guardian'),
             ('f2', 'a', 'guardian'), ('f6', 'a', 'guardian'), ('f9', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
-- E1 and E3 (substitute) in Galebovi today, E2 in Skoljke.
insert into public.staff_assignments (id, organization_id, membership_id, group_id, valid_during) values
  ('d4f00000-0000-4000-8000-00000000a5e1', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000001e1', 'd4f00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4f00000-0000-4000-8000-00000000a5e3', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000001e3', 'd4f00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4f00000-0000-4000-8000-00000000a5e2', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000001e2', 'd4f00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d4f00000-0000-4000-8000-0000000000d1', 'd4f00000-0000-4000-8000-00000000000a', 'Lana', 'Babic', null),
  ('d4f00000-0000-4000-8000-0000000000d9', 'd4f00000-0000-4000-8000-00000000000a', 'Tea', 'Zic', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000d1', 'd4f00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000d9', 'd4f00000-0000-4000-8000-000000000052', daterange(current_date - 30, null), null);
-- F1 → D1 (messages), F2 → D1 (no messages), F6 → D1 (messages, restricted), F9 → D9 (messages).
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d4f00000-0000-4000-8000-000000000a10', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000f1', 'Ana', 'Babic', null),
  ('d4f00000-0000-4000-8000-000000000a20', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000f2', 'Marko', 'Horvat', null),
  ('d4f00000-0000-4000-8000-000000000a60', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000f6', 'Iva', 'Ogranicena', null),
  ('d4f00000-0000-4000-8000-000000000a90', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000f9', 'Petra', 'Zic', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, receives_messages, valid_during, created_by) values
  ('d4f00000-0000-4000-8000-00000000c010', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000d1', 'd4f00000-0000-4000-8000-000000000a10', true, true, daterange(current_date - 30, null), null),
  ('d4f00000-0000-4000-8000-00000000c020', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000d1', 'd4f00000-0000-4000-8000-000000000a20', true, false, daterange(current_date - 30, null), null),
  ('d4f00000-0000-4000-8000-00000000c060', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000d1', 'd4f00000-0000-4000-8000-000000000a60', true, true, daterange(current_date - 30, null), null),
  ('d4f00000-0000-4000-8000-00000000c090', 'd4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-0000000000d9', 'd4f00000-0000-4000-8000-000000000a90', true, true, daterange(current_date - 30, null), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d4f00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-00000000c060', daterange(current_date - 1, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4f00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.conv() returns uuid language sql security definer as $$
  select id from public.conversations where child_id = 'd4f00000-0000-4000-8000-0000000000d1' and guardian_id = 'd4f00000-0000-4000-8000-000000000a10' $$;
create function pg_temp.msg(p_body text) returns uuid language sql security definer as $$ select id from public.messages where body = p_body $$;
grant execute on function pg_temp.conv(), pg_temp.msg(text) to authenticated;

-- Catalog ---------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.conversations'::regclass), 'RLS on conversations');
select ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'RLS on messages');
select ok(not has_table_privilege('authenticated', 'public.messages', 'INSERT,UPDATE,DELETE,TRUNCATE')
          and not has_table_privilege('authenticated', 'public.conversations', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients write only through the RPCs');
select ok(not has_table_privilege('anon', 'public.messages', 'SELECT'), 'anon reads nothing (NEG-15)');
select ok(not (select bool_or(prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api'
               and p.proname in ('open_conversation', 'send_message', 'withdraw_message', 'conversation_participants', 'conversation_messages')),
  'the exposed RPCs are SECURITY INVOKER (SR-API-01)');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'messages'
  and column_name ~* 'attach|file|photo|media'), 0, 'text only: no attachment column (FR-11-3)');

-- Who may open (AC-11-1, AC-11-3) ---------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, '42501', 'PERMISSION_DENIED', 'a manager has no access (AC-11-3, Q-T16)');
reset role;
select pg_temp.login('f2');
select throws_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, '42501', 'PERMISSION_DENIED', 'a guardian without receives_messages cannot (AC-11-1)');
reset role;
select pg_temp.login('f6');
select throws_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, '42501', 'PERMISSION_DENIED', 'a restricted guardian cannot (NEG-05)');
reset role;
select pg_temp.login('f9');
select throws_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, '42501', 'PERMISSION_DENIED', 'another family cannot (NEG-03)');
reset role;
select pg_temp.login('e2');
select throws_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, '42501', 'PERMISSION_DENIED', 'an educator of another group cannot (NEG-07)');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, '42501', 'PERMISSION_DENIED', 'another kindergarten cannot (NEG-01)');
reset role;
select pg_temp.login('f1');
select lives_ok($$select api.open_conversation('d4f00000-0000-4000-8000-0000000000d1')$$, 'the guardian with receives_messages opens the conversation about D1');
select is(api.open_conversation('d4f00000-0000-4000-8000-0000000000d1'), pg_temp.conv(), 'opening again returns the same one (one per child and guardian, D-42)');
reset role;
select pg_temp.login('e1');
select is(api.open_conversation('d4f00000-0000-4000-8000-0000000000d1', 'd4f00000-0000-4000-8000-000000000a10'), pg_temp.conv(), 'the educator of the group opens the same conversation by naming the guardian (D-42)');
reset role;

-- Sending, notifications, display (FR-11-2) ------------------------------------------------------------------------------
select pg_temp.login('f1');
select lives_ok($$select api.send_message(pg_temp.conv(), 'Lana danas ide ranije, oko 14 h.')$$, 'the guardian sends a message');
select throws_ok($$select api.send_message(pg_temp.conv(), repeat('x', 2001))$$, 'P0001', 'MESSAGE_CONTENT_INVALID', 'at most 2,000 characters');
select throws_ok($$select api.send_message(pg_temp.conv(), '   ')$$, 'P0001', 'MESSAGE_CONTENT_INVALID', 'not empty');
reset role;
select pg_temp.login('e3');
select lives_ok($$select api.send_message(pg_temp.conv(), 'Hvala, zabiljezeno.')$$, 'the substitute educator answers');
reset role;
select is((select string_agg(split_part(p.last_name, '-', 2), ',' order by p.last_name) from public.notifications n join public.profiles p on p.id = n.recipient_id
           where n.resource_id = pg_temp.conv()),
  'e1,e1,e3,f1', 'each message notified the other participants only: F1''s → E1, E3; E3''s → E1, F1 — never the sender, F2, F6 or the manager');
select pg_temp.login('f1');
select is((select string_agg(kind || ':' || name || case when is_me then '(ja)' else '' end, ',' order by kind, name) from api.conversation_participants(pg_temp.conv())),
  'group:Galebovi,guardian:Ana Babic(ja)', 'who can see it: the guardian (me) and the educators of Galebovi — not F2 (no messages) or F6 (restricted) (FR-11-2, AC-11-1)');
select is((select string_agg(coalesce(sender_name, '-') || '/' || sender_kind || '/' || mine::text, ',' order by created_at) from api.conversation_messages(pg_temp.conv())),
  'Ana Babic/guardian/true,-/staff/false', 'staff messages by role without a name; own messages marked');
reset role;

-- Managers and others read nothing (AC-11-3) -----------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select is((select count(*)::int from public.messages) + (select count(*)::int from public.conversations), 0, 'the manager reads no conversation and no message (AC-11-3)');
select throws_ok($$select * from api.conversation_messages(pg_temp.conv())$$, '42501', 'PERMISSION_DENIED', 'not through the display RPC either');
reset role;
select pg_temp.login('c1', 'aal2');
select is((select count(*)::int from public.messages), 0, 'the platform admin reads nothing (NEG-10)');
reset role;
select pg_temp.login('f2');
select is((select count(*)::int from public.messages), 0, 'the other guardian without receives_messages reads nothing');
select throws_ok($$insert into public.messages (organization_id, conversation_id, sender_id, body)
  values ('d4f00000-0000-4000-8000-00000000000a', pg_temp.conv(), 'd4f00000-0000-4000-8000-0000000000f2', 'x')$$, '42501', null, 'no direct insert');
reset role;

-- Withdraw within 5 minutes (FR-11-5) -------------------------------------------------------------------------------------
select pg_temp.login('e1');
select throws_ok($$select api.withdraw_message(pg_temp.msg('Lana danas ide ranije, oko 14 h.'))$$, '42501', 'PERMISSION_DENIED', 'only the sender withdraws');
reset role;
select pg_temp.login('f1');
select lives_ok($$select api.withdraw_message(pg_temp.msg('Lana danas ide ranije, oko 14 h.'))$$, 'the sender withdraws within 5 minutes');
reset role;
select is((select count(*)::int from public.messages where body is null and withdrawn_at is not null and conversation_id = pg_temp.conv()), 1, 'the text is removed; "poruka uklonjena" stays');
select pg_temp.login('f1');
select throws_ok($$select api.withdraw_message((select id from public.messages where body is null and conversation_id = pg_temp.conv()))$$, 'P0001', 'MESSAGE_ALREADY_WITHDRAWN', 'not twice');
reset role;
update public.messages set created_at = now() - interval '6 minutes' where body = 'Hvala, zabiljezeno.';
select pg_temp.login('e3');
select throws_ok($$select api.withdraw_message(pg_temp.msg('Hvala, zabiljezeno.'))$$, 'P0001', 'MESSAGE_WITHDRAW_EXPIRED', 'not after 5 minutes');
reset role;
select is((select string_agg(action || coalesce(details::text, ''), ',' order by id) from audit.audit_events where target_table = 'messages'
           and target_id = (select id from public.messages where body is null and conversation_id = pg_temp.conv())),
  'messages.insert{},messages.update{"changed_columns": ["body", "withdrawn_at"]}', 'audit with ids and column names only, never the text');

-- AC-11-2: a former educator loses the whole conversation; NEG-09 -----------------------------------------------------------
update public.staff_assignments set valid_during = daterange(current_date - 30, current_date) where id = 'd4f00000-0000-4000-8000-00000000a5e3';
select pg_temp.login('e3');
select is((select count(*)::int from public.messages) + (select count(*)::int from public.conversations), 0, 'after the assignment ends E3 reads nothing, not even own messages (AC-11-2)');
select throws_ok($$select api.send_message(pg_temp.conv(), 'Jos nesto')$$, '42501', 'PERMISSION_DENIED', 'and cannot send');
reset role;
update public.memberships set status = 'suspended' where id = 'd4f00000-0000-4000-8000-0000000001f1';
select pg_temp.login('f1');
select is((select count(*)::int from public.messages), 0, 'a suspended guardian reads nothing (NEG-09)');
reset role;

select * from finish();
rollback;
