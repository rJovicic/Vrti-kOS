-- R-49: passwords are disabled for every user. Trigger on auth.users + custom_access_token hook
-- (migration 20261111170000_disable_passwords.sql). Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixtures: an ordinary user and a platform admin, both without a password ---------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('d4900000-0000-4000-8000-000000000001', 'pw-roditelj@t.test', 'authenticated', 'authenticated', now()),
  ('d4900000-0000-4000-8000-000000000002', 'pw-platforma@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name) values
  ('d4900000-0000-4000-8000-000000000002', 'Test', 'Platforma');
insert into private.platform_admins (profile_id) values ('d4900000-0000-4000-8000-000000000002');

-- Catalog and privileges ------------------------------------------------------------------------------------
select has_trigger('auth', 'users', 'vrticos_reject_password_write', 'auth.users has the password-write trigger');
select has_function('auth_hooks', 'custom_access_token', array['jsonb'], 'custom_access_token hook function exists');
select ok(has_function_privilege('supabase_auth_admin', 'auth_hooks.custom_access_token(jsonb)', 'EXECUTE'), 'Auth may execute the hook');
select ok(not has_function_privilege('anon', 'auth_hooks.custom_access_token(jsonb)', 'EXECUTE'), 'anon may not execute the hook');
select ok(not has_function_privilege('authenticated', 'auth_hooks.custom_access_token(jsonb)', 'EXECUTE'), 'authenticated may not execute the hook');
select ok(not has_schema_privilege('authenticated', 'auth_hooks', 'USAGE'), 'auth_hooks is not usable by API roles');

-- Trigger: no password can be stored, for anyone ----------------------------------------------------------
insert into auth.users (id, email, aud, role, encrypted_password) values ('d4900000-0000-4000-8000-000000000003', 'pw-novi@t.test', 'authenticated', 'authenticated', '$2a$10$abcdefghijklmnopqrstuuJ1Jw0kq3pBfWb3o0Cq0iEJmZqGq5xS');
select is((select encrypted_password from auth.users where id = 'd4900000-0000-4000-8000-000000000003'), '',
  'a new account is stored without a password (GoTrue''s random admin-API password is neutralised)');
select throws_ok($$update auth.users set encrypted_password = '$2a$10$abcdefghijklmnopqrstuuJ1Jw0kq3pBfWb3o0Cq0iEJmZqGq5xS' where id = 'd4900000-0000-4000-8000-000000000001'$$,
  '42501', 'PASSWORDS_DISABLED', 'an existing user cannot set a password (PUT /user, recovery, admin API)');
select throws_ok($$update auth.users set encrypted_password = '$2a$10$abcdefghijklmnopqrstuuJ1Jw0kq3pBfWb3o0Cq0iEJmZqGq5xS' where id = 'd4900000-0000-4000-8000-000000000002'$$,
  '42501', 'PASSWORDS_DISABLED', 'a platform admin cannot set a password either');
select lives_ok($$update auth.users set encrypted_password = '' where id = 'd4900000-0000-4000-8000-000000000001'$$, 'clearing a password is allowed');
select lives_ok($$update auth.users set last_sign_in_at = now(), raw_user_meta_data = '{}' where id = 'd4900000-0000-4000-8000-000000000001'$$, 'other user updates are unaffected');
select is((select count(*)::int from auth.users where coalesce(encrypted_password, '') <> ''), 0, 'no user has a stored password');

-- Hook: password sessions get no token, everything else passes unchanged ----------------------------------
select is(auth_hooks.custom_access_token('{"user_id":"d4900000-0000-4000-8000-000000000001","authentication_method":"password","claims":{"amr":[{"method":"password","timestamp":1}]}}') -> 'error' ->> 'http_code',
  '403', 'password sign-in: token refused');
select is(auth_hooks.custom_access_token('{"user_id":"d4900000-0000-4000-8000-000000000001","authentication_method":"token_refresh","claims":{"amr":[{"method":"password","timestamp":1}]}}') -> 'error' ->> 'http_code',
  '403', 'refresh of a password session: token refused');
select is(auth_hooks.custom_access_token('{"user_id":"d4900000-0000-4000-8000-000000000001","authentication_method":"token_refresh","claims":{"amr":[{"method":"totp","timestamp":2},{"method":"password","timestamp":1}]}}') -> 'error' ->> 'http_code',
  '403', 'password session upgraded with TOTP: still refused');
select is(auth_hooks.custom_access_token('{"user_id":"x","authentication_method":"otp","claims":{"sub":"x","amr":[{"method":"otp","timestamp":1}]}}'),
  '{"user_id":"x","authentication_method":"otp","claims":{"sub":"x","amr":[{"method":"otp","timestamp":1}]}}'::jsonb, 'e-mail code sign-in: event returned unchanged');
select is(auth_hooks.custom_access_token('{"user_id":"x","authentication_method":"token_refresh","claims":{"amr":[{"method":"totp","timestamp":2},{"method":"otp","timestamp":1}]}}'),
  '{"user_id":"x","authentication_method":"token_refresh","claims":{"amr":[{"method":"totp","timestamp":2},{"method":"otp","timestamp":1}]}}'::jsonb, 'refresh of a code + TOTP session: unchanged (AAL2 kept)');
select is(auth_hooks.custom_access_token('{"user_id":"x","authentication_method":"recovery","claims":{"amr":[{"method":"recovery","timestamp":1}]}}') -> 'error',
  null, 'mailbox-based recovery session: not refused by the hook');
select is(auth_hooks.custom_access_token('{"user_id":"x","authentication_method":"otp","claims":{"amr":["password", 3, null]}}') -> 'error',
  null, 'malformed amr entries do not break token issuance');

select * from finish();
rollback;
