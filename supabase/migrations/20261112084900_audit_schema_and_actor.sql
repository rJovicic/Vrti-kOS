-- VrtićOS — R-51: align the audit log with SR-AUD-01/02 (FR-09-2/3).
-- 1. The table moves out of the exposed schema into `audit` (not in [api] schemas). `public.audit_events` stays as a
--    read-only security_invoker VIEW with the same name and columns, so existing reads (manager RLS, tests, service
--    role) keep working; no client role can write through it.
-- 2. Every row carries the actor's role in that kindergarten at the time of the event (`actor_role`), 'system' when no
--    person acted, filled by the database (never by the caller).
-- 3. correlation_id is filled from `app.correlation_id` or the validated `x-correlation-id` request header.
-- 4. Server writes through the service key may attribute a row to the person they act for (`x-actor-id`, honoured
--    only for a service_role JWT) and are marked `details.via = 'service'`.
-- 5. Append-only for everyone through the API: no UPDATE/DELETE/TRUNCATE grants for authenticated or service_role, and
--    a trigger refuses UPDATE for every role. Deletion stays reserved for the retention job (R-53, Phase 12).
-- 6. api.record_audit_event: service_role-only (SECURITY INVOKER) entry for denied/failed privileged attempts that are
--    rejected outside a database transaction (Edge Functions), with an allow-listed shape.

create schema audit;
revoke all on schema audit from public, anon;
grant usage on schema audit to authenticated, service_role;

alter table public.audit_events set schema audit;

alter table audit.audit_events
  add column actor_role text,
  add constraint audit_events_actor_role_check
    check (actor_role in ('org_admin', 'director', 'educator', 'guardian', 'platform_admin', 'none', 'system')),
  add constraint audit_events_correlation_id_check
    check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9._-]{8,64}$');
-- Existing rows (synthetic demo data only): derive what can be derived, never invent a person.
update audit.audit_events set actor_role = case when actor_id is null then 'system' else 'none' end where actor_role is null;
alter table audit.audit_events alter column actor_role set not null;
comment on table audit.audit_events is
  'Append-only audit log (SR-AUD-01/02). No values of personal data, only IDs and column names. Not exposed; read through public.audit_events. Sensitivity R3.';

-- Grants: managers read through RLS (policy audit_events_select moved with the table); the service role reads and
-- inserts; nobody updates, deletes or truncates through the API.
revoke all on audit.audit_events from public, anon, authenticated, service_role;
grant select on audit.audit_events to authenticated;
grant select, insert on audit.audit_events to service_role;

