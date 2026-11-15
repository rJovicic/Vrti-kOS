-- D4-A: notification core (migration 20261116110000_notifications.sql). FR-08-1/3/4, FR-06-5, SR-PUSH-01: content-free
-- rows, written only by the fan-out; recipients of an absence report = educators of the child's group in that period
-- (not other groups, not suspended members, not the reporter); push state follows the preference; own rows only;
-- marking read only own rows; preferences own only; NEG-01/07/09/10. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4a00000-0000-4000-8000-0000000000' || x)::uuid, 'ntf-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'e3', 'e4', 'f1', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4a00000-%';
insert into private.platform_admins (profile_id) values ('d4a00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d4a00000-0000-4000-8000-00000000000a', 'Test Obavijesti A', 'test-ntf-a'),
  ('d4a00000-0000-4000-8000-00000000000b', 'Test Obavijesti B', 'test-ntf-b');
insert into public.facilities (id, organization_id, name) values
  ('d4a00000-0000-4000-8000-0000000000fa', 'd4a00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d4a00000-0000-4000-8000-0000000000fb', 'd4a00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4a00000-0000-4000-8000-0000000000aa', 'd4a00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d4a00000-0000-4000-8000-0000000000bb', 'd4a00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4a00000-0000-4000-8000-000000000051', 'd4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000000fa', 'd4a00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d4a00000-0000-4000-8000-000000000052', 'd4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000000fa', 'd4a00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d4a00000-0000-4000-8000-000000000061', 'd4a00000-0000-4000-8000-00000000000b', 'd4a00000-0000-4000-8000-0000000000fb', 'd4a00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during, status)
select ('d4a00000-0000-4000-8000-0000000001' || x)::uuid, ('d4a00000-0000-4000-8000-00000000000' || o)::uuid, ('d4a00000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null), s::public.membership_status
from (values ('a1', 'a', 'org_admin', 'active'), ('e1', 'a', 'educator', 'active'), ('e2', 'a', 'educator', 'active'),
             ('e3', 'a', 'educator', 'active'), ('e4', 'a', 'educator', 'suspended'), ('f1', 'a', 'guardian', 'active'),
             ('b1', 'b', 'educator', 'active')) v(x, o, r, s);
-- E1 in S1 now; E3 in S1 from tomorrow (substitute in the absence period); E2 in S2; E4 in S1 but suspended; B1 in B.
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000001e1', 'd4a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000001e3', 'd4a00000-0000-4000-8000-000000000051', daterange(current_date + 1, current_date + 3)),
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000001e2', 'd4a00000-0000-4000-8000-000000000052', daterange(current_date - 30, null)),
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000001e4', 'd4a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4a00000-0000-4000-8000-00000000000b', 'd4a00000-0000-4000-8000-0000000001b1', 'd4a00000-0000-4000-8000-000000000061', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d4a00000-0000-4000-8000-0000000000d1', 'd4a00000-0000-4000-8000-00000000000a', 'Ivo', 'Test', null);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by) values
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000000d1', 'd4a00000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d4a00000-0000-4000-8000-000000000a01', 'd4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null);
insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, can_report_absence, valid_during, created_by) values
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-0000000000d1', 'd4a00000-0000-4000-8000-000000000a01', true, true, daterange(current_date - 30, null), null);
-- E1 turned push off for absence reports; E3 left the default.
insert into public.notification_preferences (profile_id, type, push_enabled) values ('d4a00000-0000-4000-8000-0000000000e1', 'absence.reported', false);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4a00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.p(x text) returns uuid language sql as $$ select ('d4a00000-0000-4000-8000-0000000000' || x)::uuid $$;
grant execute on function pg_temp.p(text) to authenticated;

-- Catalog ------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), 'RLS on notifications');
select ok((select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass), 'RLS on preferences');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'notifications'
  and column_name ~* 'title|body|text|name|content|group'), 0, 'no content column: a notification carries no title, text, name or group (SR-PUSH-01)');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients never write notifications directly');
