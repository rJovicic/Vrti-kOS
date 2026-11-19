-- D-43: private Realtime Broadcast (migration 20261119150000_realtime_broadcast.sql; docs/architecture/realtime.md).
-- Who receives which event is decided in the database at event time from the read rules; the only channel rule is
-- "your own user:<id> topic". Checks: recipients per event kind, cross-tenant isolation, a second guardian, revocation
-- (assignment ended, group change, restriction) while nothing about the subscription changes, idempotent replays,
-- payload minimality and the realtime.messages policies exactly as Realtime evaluates them. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- People (suffix = last two hex digits of the id): a1 org_admin A, e1 educator A/S1, e2 educator A/S2, f1 and f2
-- guardians A (both of child d1; f2 also of d2), b1 org_admin B, eb educator B/SB.
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d43a0000-0000-4000-8000-0000000000' || x)::uuid, 'rt-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f2', 'b1', 'eb']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd43a0000-%';
insert into public.organizations (id, name, slug) values
  ('d43a0000-0000-4000-8000-00000000000a', 'Test RT A', 'test-rt-a'),
  ('d43a0000-0000-4000-8000-00000000000b', 'Test RT B', 'test-rt-b');
insert into public.facilities (id, organization_id, name) values
  ('d43a0000-0000-4000-8000-0000000000fa', 'd43a0000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d43a0000-0000-4000-8000-0000000000fb', 'd43a0000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d43a0000-0000-4000-8000-0000000000aa', 'd43a0000-0000-4000-8000-00000000000a', 'PG', current_date - 90, current_date + 300, 'active'),
  ('d43a0000-0000-4000-8000-0000000000ab', 'd43a0000-0000-4000-8000-00000000000b', 'PG', current_date - 90, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d43a0000-0000-4000-8000-000000000051', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000fa', 'd43a0000-0000-4000-8000-0000000000aa', 'S1'),
  ('d43a0000-0000-4000-8000-000000000052', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000fa', 'd43a0000-0000-4000-8000-0000000000aa', 'S2'),
  ('d43a0000-0000-4000-8000-00000000005b', 'd43a0000-0000-4000-8000-00000000000b', 'd43a0000-0000-4000-8000-0000000000fb', 'd43a0000-0000-4000-8000-0000000000ab', 'SB');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d43a0000-0000-4000-8000-0000000001' || x)::uuid, ('d43a0000-0000-4000-8000-00000000000' || o)::uuid,
       ('d43a0000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 90, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'),
             ('f2', 'a', 'guardian'), ('b1', 'b', 'org_admin'), ('eb', 'b', 'educator')) v(x, o, r);
