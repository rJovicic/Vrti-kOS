-- SR-SESS-04 option B: session age and inactivity limits per role, enforced by the custom_access_token hook
-- (migration 20261126100000_session_limits.sql). now() is fixed inside this transaction, so each limit is tested
-- exactly at the boundary: one second before the limit a token is issued, at the limit it is refused.
-- Synthetic fixtures, rolled back. Real-GoTrue behaviour: tests/integration/src/session-limits.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

-- Fixtures ------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d5360000-0000-4000-8000-0000000000' || n)::uuid, 'sl-' || n || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['01','02','03','04','05','06','07','08','09','10','11']) n;
insert into public.profiles (id, first_name, last_name)
select ('d5360000-0000-4000-8000-0000000000' || n)::uuid, 'Sesija', n
from unnest(array['01','02','03','04','05','06','07','08','09','10','11']) n;
insert into public.organizations (id, name, slug) values
  ('d5360000-0000-4000-8000-00000000000a', 'Sesije A', 'sesije-a'),
  ('d5360000-0000-4000-8000-00000000000b', 'Sesije B', 'sesije-b');
insert into private.platform_admins (profile_id) values ('d5360000-0000-4000-8000-000000000009');
-- 01 director · 02 educator · 03 guardian · 04 educator in A + guardian in B · 05 director in A + guardian in B
-- 06 no role · 07 suspended director + active guardian · 08 director (ratchet) · 09 platform admin
-- 10 guardian (promotion) · 11 membership that ended yesterday + future membership only
insert into public.memberships (organization_id, profile_id, role, status, valid_during)
select o::uuid, ('d5360000-0000-4000-8000-0000000000' || p)::uuid, r::public.org_role, s::public.membership_status, v
from (values
  ('d5360000-0000-4000-8000-00000000000a', '01', 'director',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '02', 'educator',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '03', 'guardian',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '04', 'educator',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000b', '04', 'guardian',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '05', 'director',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000b', '05', 'guardian',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '07', 'director',  'suspended', daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000b', '07', 'guardian',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '08', 'director',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000b', '08', 'guardian',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000b', '10', 'guardian',  'active',    daterange(current_date - 30, null)),
  ('d5360000-0000-4000-8000-00000000000a', '11', 'educator',  'active',    daterange(current_date - 30, current_date - 1)),
  ('d5360000-0000-4000-8000-00000000000b', '11', 'guardian',  'active',    daterange(current_date + 5, null))
) t(o, p, r, s, v);

-- A session created `age` ago, last refreshed `idle` ago (NULL = never refreshed). refreshed_at is UTC without zone.
create function pg_temp.sess(p text, age interval, idle interval default null) returns uuid language sql as $$
  insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
  values (gen_random_uuid(), ('d5360000-0000-4000-8000-0000000000' || p)::uuid, now() - age, now() - age,
          case when idle is null then null else (now() - idle) at time zone 'UTC' end)
  returning id;
$$;
-- 'ok' when a token is issued (event returned unchanged), otherwise the refusal's HTTP code.
create function pg_temp.verdict(p text, sid uuid, method text default 'token_refresh') returns text language plpgsql as $$
declare
  ev jsonb := jsonb_build_object('user_id', 'd5360000-0000-4000-8000-0000000000' || p, 'authentication_method', method,
    'claims', jsonb_build_object('sub', 'd5360000-0000-4000-8000-0000000000' || p, 'session_id', sid, 'aal', 'aal2',
      'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', 2), jsonb_build_object('method', 'otp', 'timestamp', 1))));
  res jsonb := auth_hooks.custom_access_token(ev);
begin
  if res ? 'error' then return res -> 'error' ->> 'http_code'; end if;
  if res <> ev then return 'changed'; end if;
  return 'ok';
end $$;

-- Catalog and privileges ------------------------------------------------------------------------------------------
select has_table('auth_hooks', 'session_limits', 'session_limits table exists');
select ok((select relrowsecurity from pg_class where oid = 'auth_hooks.session_limits'::regclass), 'session_limits has RLS enabled');
select ok(not has_table_privilege('authenticated', 'auth_hooks.session_limits', 'SELECT') and not has_table_privilege('anon', 'auth_hooks.session_limits', 'SELECT')
  and not has_table_privilege('supabase_auth_admin', 'auth_hooks.session_limits', 'SELECT'), 'no role but the hook owner can read session_limits');
select ok(not has_function_privilege('authenticated', 'auth_hooks.session_role_limits(uuid)', 'EXECUTE'), 'API roles cannot call session_role_limits');
select ok(has_function_privilege('supabase_auth_admin', 'auth_hooks.custom_access_token(jsonb)', 'EXECUTE'), 'Auth may execute the hook');
select ok(not has_function_privilege('authenticated', 'auth_hooks.custom_access_token(jsonb)', 'EXECUTE'), 'authenticated may not execute the hook');
select is((select confdeltype::text from pg_constraint where conrelid = 'auth_hooks.session_limits'::regclass and contype = 'f'), 'c',
  'frozen limits go with the Auth session (cascade)');

