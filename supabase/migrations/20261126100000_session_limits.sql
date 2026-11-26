-- VrtićOS — SR-SESS-04, option B (owner decision 2026-11-25; guardian limits set to 30 days / 14 days for the pilot
-- on 2026-11-26 — docs/security/pre-pilot-decisions.md §1.4 and §7.1, ADR-0019):
-- session lifetime and inactivity limits per role, enforced in the custom_access_token hook, i.e. every time Auth
-- issues an access token: at sign-in, at MFA verification and at every refresh.
--
--   class      roles                          max age (from auth.sessions.created_at)  inactivity
--   manager    org_admin, director, platform  7 days                                    8 hours
--   staff      educator                       30 days                                   30 days
--   guardian   guardian                       30 days                                   14 days
--
-- Facts this design relies on (GoTrue v2.197.0 source, scratchpad review 2026-11-26; re-verify on upgrades):
--   * the Postgres hook runs inside the same transaction that creates or refreshes the session, with
--     statement_timeout 2 s (internal/hooks/hookspgfunc); a raised error aborts it and no token is issued;
--   * on refresh, the token is generated BEFORE auth.sessions.refreshed_at is updated (internal/tokens/service.go),
--     so inside the hook refreshed_at is the previous refresh = the last activity (NULL until the first refresh);
--   * auth.sessions.refreshed_at is `timestamp without time zone` in UTC; created_at is timestamptz;
--   * only Auth writes auth.sessions; users cannot change these values (no client grants on schema auth).
--
-- Rules:
--   * age and inactivity come only from auth.sessions (never from claims or user metadata);
--   * several roles → the strictest limit of each kind, separately (educator + guardian: 30 days / 14 days);
--   * limits are frozen per session and can only tighten (auth_hooks.session_limits): a new membership in another
--     kindergarten, a demotion or an ended role never lengthens a running session; a promotion shortens it at the
--     next token. A person with no active role gets the strictest limits, without freezing them, so a freshly
--     invited person (signs in before accepting the invitation) is not locked to manager limits;
--   * fail closed: missing session id, unknown session or any error → no token.
-- Access tokens keep their 15-minute lifetime (jwt_expiry), so a session ends at most 15 minutes after its limit.

-- 1. Frozen limits per session --------------------------------------------------------------------------------
-- Not tenant-owned (one row per Auth session, no organization). RLS on with no policy: no role but the owner (the
-- security-definer hook below) can read or write it; API roles have no grants and no schema usage.
create table auth_hooks.session_limits (
  session_id   uuid primary key references auth.sessions (id) on delete cascade,
  user_id      uuid not null,
  role_class   text not null check (role_class in ('manager', 'staff', 'guardian')),
  max_age      interval not null check (max_age > interval '0'),
  idle_timeout interval not null check (idle_timeout > interval '0'),
  frozen_at    timestamptz not null default now(),
  tightened_at timestamptz
);
comment on table auth_hooks.session_limits is
  'SR-SESS-04: strictest limits seen for each Auth session; only tighten. Written only by the custom_access_token hook; rows go with the session (cascade).';
alter table auth_hooks.session_limits enable row level security;
revoke all on table auth_hooks.session_limits from public, anon, authenticated, supabase_auth_admin;

-- 2. Limits for a person's current roles ---------------------------------------------------------------------
-- Active memberships valid today in each kindergarten's own time zone (same rule as private.member_org_ids), plus
-- platform administrators. Returns one row: the class of the strictest role and the strictest limits.
-- No active role → strictest limits and role_class NULL (the caller does not freeze them).
create function auth_hooks.session_role_limits(p_user uuid)
returns table (role_class text, max_age interval, idle_timeout interval)
language sql stable security definer set search_path = '' as $$
  with roles as (
    select case m.role when 'org_admin' then 'manager' when 'director' then 'manager'
                       when 'educator' then 'staff' else 'guardian' end as role_class
    from public.memberships m
    where m.profile_id = p_user
      and m.status = 'active'
      and m.valid_during @> private.org_today(m.organization_id)
    union all
    select 'manager' from private.platform_admins pa where pa.profile_id = p_user
  ), limits(role_class, max_age, idle_timeout, rank) as (
    values ('manager',  interval '7 days',  interval '8 hours', 1),
           ('staff',    interval '30 days', interval '30 days', 2),
           ('guardian', interval '30 days', interval '14 days', 3)
  )
  select
    (select l.role_class from roles r join limits l using (role_class) order by l.rank limit 1),
    coalesce((select min(l.max_age) from roles r join limits l using (role_class)), interval '7 days'),
    coalesce((select min(l.idle_timeout) from roles r join limits l using (role_class)), interval '8 hours');
