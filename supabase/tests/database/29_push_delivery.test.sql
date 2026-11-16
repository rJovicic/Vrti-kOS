-- D-40: push tokens and the delivery queue (migration 20261117100000_push_delivery.sql). SR-PUSH-02 (tokens unreadable
-- by clients, only own registration), SR-PUSH-03 / AC-08-3 (removal on sign-out and on provider feedback), token moves
-- with the account on a shared device, claim/report only for the service role, outcomes and retries, no_device,
-- pruning. Synthetic tokens only, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4d00000-0000-4000-8000-0000000000' || x)::uuid, 'push-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['b1', 'b2', 'b3']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4d00000-%';
insert into public.organizations (id, name, slug) values ('d4d00000-0000-4000-8000-00000000000a', 'Test Push', 'test-push');
insert into public.memberships (organization_id, profile_id, role, valid_during)
select 'd4d00000-0000-4000-8000-00000000000a', ('d4d00000-0000-4000-8000-0000000000' || x)::uuid, 'guardian', daterange(current_date - 30, null)
from unnest(array['b1', 'b2', 'b3']) x;

create function pg_temp.login(x text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4d00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.p(x text) returns uuid language sql as $$ select ('d4d00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.n(k int) returns uuid language sql as $$ select ('d4d00000-0000-4000-8000-' || lpad(k::text, 12, '0'))::uuid $$;
-- A pending notification for a recipient (as the D4 fan-out would create it).
create function pg_temp.pending(k int, who text) returns void language sql as $$
  insert into public.notifications (id, organization_id, recipient_id, type, resource_type, resource_id, push_status)
  values (pg_temp.n(k), 'd4d00000-0000-4000-8000-00000000000a', pg_temp.p(who), 'message.received', 'conversation', gen_random_uuid(), 'pending')
$$;
create function pg_temp.status(k int) returns text language sql as $$
  select push_status || '/' || push_attempts || '/' || (push_next_attempt_at is not null)::text from public.notifications where id = pg_temp.n(k)
$$;
grant execute on function pg_temp.p(text), pg_temp.n(int) to authenticated, service_role;

-- Catalog ---------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass), 'RLS on push_tokens');
select ok(not has_table_privilege('authenticated', 'public.push_tokens', 'SELECT,INSERT,UPDATE,DELETE')
          and not has_table_privilege('anon', 'public.push_tokens', 'SELECT'), 'no client reads or writes the table (SR-PUSH-02)');
select is((select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'push_tokens'),
  'created_at,last_seen_at,platform,profile_id,token', 'minimal: token, platform and times — no device name, model or OS');
select ok(not has_function_privilege('authenticated', 'api.push_claim(integer)', 'EXECUTE')
          and not has_function_privilege('authenticated', 'api.push_report(jsonb, text[])', 'EXECUTE')
          and not has_function_privilege('anon', 'api.push_claim(integer)', 'EXECUTE'), 'the delivery queue is not callable by clients');
select ok(has_function_privilege('service_role', 'api.push_claim(integer)', 'EXECUTE'), 'the service role (delivery worker) can claim');

-- Registration ----------------------------------------------------------------------------------------------------------
select pg_temp.login('b1');
select lives_ok($$select api.register_push_token('ExponentPushToken[synthetic-aaaa01]', 'ios')$$, 'a person registers the own device');
select lives_ok($$select api.register_push_token('ExponentPushToken[synthetic-aaaa01]', 'ios')$$, 'registering again is idempotent');
select throws_ok($$select api.register_push_token('Lea Babic', 'ios')$$, 'P0001', 'PUSH_TOKEN_INVALID', 'only the Expo token format');
select throws_ok($$select api.register_push_token('ExponentPushToken[synthetic-aaaa02]', 'windows')$$, 'P0001', 'PUSH_TOKEN_INVALID', 'only ios or android');
select throws_ok($$select * from public.push_tokens$$, '42501', null, 'not even the own token can be read back');
reset role;
select is((select profile_id from public.push_tokens where token = 'ExponentPushToken[synthetic-aaaa01]'), pg_temp.p('b1'), 'stored for the caller');
select pg_temp.login('b2');
select lives_ok($$select api.register_push_token('ExponentPushToken[synthetic-aaaa01]', 'ios')$$, 'another account signs in on the same device');
select lives_ok($$select api.unregister_push_token('ExponentPushToken[synthetic-aaaa99]')$$, 'removing an unknown token does nothing');
reset role;
select is((select profile_id from public.push_tokens where token = 'ExponentPushToken[synthetic-aaaa01]'), pg_temp.p('b2'),
  'the token moved: the first account no longer receives push on that device');
select pg_temp.login('b1');
select lives_ok($$select api.unregister_push_token('ExponentPushToken[synthetic-aaaa01]')$$, 'the former account cannot remove it');
reset role;
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[synthetic-aaaa01]'), 1, '— it is still registered for the second account');
select pg_temp.login('b2');
select lives_ok($$select api.unregister_push_token('ExponentPushToken[synthetic-aaaa01]')$$, 'sign-out removes the token (AC-08-3)');
reset role;
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[synthetic-aaaa01]'), 0, 'gone');

-- Delivery queue (service role) --------------------------------------------------------------------------------------------
insert into public.push_tokens (token, profile_id, platform) values
  ('ExponentPushToken[synthetic-u1-001]', pg_temp.p('b1'), 'ios'),
  ('ExponentPushToken[synthetic-u1-002]', pg_temp.p('b1'), 'android'),
  ('ExponentPushToken[synthetic-u3-001]', pg_temp.p('b3'), 'ios');
select pg_temp.pending(1, 'b1');
select pg_temp.pending(2, 'b2');
select pg_temp.pending(3, 'b3');
set local role service_role;
select is((select string_agg(notification_id::text || ':' || array_length(tokens, 1), ',' order by notification_id) from api.push_claim(10)),
  pg_temp.n(1)::text || ':2,' || pg_temp.n(3)::text || ':1', 'claim returns ids, type and the recipient''s tokens — no content');
reset role;
select is(pg_temp.status(1) || ',' || pg_temp.status(2), 'sending/1/false,no_device/0/false', 'claimed rows are "sending"; a recipient without a device is closed as no_device');
set local role service_role;
select is((select count(*)::int from api.push_claim(10)), 0, 'a row being sent is not claimed twice');
select lives_ok(format($$select api.push_report('[{"id": "%s", "outcome": "sent"}, {"id": "%s", "outcome": "error"}]'::jsonb, array['ExponentPushToken[synthetic-u3-001]'])$$, pg_temp.n(1), pg_temp.n(3)),
  'the worker reports the outcome and an unregistered token');
reset role;
select is(pg_temp.status(1) || ',' || pg_temp.status(3), 'sent/1/false,pending/1/true', 'sent is final; an error is retried later (backoff)');
select is((select count(*)::int from public.push_tokens where profile_id = pg_temp.p('b3')), 0, 'the token the provider no longer knows is deleted (SR-PUSH-03)');
update public.notifications set push_attempts = 5, push_status = 'sending' where id = pg_temp.n(3);
set local role service_role;
select lives_ok(format($$select api.push_report('[{"id": "%s", "outcome": "error"}]'::jsonb)$$, pg_temp.n(3)), 'a fifth failure');
reset role;
select is(pg_temp.status(3), 'failed/5/false', 'after 5 attempts the row is failed (visible in the app anyway)');

select * from finish();
rollback;
