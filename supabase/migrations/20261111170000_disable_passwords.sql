-- VrtićOS — R-49: passwords are disabled for every user (owner decision 2026-11-11, incl. managers and platform admin).
-- Sign-in is the 6-digit e-mail code (+ TOTP for managers, ADR-0008/0017). Verified in GoTrue v2.197.0 source:
--   * no Auth setting or hook can stop `PUT /auth/v1/user {password}`: `secure_password_change` only applies to
--     sessions older than 24 h, and "require current password" only when a usable password exists;
--   * the password_verification_attempt hook covers sign-in only and is Teams/Enterprise-only on hosted Supabase.
-- Therefore two independent controls:
--   1. a trigger on auth.users refuses every password change (user update, admin API, recovery flow) and stores
--      new accounts without a password hash — setting a password becomes impossible;
--   2. a custom_access_token hook (Free/Pro plans) refuses to issue any access token for a password-based session,
--      at sign-in and on refresh — covers passwords that existed before this migration.

create schema if not exists auth_hooks;
comment on schema auth_hooks is 'Functions called by Supabase Auth (GoTrue). Not exposed through the Data API.';
revoke all on schema auth_hooks from public, anon, authenticated;
grant usage on schema auth_hooks to supabase_auth_admin;

-- 1. No password may be stored ----------------------------------------------------------------------------
-- INSERT: GoTrue's admin API stores a random 64-character password when an account is created without one
-- (internal/api/admin.go:459, v2.197.0) — that is how invite-member creates accounts. The hash is neutralised
-- (stored empty) instead of failing, so account creation keeps working and no password exists.
-- UPDATE: any attempt to set or change a password (PUT /user, recovery flow, admin API) is refused.
create function auth_hooks.reject_password_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(new.encrypted_password, '') = '' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.encrypted_password := '';
    return new;
  end if;
  if new.encrypted_password is distinct from old.encrypted_password then
    raise exception 'PASSWORDS_DISABLED' using errcode = '42501',
      hint = 'VrtićOS signs in with an e-mail code only (R-49, ADR-0008).';
  end if;
  return new;
end $$;
revoke all on function auth_hooks.reject_password_write() from public, anon, authenticated;

create trigger vrticos_reject_password_write
  before insert or update of encrypted_password on auth.users
  for each row execute function auth_hooks.reject_password_write();

-- Remove any password stored before this migration (clearing is allowed by the trigger).
update auth.users set encrypted_password = '' where coalesce(encrypted_password, '') <> '';

-- 2. No token for a password-based session ------------------------------------------------------------------
-- Input (GoTrue v2.197.0): { user_id, claims: { ..., amr: [{ method, timestamp }] }, authentication_method }.
-- authentication_method is 'password' at password sign-in and 'token_refresh' on refresh; amr keeps the methods
-- the session was created with, so a password session is also refused on refresh. Every other token passes unchanged.
create function auth_hooks.custom_access_token(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  if event ->> 'authentication_method' = 'password'
     or exists (
       select 1 from jsonb_array_elements(coalesce(event -> 'claims' -> 'amr', '[]'::jsonb)) as e(entry)
       where jsonb_typeof(e.entry) = 'object' and e.entry ->> 'method' = 'password'
     ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Password sign-in is disabled. Use the e-mail code.'));
  end if;
  return event;
end $$;
revoke all on function auth_hooks.custom_access_token(jsonb) from public, anon, authenticated;
grant execute on function auth_hooks.custom_access_token(jsonb) to supabase_auth_admin;
