-- VrtićOS — D-40 (owner, 2026-11-16): push delivery through Expo Push (ADR-0007 option A), built but NOT activated.
--
--   * public.push_tokens: the device token of a signed-in person, treated as personal data (minimization): only the
--     token, the platform and timestamps — no device name, model or OS version. Not tenant-owned (a person's device, like
--     notification_preferences). Clients never read tokens (SR-PUSH-02); they register and remove their own through RPCs.
--     A token belongs to one account at a time: registering it for another account moves it (shared device, sign-in as
--     someone else). Lifecycle: registered after sign-in with permission → removed on sign-out (AC-08-3), on the
--     provider's "device not registered" feedback (SR-PUSH-03), or when not seen for 60 days (private.prune_push_tokens,
--     to be scheduled with activation).
--   * Outbox = public.notifications.push_status (D4-A). The delivery worker (Edge Function push-dispatch, service role
--     only) claims due rows (`pending`, next attempt due), applies the delivery policy (hook for Q-T05 — quiet period —
--     which is NOT decided: no rule is implemented), sends a generic payload through an adapter and reports back:
--     sent / deferred (next attempt time) / failed after 5 attempts / no_device. Invalid tokens are deleted.
--   * The real Expo adapter is off: it refuses to run unless the owner has approved activation AND a delivery policy
--     for Q-T05 is confirmed (packages/domain/src/push-dispatch.ts). Locally only the mock adapter runs.

alter table public.notifications drop constraint notifications_push_status_check;
alter table public.notifications add constraint notifications_push_status_check
  check (push_status in ('not_applicable', 'pending', 'sending', 'sent', 'failed', 'no_device'));
alter table public.notifications add column push_next_attempt_at timestamptz;
create index notifications_push_due_idx on public.notifications (push_next_attempt_at nulls first, created_at)
  where push_status = 'pending';

create table public.push_tokens (
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,64}\]$'),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_profile_idx on public.push_tokens (profile_id);
comment on table public.push_tokens is
  'D-40: token uređaja za push (osobni podatak; samo token, platforma, vremena). Klijenti ga ne čitaju; briše se pri odjavi.';

alter table public.push_tokens enable row level security;
-- No policies for clients: nobody reads or writes tokens through the API tables (SR-PUSH-02).
revoke all on public.push_tokens from anon, authenticated;

-- Registration (own account only) ---------------------------------------------------------------------------------------
create function private.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,64}\]$' or p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'PUSH_TOKEN_INVALID';
  end if;
  insert into public.push_tokens (token, profile_id, platform)
  values (p_token, (select auth.uid()), p_platform)
  on conflict (token) do update set profile_id = excluded.profile_id, platform = excluded.platform, last_seen_at = now(),
    created_at = case when public.push_tokens.profile_id = excluded.profile_id then public.push_tokens.created_at else now() end;
end $$;

-- Removes the caller's token (sign-out). Removing an unknown token or another account's token does nothing.
create function private.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_tokens t where t.token = p_token and t.profile_id = (select auth.uid());
end $$;

revoke execute on function private.register_push_token(text, text) from public, anon;
revoke execute on function private.unregister_push_token(text) from public, anon;
grant execute on function private.register_push_token(text, text) to authenticated;
grant execute on function private.unregister_push_token(text) to authenticated;

create function api.register_push_token(p_token text, p_platform text) returns void
language sql security invoker set search_path = '' as $$ select private.register_push_token(p_token, p_platform) $$;
create function api.unregister_push_token(p_token text) returns void
language sql security invoker set search_path = '' as $$ select private.unregister_push_token(p_token) $$;
revoke execute on function api.register_push_token(text, text) from public, anon;
revoke execute on function api.unregister_push_token(text) from public, anon;
grant execute on function api.register_push_token(text, text) to authenticated;
grant execute on function api.unregister_push_token(text) to authenticated;
comment on function api.register_push_token(text, text) is 'D-40: prijava tokena uređaja za vlastiti račun (bez čitanja tokena).';
comment on function api.unregister_push_token(text) is 'D-40: uklanjanje vlastitog tokena pri odjavi (AC-08-3).';