select ok(not has_table_privilege('anon', 'public.notifications', 'SELECT'), 'anon reads nothing (NEG-15)');
select ok(not (select prosecdef from pg_proc where oid = 'api.mark_notifications_read(uuid[])'::regprocedure), 'the exposed RPC is SECURITY INVOKER (SR-API-01)');
select ok(not has_function_privilege('authenticated', 'private.notify(uuid, uuid[], public.notification_type, text, uuid)', 'EXECUTE'), 'nobody calls the fan-out directly');

-- Fan-out of an absence report (FR-06-5) -------------------------------------------------------------------------------
select pg_temp.login('f1');
select lives_ok($$select api.report_absence(pg_temp.p('d1'), current_date + 1, current_date + 2)$$, 'the guardian reports an absence');
reset role;
select is((select string_agg(split_part(p.last_name, '-', 2), ',' order by p.last_name) from public.notifications n join public.profiles p on p.id = n.recipient_id where n.organization_id = 'd4a00000-0000-4000-8000-00000000000a'),
  'e1,e3', 'recipients: educators of the child''s group in the absence period (incl. a substitute) — not S2, not the suspended one, not the reporter, not the manager');
select is((select string_agg(split_part(p.last_name, '-', 2) || ':' || n.push_status, ',' order by p.last_name) from public.notifications n join public.profiles p on p.id = n.recipient_id where n.organization_id = 'd4a00000-0000-4000-8000-00000000000a'),
  'e1:not_applicable,e3:pending', 'push state follows the preference: off for E1, default on for E3 (FR-08-4, AC-08-1)');
select is((select string_agg(distinct n.type::text || '/' || n.resource_type, ',') from public.notifications n where n.organization_id = 'd4a00000-0000-4000-8000-00000000000a'), 'absence.reported/absence_record', 'type and resource reference only');

-- Reading and marking read ---------------------------------------------------------------------------------------------
select pg_temp.login('e1');
select is((select count(*)::int from public.notifications), 1, 'E1 reads exactly the own notification');
select is((select api.mark_notifications_read(array[(select id from public.notifications limit 1)])), 1, 'E1 marks it read');
select is((select api.mark_notifications_read()), 0, 'nothing left unread');
select is((select api.mark_notifications_read(array[(select n.id from public.notifications n where false)] ||
  array(select id from public.notifications))), 0, 'already read rows are not touched again');
reset role;
select pg_temp.login('e1');
select is(api.mark_notifications_read((select array_agg(id) from public.notifications)), 0, 'E1 cannot mark anything else');
reset role;
select ok((select read_at is null from public.notifications where recipient_id = pg_temp.p('e3')), 'E3''s notification stays unread');
select pg_temp.login('e1');
select throws_ok($$update public.notifications set read_at = null$$, '42501', null, 'no direct update');
select throws_ok($$insert into public.notifications (organization_id, recipient_id, type, resource_type, resource_id)
  values ('d4a00000-0000-4000-8000-00000000000a', pg_temp.p('e3'), 'absence.reported', 'absence_record', gen_random_uuid())$$, '42501', null, 'no direct insert (no forged notifications)');

-- Preferences: own only --------------------------------------------------------------------------------------------------
select is((select count(*)::int from public.notification_preferences), 1, 'E1 reads only own preferences');
select throws_ok($$insert into public.notification_preferences (profile_id, type, push_enabled) values (pg_temp.p('e3'), 'message.received', false)$$,
  '42501', null, 'cannot set another person''s preference');
select throws_ok($$update public.notification_preferences set profile_id = pg_temp.p('e3')$$, '42501', null,
  'cannot move an own preference onto another person (update WITH CHECK)');
reset role;

-- Who reads nothing ----------------------------------------------------------------------------------------------------
select pg_temp.login('e2');
select is((select count(*)::int from public.notifications), 0, 'an educator of another group (NEG-07)');
reset role;
select pg_temp.login('b1');
select is((select count(*)::int from public.notifications), 0, 'another kindergarten (NEG-01)');
reset role;
select pg_temp.login('c1', 'aal2');
select is((select count(*)::int from public.notifications), 0, 'the platform admin (NEG-10)');
reset role;
update public.memberships set status = 'suspended' where id = 'd4a00000-0000-4000-8000-0000000001e3';
select pg_temp.login('e3');
select is((select count(*)::int from public.notifications), 0, 'a member suspended after the event reads nothing of that kindergarten (NEG-09)');
reset role;

select * from finish();
rollback;