-- Limits per role --------------------------------------------------------------------------------------------------
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000001')), '(manager,"7 days",08:00:00)', 'director: 7 days / 8 hours');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000002')), '(staff,"30 days","30 days")', 'educator: 30 days / 30 days');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000003')), '(guardian,"90 days","30 days")', 'guardian: 90 days / 30 days');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000004')), '(staff,"30 days","30 days")', 'educator in A + guardian in B: the stricter (staff)');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000005')), '(manager,"7 days",08:00:00)', 'director in A + guardian in B: manager limits');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000006')), '(,"7 days",08:00:00)', 'no role: strictest limits, no class');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000007')), '(guardian,"90 days","30 days")', 'a suspended director role does not count');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000009')), '(manager,"7 days",08:00:00)', 'platform admin: manager limits');
select is((select row(role_class, max_age, idle_timeout)::text from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000011')), '(,"7 days",08:00:00)', 'ended and not-yet-valid memberships do not count');

-- New sessions of every role get a token and freeze their limits -----------------------------------------------------
select is(pg_temp.verdict('01', pg_temp.sess('01', '1 second'), 'otp'), 'ok', 'new manager session: token issued, event unchanged (AAL2 claims kept)');
select is(pg_temp.verdict('02', pg_temp.sess('02', '1 second'), 'otp'), 'ok', 'new staff session: token issued');
select is(pg_temp.verdict('03', pg_temp.sess('03', '1 second'), 'otp'), 'ok', 'new guardian session: token issued');
select is(pg_temp.verdict('06', pg_temp.sess('06', '1 second'), 'otp'), 'ok', 'new session without a role (invitation not yet accepted): token issued');
select is((select array_agg(role_class order by role_class) from auth_hooks.session_limits where user_id in
  ('d5360000-0000-4000-8000-000000000001', 'd5360000-0000-4000-8000-000000000002', 'd5360000-0000-4000-8000-000000000003', 'd5360000-0000-4000-8000-000000000006')),
  array['guardian', 'manager', 'staff'], 'limits frozen for each role; nothing frozen for a person without a role');

-- Maximum age, at the boundary (never refreshed: inactivity counts from creation, so it is kept inside its limit) ------
select is(pg_temp.verdict('01', pg_temp.sess('01', '7 days' - interval '1 second', '1 minute')), 'ok', 'manager: 1 s before 7 days → token');
select is(pg_temp.verdict('01', pg_temp.sess('01', '7 days', '1 minute')), '401', 'manager: at 7 days → refused');
select is(pg_temp.verdict('02', pg_temp.sess('02', '30 days' - interval '1 second', '1 minute')), 'ok', 'staff: 1 s before 30 days → token');
select is(pg_temp.verdict('02', pg_temp.sess('02', '30 days', '1 minute')), '401', 'staff: at 30 days → refused');
select is(pg_temp.verdict('03', pg_temp.sess('03', '90 days' - interval '1 second', '1 minute')), 'ok', 'guardian: 1 s before 90 days → token');
select is(pg_temp.verdict('03', pg_temp.sess('03', '90 days', '1 minute')), '401', 'guardian: at 90 days → refused');

-- Inactivity, at the boundary (from the last refresh; from creation when never refreshed) -------------------------------
select is(pg_temp.verdict('01', pg_temp.sess('01', '2 days', '8 hours' - interval '1 second')), 'ok', 'manager: idle 1 s under 8 h → token');
select is(pg_temp.verdict('01', pg_temp.sess('01', '2 days', '8 hours')), '401', 'manager: idle 8 h → refused');
select is(pg_temp.verdict('01', pg_temp.sess('01', '8 hours')), '401', 'manager: never refreshed for 8 h → refused (inactivity from creation)');
select is(pg_temp.verdict('02', pg_temp.sess('02', '31 days', '30 days' - interval '1 second')), '401', 'staff: age over 30 days wins even when idle is under its limit');
select is(pg_temp.verdict('02', pg_temp.sess('02', '29 days', '29 days' - interval '1 second')), 'ok', 'staff: idle under 30 days → token');
select is(pg_temp.verdict('03', pg_temp.sess('03', '60 days', '30 days' - interval '1 second')), 'ok', 'guardian: 60-day-old session, idle 1 s under 30 days → token');
select is(pg_temp.verdict('03', pg_temp.sess('03', '60 days', '30 days')), '401', 'guardian: idle 30 days → refused');

-- An active session that refreshes regularly lives until its maximum age, not longer --------------------------------
select is(pg_temp.verdict('01', pg_temp.sess('01', '6 days 23 hours', '10 minutes')), 'ok', 'manager refreshing every few minutes: still valid just before 7 days');
select is(pg_temp.verdict('01', pg_temp.sess('01', '7 days 1 minute', '10 minutes')), '401', 'manager refreshing every few minutes: refused after 7 days');

-- Several roles: the strictest applies ------------------------------------------------------------------------------
select is(pg_temp.verdict('05', pg_temp.sess('05', '8 days', '1 minute')), '401', 'director + guardian: 8-day-old session refused (manager limit, not guardian)');
select is(pg_temp.verdict('05', pg_temp.sess('05', '1 day', '9 hours')), '401', 'director + guardian: 9 h idle refused (manager inactivity)');
select is(pg_temp.verdict('04', pg_temp.sess('04', '31 days', '1 minute')), '401', 'educator + guardian: 31-day-old session refused (staff limit)');

-- Suspended membership ----------------------------------------------------------------------------------------------
select is(pg_temp.verdict('07', pg_temp.sess('07', '10 days', '1 minute')), 'ok', 'suspended director, active guardian: guardian limits (suspension removes the role, RLS removes the data)');

-- No role: strictest limits, not frozen -----------------------------------------------------------------------------
select is(pg_temp.verdict('06', pg_temp.sess('06', '8 days', '1 minute')), '401', 'no role: 8-day-old session refused');
select is(pg_temp.verdict('06', pg_temp.sess('06', '1 day', '9 hours')), '401', 'no role: 9 h idle refused');

-- Role change during a session: limits only tighten ------------------------------------------------------------------
create temp table ratchet as select pg_temp.sess('08', '10 days', '1 minute') as sid;
grant all on ratchet to public;
update public.memberships set valid_during = daterange(current_date - 30, null) where profile_id = 'd5360000-0000-4000-8000-000000000008';
select is(pg_temp.verdict('08', (select sid from ratchet), 'otp'), '401', 'director + guardian, 10 days: refused');
-- A younger session of the same person freezes manager limits; then the director role ends.
update ratchet set sid = pg_temp.sess('08', '1 day', '1 minute');
select is(pg_temp.verdict('08', (select sid from ratchet), 'otp'), 'ok', 'director + guardian, 1 day: token; manager limits frozen');
update public.memberships set valid_during = daterange(current_date - 30, current_date)
 where profile_id = 'd5360000-0000-4000-8000-000000000008' and role = 'director';
select is((select role_class from auth_hooks.session_role_limits('d5360000-0000-4000-8000-000000000008')), 'guardian', 'the person is now only a guardian');
update auth.sessions set created_at = now() - interval '8 days' where id = (select sid from ratchet);
select is(pg_temp.verdict('08', (select sid from ratchet)), '401', 'demotion does not lengthen the running session: still refused after 7 days');
select is((select max_age from auth_hooks.session_limits where session_id = (select sid from ratchet)), interval '7 days', 'frozen limit unchanged by the demotion');
-- A new membership in another kindergarten does not lengthen it either.
insert into public.memberships (organization_id, profile_id, role, status, valid_during)
values ('d5360000-0000-4000-8000-00000000000a', 'd5360000-0000-4000-8000-000000000008', 'guardian', 'active', daterange(current_date - 1, null));
select is(pg_temp.verdict('08', (select sid from ratchet)), '401', 'another kindergarten''s membership does not lengthen it');

-- Promotion tightens at the next token.
update ratchet set sid = pg_temp.sess('10', '10 days', '1 minute');
select is(pg_temp.verdict('10', (select sid from ratchet)), 'ok', 'guardian, 10-day-old session: token (guardian limits frozen)');
insert into public.memberships (organization_id, profile_id, role, status, valid_during)
values ('d5360000-0000-4000-8000-00000000000a', 'd5360000-0000-4000-8000-000000000010', 'director', 'active', daterange(current_date - 1, null));
select is(pg_temp.verdict('10', (select sid from ratchet)), '401', 'promoted to director: the same session is refused at the next token (manager limit)');
select is((select row(role_class, max_age)::text from auth_hooks.session_limits where session_id = (select sid from ratchet)), '(manager,"7 days")', 'frozen limits tightened to manager');

-- Fail closed --------------------------------------------------------------------------------------------------------
select is((auth_hooks.custom_access_token('{"user_id":"d5360000-0000-4000-8000-000000000001","authentication_method":"token_refresh","claims":{"amr":[{"method":"otp","timestamp":1}]}}') -> 'error' ->> 'http_code'),
  '401', 'no session id in the claims → refused');
select is(pg_temp.verdict('01', gen_random_uuid()), '401', 'unknown session → refused');
select is(pg_temp.verdict('02', pg_temp.sess('01', '1 second')), '401', 'another person''s session → refused');
select throws_ok($$select auth_hooks.custom_access_token('{"user_id":"x","authentication_method":"otp","claims":{"session_id":"y"}}')$$, '22P02', null,
  'malformed ids raise (Auth issues no token on a hook error)');

select * from finish();
rollback;