$$;
revoke all on function auth_hooks.session_role_limits(uuid) from public, anon, authenticated, supabase_auth_admin;
comment on function auth_hooks.session_role_limits(uuid) is
  'SR-SESS-04: strictest session limits for the person''s active roles today; no role → strictest limits, class NULL.';

-- 3. Hook: password refusal (R-49, unchanged) + session limits ------------------------------------------------
-- security definer (owner postgres): it reads memberships and writes session_limits, which Auth's own role cannot;
-- Auth may only execute it. volatile: it writes.
create or replace function auth_hooks.custom_access_token(event jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user     uuid;
  v_sid      uuid;
  v_created  timestamptz;
  v_last     timestamptz;
  v_now      timestamptz := now();
  v_current  record;
  v_frozen   auth_hooks.session_limits%rowtype;
  v_max_age  interval;
  v_idle     interval;
begin
  -- R-49: no token for a password-based session, at sign-in or on refresh.
  if event ->> 'authentication_method' = 'password'
     or exists (
       select 1 from jsonb_array_elements(coalesce(event -> 'claims' -> 'amr', '[]'::jsonb)) as e(entry)
       where jsonb_typeof(e.entry) = 'object' and e.entry ->> 'method' = 'password'
     ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Password sign-in is disabled. Use the e-mail code.'));
  end if;

  -- SR-SESS-04. Identity and session come from Auth's own event and tables; a malformed value raises (fail closed).
  v_user := (event ->> 'user_id')::uuid;
  v_sid := (event -> 'claims' ->> 'session_id')::uuid;
  if v_user is null or v_sid is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 401, 'message', 'Session expired. Sign in again.'));
  end if;

  select s.created_at, coalesce(s.refreshed_at at time zone 'UTC', s.created_at)
    into v_created, v_last
  from auth.sessions s
  where s.id = v_sid and s.user_id = v_user;
  if v_created is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 401, 'message', 'Session expired. Sign in again.'));
  end if;

  select * into v_current from auth_hooks.session_role_limits(v_user);
  select * into v_frozen from auth_hooks.session_limits where session_id = v_sid for update;

  if v_frozen.session_id is null then
    v_max_age := v_current.max_age;
    v_idle := v_current.idle_timeout;
    if v_current.role_class is not null then
      insert into auth_hooks.session_limits (session_id, user_id, role_class, max_age, idle_timeout)
      values (v_sid, v_user, v_current.role_class, v_current.max_age, v_current.idle_timeout);
    end if;
  else
    -- Only tighten: never longer than what this session already had.
    v_max_age := least(v_frozen.max_age, v_current.max_age);
    v_idle := least(v_frozen.idle_timeout, v_current.idle_timeout);
    if v_current.role_class is not null and (v_max_age < v_frozen.max_age or v_idle < v_frozen.idle_timeout) then
      update auth_hooks.session_limits
         set max_age = v_max_age, idle_timeout = v_idle, role_class = v_current.role_class, tightened_at = v_now
       where session_id = v_sid;
    end if;
  end if;

  if v_now - v_created >= v_max_age or v_now - v_last >= v_idle then
    return jsonb_build_object('error', jsonb_build_object('http_code', 401, 'message', 'Session expired. Sign in again.'));
  end if;
  return event;
end $$;
revoke all on function auth_hooks.custom_access_token(jsonb) from public, anon, authenticated;
grant execute on function auth_hooks.custom_access_token(jsonb) to supabase_auth_admin;
comment on function auth_hooks.custom_access_token(jsonb) is
  'R-49 (no password sessions) + SR-SESS-04 option B (session age and inactivity limits per role; fail closed).';