-- Actor role at event time: the highest active role of that person in that kindergarten, platform_admin for
-- platform operators without a membership there, 'none' otherwise, 'system' when no person is attributable.
create function private.audit_actor_role(p_org uuid, p_actor uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_actor is null then 'system'
    else coalesce(
      (select m.role::text from public.memberships m
        where m.organization_id = p_org and m.profile_id = p_actor and m.status = 'active'
          and m.valid_during @> private.org_today(m.organization_id)
        order by case m.role when 'org_admin' then 1 when 'director' then 2 when 'educator' then 3 else 4 end
        limit 1),
      case when exists (select 1 from private.platform_admins pa where pa.profile_id = p_actor) then 'platform_admin' end,
      'none')
  end
$$;
revoke execute on function private.audit_actor_role(uuid, uuid) from public, anon, authenticated;

-- Fills the database-owned fields of every new audit row, whoever writes it.
create function private.audit_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_headers jsonb;
  v_hdr_actor text;
  v_hdr_corr text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  -- Service-key writes may name the person they act for; only a service_role JWT is trusted with this header.
  if new.actor_id is null and (select auth.role()) = 'service_role' then
    v_hdr_actor := v_headers ->> 'x-actor-id';
    if v_hdr_actor ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      new.actor_id := v_hdr_actor::uuid;
      new.details := coalesce(new.details, '{}'::jsonb) || jsonb_build_object('via', 'service');
    end if;
  end if;
  new.actor_role := private.audit_actor_role(new.organization_id, new.actor_id);
  if new.correlation_id is null then
    v_hdr_corr := coalesce(nullif(current_setting('app.correlation_id', true), ''), v_headers ->> 'x-correlation-id');
    if v_hdr_corr ~ '^[A-Za-z0-9._-]{8,64}$' then
      new.correlation_id := v_hdr_corr;
    end if;
  end if;
  new.occurred_at := now();
  return new;
end $$;
revoke execute on function private.audit_fill() from public, anon, authenticated;
create trigger audit_events_fill before insert on audit.audit_events
  for each row execute function private.audit_fill();

create function private.audit_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'AUDIT_APPEND_ONLY' using errcode = '42501';
end $$;
revoke execute on function private.audit_append_only() from public, anon, authenticated;
create trigger audit_events_no_update before update on audit.audit_events
  for each row execute function private.audit_append_only();

-- Read path with the old name and columns (+ actor_role). security_invoker: the caller's RLS applies.
create view public.audit_events with (security_invoker = true) as
  select id, organization_id, occurred_at, actor_id, actor_role, action, target_table, target_id, outcome,
         correlation_id, details
  from audit.audit_events;
comment on view public.audit_events is 'Read-only view of audit.audit_events (SR-AUD-02). RLS of the table applies.';
revoke all on public.audit_events from public, anon, authenticated, service_role;
grant select on public.audit_events to authenticated, service_role;

-- Trigger-generated audit rows now write to the audit schema.
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_changed text[];
begin
  v_org := case when tg_table_name = 'organizations' then new.id else (to_jsonb(new) ->> 'organization_id')::uuid end;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at') and n.value is distinct from (to_jsonb(old) -> n.key);
  end if;
  insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
  values (
    v_org,
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    new.id,
    case when v_changed is null then '{}'::jsonb else jsonb_build_object('changed_columns', to_jsonb(v_changed)) end
  );
  return new;
end $$;

-- Acceptance: unchanged behaviour (R-48), audit rows go to the audit schema.
create or replace function api.accept_invitations(p_user_id uuid, p_email text)
returns table (invitation_id uuid, organization_id uuid, role public.org_role)
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.invitations%rowtype;
  v_today date;
  v_membership public.memberships%rowtype;
begin
  if p_user_id is null or p_email is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  if not private.auth_email_verified(p_user_id, p_email) then
    raise exception 'EMAIL_NOT_VERIFIED' using errcode = '42501';
  end if;
  for inv in
    select * from public.invitations i
    -- explicit lower(): with an empty search_path the citext '=' operator is not visible and the
    -- comparison would silently fall back to case-sensitive text equality (found by pgTAP, 2026-11-11)
    where lower(i.email::text) = lower(p_email) and i.status = 'pending' and i.expires_at > now()
    order by i.created_at
    for update
  loop
    v_today := private.org_today(inv.organization_id);

    select * into v_membership from public.memberships m
     where m.organization_id = inv.organization_id and m.profile_id = p_user_id and m.role = inv.role
     for update;

    if found and v_membership.status = 'suspended' then
      -- R-48: consume the invitation, keep the suspension, record the refusal.
      update public.invitations set status = 'revoked', revoked_at = now() where id = inv.id;
      insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, outcome, details)
      values (inv.organization_id, p_user_id, 'invitation.accept_refused', 'invitations', inv.id, 'denied',
              jsonb_build_object('reason', 'membership_suspended', 'role', inv.role));
      continue;
    end if;

    insert into public.profiles (id, first_name, last_name)
    values (p_user_id, inv.first_name, inv.last_name)
    on conflict (id) do nothing;

    if v_membership.id is null then
      insert into public.memberships (organization_id, profile_id, role, status, valid_during, created_by)
      values (inv.organization_id, p_user_id, inv.role, 'active', daterange(v_today, null), inv.created_by);
    elsif v_membership.status = 'ended' or not (v_membership.valid_during @> v_today) then
      -- A person whose membership ended may be invited again (unchanged rule).
      update public.memberships set status = 'active', valid_during = daterange(v_today, null)
       where id = v_membership.id;
    end if;
    -- An active membership valid today is left unchanged: the invitation is simply accepted.

    update public.invitations
       set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
     where id = inv.id;

    insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
    values (inv.organization_id, p_user_id, 'invitation.accepted', 'invitations', inv.id, jsonb_build_object('role', inv.role));

    invitation_id := inv.id; organization_id := inv.organization_id; role := inv.role;
    return next;
  end loop;
end $$;

-- Denied or failed privileged attempts rejected outside a database transaction (Edge Functions, ST-AUD-02).
-- Allow-listed shape: action `<entity>.<event>`, outcome denied|error, reason = a public error code, no free text.
-- The kindergarten is recorded only if it exists, so the caller cannot learn anything and no FK error leaks.
create function api.record_audit_event(
  p_organization_id uuid, p_actor_id uuid, p_action text, p_target_table text, p_outcome text, p_reason text
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_action !~ '^[a-z_]{3,40}\.[a-z_]{3,40}$' or p_target_table !~ '^[a-z_]{3,40}$'
     or p_outcome not in ('denied', 'error') or p_reason !~ '^[A-Z][A-Z_]{2,60}$' then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  insert into audit.audit_events (organization_id, actor_id, action, target_table, outcome, details)
  values (
    (select o.id from public.organizations o where o.id = p_organization_id),
    p_actor_id, p_action, p_target_table, p_outcome, jsonb_build_object('reason', p_reason, 'via', 'service')
  );
end $$;
revoke execute on function api.record_audit_event(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function api.record_audit_event(uuid, uuid, text, text, text, text) to service_role;