-- Delivery worker (service role only) ------------------------------------------------------------------------------------
-- Claims up to p_limit due notifications and returns what the worker needs: ids, organization, type, the recipient's
-- tokens. Never content. Rows without a token are closed as `no_device` here.
create function private.push_claim(p_limit integer)
returns table (notification_id uuid, organization_id uuid, type public.notification_type, attempts integer, tokens text[])
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.notifications n set push_status = 'no_device'
  where n.push_status = 'pending' and (n.push_next_attempt_at is null or n.push_next_attempt_at <= now())
    and not exists (select 1 from public.push_tokens t where t.profile_id = n.recipient_id);
  return query
    with due as (
      select n.id from public.notifications n
      where n.push_status = 'pending' and (n.push_next_attempt_at is null or n.push_next_attempt_at <= now())
      order by n.created_at
      limit greatest(1, least(coalesce(p_limit, 100), 500))
      for update skip locked
    ), claimed as (
      update public.notifications n set push_status = 'sending', push_attempts = n.push_attempts + 1
      from due where n.id = due.id
      returning n.id, n.organization_id, n.type, n.push_attempts, n.recipient_id
    )
    select c.id, c.organization_id, c.type, c.push_attempts,
           array(select t.token from public.push_tokens t where t.profile_id = c.recipient_id order by t.token)
    from claimed c;
end $$;

-- Reports the outcome per notification and the tokens the provider rejected as no longer registered.
-- p_results: [{"id": uuid, "outcome": "sent" | "deferred" | "error", "retry_at": timestamptz?}]
create function private.push_report(p_results jsonb, p_invalid_tokens text[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
begin
  delete from public.push_tokens t where t.token = any (coalesce(p_invalid_tokens, '{}'));
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    update public.notifications n set
      push_status = case r ->> 'outcome'
                      when 'sent' then 'sent'
                      when 'deferred' then 'pending'
                      else case when n.push_attempts >= 5 then 'failed' else 'pending' end end,
      push_next_attempt_at = case r ->> 'outcome'
                               when 'sent' then null
                               when 'deferred' then (r ->> 'retry_at')::timestamptz
                               else case when n.push_attempts >= 5 then null
                                         else now() + make_interval(mins => power(2, least(n.push_attempts, 6))::int) end end,
      -- A deferral is not an attempt.
      push_attempts = case when r ->> 'outcome' = 'deferred' then greatest(n.push_attempts - 1, 0) else n.push_attempts end
    where n.id = (r ->> 'id')::uuid and n.push_status = 'sending';
  end loop;
end $$;

-- Tokens not seen for the given time are removed (to be scheduled with activation; documented lifecycle).
create function private.prune_push_tokens(p_unused interval default interval '60 days') returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v integer;
begin
  delete from public.push_tokens t where t.last_seen_at < now() - p_unused;
  get diagnostics v = row_count;
  return v;
end $$;

revoke execute on function private.push_claim(integer) from public, anon, authenticated;
revoke execute on function private.push_report(jsonb, text[]) from public, anon, authenticated;
revoke execute on function private.prune_push_tokens(interval) from public, anon, authenticated;
grant execute on function private.push_claim(integer) to service_role;
grant execute on function private.push_report(jsonb, text[]) to service_role;
grant execute on function private.prune_push_tokens(interval) to service_role;

create function api.push_claim(p_limit integer default 100)
returns table (notification_id uuid, organization_id uuid, type public.notification_type, attempts integer, tokens text[])
language sql volatile security invoker set search_path = '' as $$ select * from private.push_claim(p_limit) $$;
create function api.push_report(p_results jsonb, p_invalid_tokens text[] default '{}') returns void
language sql volatile security invoker set search_path = '' as $$ select private.push_report(p_results, p_invalid_tokens) $$;
revoke execute on function api.push_claim(integer) from public, anon, authenticated;
revoke execute on function api.push_report(jsonb, text[]) from public, anon, authenticated;
grant execute on function api.push_claim(integer) to service_role;
grant execute on function api.push_report(jsonb, text[]) to service_role;
comment on function api.push_claim(integer) is 'D-40: samo dostavni proces (service role) — preuzimanje obavijesti za push, bez sadržaja.';
comment on function api.push_report(jsonb, text[]) is 'D-40: samo dostavni proces — ishod slanja i nevažeći tokeni.';