insert into public.staff_assignments (id, organization_id, membership_id, group_id, valid_during) values
  ('d43a0000-0000-4000-8000-0000000005e1', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000001e1', 'd43a0000-0000-4000-8000-000000000051', daterange(current_date - 90, null)),
  ('d43a0000-0000-4000-8000-0000000005e2', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000001e2', 'd43a0000-0000-4000-8000-000000000052', daterange(current_date - 90, null)),
  ('d43a0000-0000-4000-8000-0000000005eb', 'd43a0000-0000-4000-8000-00000000000b', 'd43a0000-0000-4000-8000-0000000001eb', 'd43a0000-0000-4000-8000-00000000005b', daterange(current_date - 90, null));
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d43a0000-0000-4000-8000-0000000000' || x)::uuid, ('d43a0000-0000-4000-8000-00000000000' || o)::uuid, 'Dijete', x, null
from (values ('d1', 'a'), ('d2', 'a'), ('db', 'b')) v(x, o);
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d43a0000-0000-4000-8000-00000000e001', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000d1', 'd43a0000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d43a0000-0000-4000-8000-00000000e002', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000d2', 'd43a0000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d43a0000-0000-4000-8000-00000000e00b', 'd43a0000-0000-4000-8000-00000000000b', 'd43a0000-0000-4000-8000-0000000000db', 'd43a0000-0000-4000-8000-00000000005b', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d43a0000-0000-4000-8000-000000000a10', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000f1', 'Ana', 'Prva', null),
  ('d43a0000-0000-4000-8000-000000000a20', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000f2', 'Ivan', 'Drugi', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d43a0000-0000-4000-8000-00000000c001', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000d1', 'd43a0000-0000-4000-8000-000000000a10', true, true, true, daterange(current_date - 30, null), null),
  ('d43a0000-0000-4000-8000-00000000c002', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000d1', 'd43a0000-0000-4000-8000-000000000a20', true, true, true, daterange(current_date - 30, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d43a0000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.c(x text) returns uuid language sql as $$ select ('d43a0000-0000-4000-8000-0000000000' || x)::uuid $$;
grant execute on function pg_temp.c(text) to authenticated;
create temp table seen (id uuid primary key);
grant all on seen to authenticated;
create function pg_temp.mark() returns void language sql as $$
  delete from seen; insert into seen select id from realtime.messages;
$$;
-- Recipients (id suffixes) of the events of one kind since the last mark.
create function pg_temp.got(p_event text) returns text[] language sql as $$
  select coalesce(array_agg(distinct right(m.topic, 2) order by right(m.topic, 2)), '{}')
  from realtime.messages m where m.event = p_event and not exists (select 1 from seen s where s.id = m.id)
$$;
create function pg_temp.count_new() returns bigint language sql as $$
  select count(*) from realtime.messages m where not exists (select 1 from seen s where s.id = m.id)
$$;

-- 1. Attendance -------------------------------------------------------------------------------------------------------
create temp table key1 as select gen_random_uuid() k;
grant select on key1 to authenticated;
select pg_temp.mark();
select pg_temp.login('e1');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d1'), 'check_in', (select k from key1))$$, 'educator of S1 records an arrival for D1');
reset role;
select is(pg_temp.got('attendance'), array['a1', 'e1'], 'attendance: the educator of the group and the manager — not S2, guardians or kindergarten B');
select is((select array_agg(k order by k) from realtime.messages m, jsonb_object_keys(m.payload) k
           where m.event = 'attendance' and m.topic like '%a1' and not exists (select 1 from seen s where s.id = m.id)),
          array['child_id', 'id', 'kind', 'local_date', 'organization_id', 'record_id'], 'attendance payload: ids, kind and day only');
select is((select bool_and(m.private) from realtime.messages m where not exists (select 1 from seen s where s.id = m.id)), true, 'every event is private');

select pg_temp.mark();
select pg_temp.login('e1');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d1'), 'check_in', (select k from key1))$$, 'replaying the same idempotency key');
reset role;
select is(pg_temp.count_new(), 0::bigint, 'an idempotent replay sends nothing (no duplicate event)');

-- 2. Messages and notifications --------------------------------------------------------------------------------------
create temp table conv (id uuid);
grant all on conv to authenticated;
select pg_temp.mark();
select pg_temp.login('f1');
insert into conv select api.open_conversation(pg_temp.c('d1'));
select lives_ok($$select api.send_message((select id from conv), 'Pitanje za odgojiteljicu')$$, 'guardian F1 writes in her conversation about D1');
reset role;
select is(pg_temp.got('message'), array['e1', 'f1'], 'message: only the participants of that conversation (F1 and the S1 educator) — not the second guardian F2');
select is(pg_temp.got('notification'), array['e1'], 'notification: only its recipient (the sender gets none)');
select is((select count(*) from realtime.messages m where not exists (select 1 from seen s where s.id = m.id)
           and (m.payload ? 'body' or m.payload::text like '%Pitanje%')), 0::bigint, 'no message text in any payload');

-- Withdrawal by the sender within 5 minutes: the same participants are told (no text either way).
select pg_temp.mark();
select pg_temp.login('f1');
select lives_ok($$select api.withdraw_message((select m.id from public.messages m where m.conversation_id = (select id from conv) order by m.created_at desc limit 1))$$, 'F1 withdraws her message');
reset role;
select is(pg_temp.got('message'), array['e1', 'f1'], 'withdrawal: the same participants only, still not the second guardian');

-- 3. Announcements -----------------------------------------------------------------------------------------------------
select pg_temp.mark();
insert into public.announcements (id, organization_id, author_id, title, body, audience_scope, audience_ids, audience_roles, status, published_at)
values ('d43a0000-0000-4000-8000-0000000a0001', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000a1',
        'Izlet', 'Tekst', 'group', array['d43a0000-0000-4000-8000-000000000052'::uuid], array['staff', 'guardians'], 'published', now());
select is(pg_temp.got('announcement'), array['a1', 'e2'], 'published announcement for S2: its audience (S2 educator) and the managers');
select pg_temp.mark();
update public.announcements set status = 'archived', archived_at = now() where id = 'd43a0000-0000-4000-8000-0000000a0001';
select is(pg_temp.got('announcement'), array['a1', 'e2'], 'archiving: the audience that had it and the managers are told to refresh');
select pg_temp.mark();
insert into public.announcements (id, organization_id, author_id, title, body, audience_scope, audience_ids, audience_roles, status)
values ('d43a0000-0000-4000-8000-0000000a0002', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000a1',
        'Nacrt', 'Tekst', 'organization', '{}', array['staff', 'guardians'], 'draft');
select is(pg_temp.got('announcement'), array['a1'], 'a draft reaches only the managers');

-- Editing a published announcement to another audience: the previous audience (S2) and the new one (S1) refresh.
insert into public.announcements (id, organization_id, author_id, title, body, audience_scope, audience_ids, audience_roles, status, published_at)
values ('d43a0000-0000-4000-8000-0000000a0003', 'd43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000a1',
        'Promjena', 'Tekst', 'group', array['d43a0000-0000-4000-8000-000000000052'::uuid], array['staff'], 'published', now());
select pg_temp.mark();
update public.announcements set audience_ids = array['d43a0000-0000-4000-8000-000000000051'::uuid], edited_at = now() where id = 'd43a0000-0000-4000-8000-0000000a0003';
select is(pg_temp.got('announcement'), array['a1', 'e1', 'e2'], 'audience change: old audience (S2), new audience (S1) and the managers');
select is((select count(*) from realtime.messages m where m.event = 'announcement' and not exists (select 1 from seen s where s.id = m.id)
           and m.payload::text like '%Promjena%'), 0::bigint, 'announcement events carry no title or text');

-- 4. Kindergarten B ---------------------------------------------------------------------------------------------------
select pg_temp.mark();
select pg_temp.login('eb');
select lives_ok($$select * from api.record_attendance(pg_temp.c('db'), 'check_in', gen_random_uuid())$$, 'educator of B records an arrival');
reset role;
select is(pg_temp.got('attendance'), array['b1', 'eb'], 'B attendance reaches only B (no one from A)');

-- 5. Revocation at event time ------------------------------------------------------------------------------------------
-- S1 assignment of E1 ends today (end "from today"): the next event no longer reaches E1.
update public.staff_assignments set valid_during = daterange(lower(valid_during), current_date) where id = 'd43a0000-0000-4000-8000-0000000005e1';
select pg_temp.mark();
select pg_temp.login('a1', 'aal2');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d2'), 'check_in', gen_random_uuid())$$, 'manager records an arrival for D2 after E1 left S1');
reset role;
select is(pg_temp.got('attendance'), array['a1'], 'former educator E1 receives nothing for S1 any more');
-- D2 moves from S1 to S2 today: events about D2 now reach the S2 educator.
update public.enrollments set valid_during = daterange(lower(valid_during), current_date) where id = 'd43a0000-0000-4000-8000-00000000e002';
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
values ('d43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-0000000000d2', 'd43a0000-0000-4000-8000-000000000052', daterange(current_date, null), null);
select pg_temp.mark();
select pg_temp.login('a1', 'aal2');
select lives_ok($$select * from api.record_attendance(pg_temp.c('d2'), 'check_out', gen_random_uuid())$$, 'manager records a departure for D2 after the group change');
reset role;
select is(pg_temp.got('attendance'), array['a1', 'e2'], 'after the group change the S2 educator receives D2 events');
-- E1 back in S1 for the message checks, then F1 is restricted from today: her conversation events stop reaching her.
update public.staff_assignments set valid_during = daterange(current_date - 90, null) where id = 'd43a0000-0000-4000-8000-0000000005e1';
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by)
values ('d43a0000-0000-4000-8000-00000000000a', 'd43a0000-0000-4000-8000-00000000c001', daterange(current_date, null), null);
select pg_temp.mark();
select pg_temp.login('e1');
select lives_ok($$select api.send_message((select id from conv), 'Odgovor')$$, 'educator answers in F1''s conversation after the restriction');
reset role;
select is(pg_temp.got('message'), array['e1'], 'restricted guardian F1 no longer receives events of that conversation');

-- 6. Channel authorization exactly as Realtime evaluates it (insert as the service, then read as the user) -------------
insert into realtime.messages (id, topic, extension, payload, event, private)
values ('d43a0000-0000-4000-8000-00000000aa01', 'user:d43a0000-0000-4000-8000-0000000000f2', 'broadcast', '{}', 'probe', true),
       ('d43a0000-0000-4000-8000-00000000aa02', 'user:d43a0000-0000-4000-8000-0000000000f2', 'presence', '{}', 'probe', true);
create function pg_temp.can_read(p_who text, p_topic text, p_ext text) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform set_config('realtime.topic', p_topic, true);
  if p_who is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform pg_temp.login(p_who);
  end if;
  select exists (select 1 from realtime.messages m where m.topic = p_topic and m.extension = p_ext) into v;
  perform set_config('role', 'postgres', true);
  return v;
end $$;
select is(pg_temp.can_read('f2', 'user:d43a0000-0000-4000-8000-0000000000f2', 'broadcast'), true, 'a user may receive her own topic');
select is(pg_temp.can_read('f1', 'user:d43a0000-0000-4000-8000-0000000000f2', 'broadcast'), false, 'another user of the same kindergarten may not');
select is(pg_temp.can_read('b1', 'user:d43a0000-0000-4000-8000-0000000000f2', 'broadcast'), false, 'a manager of another kindergarten may not');
select is(pg_temp.can_read('f2', 'user:d43a0000-0000-4000-8000-0000000000f2', 'presence'), false, 'presence is not allowed, not even on the own topic');
select is(pg_temp.can_read(null, 'user:d43a0000-0000-4000-8000-0000000000f2', 'broadcast'), false, 'anonymous receives nothing');
select is(pg_temp.can_read('f1', 'org:d43a0000-0000-4000-8000-00000000000a', 'broadcast'), false, 'no other topic shape is authorized');
select pg_temp.login('f2');
select set_config('realtime.topic', 'user:d43a0000-0000-4000-8000-0000000000f2', true);
select throws_ok($$insert into realtime.messages (topic, extension, payload, event, private) values ('user:d43a0000-0000-4000-8000-0000000000f2', 'broadcast', '{}', 'x', true)$$,
                 '42501', null, 'clients cannot send, not even to their own topic');
reset role;

-- 7. Catalog ------------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd <> 'SELECT'), 0::bigint,
          'realtime.messages has no insert/update/delete policy');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname like 'realtime_%'
             and (not p.prosecdef or not coalesce(p.proconfig, '{}') @> array['search_path=""'])), 0::bigint,
          'every realtime trigger function is SECURITY DEFINER with an empty search_path');
select is((select count(*) from pg_publication_tables where pubname = 'supabase_realtime'), 0::bigint,
          'no table is published for postgres_changes');

select * from finish();
rollback;
