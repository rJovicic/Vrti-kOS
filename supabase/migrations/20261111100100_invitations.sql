-- VrtićOS D1 — invitations (FS-01): single use, time limited, bound to a verified e-mail address.
-- Created by managers (RLS + AAL2) through the invite-member Edge Function; accepted only through
-- api.accept_invitations, which is executable by service_role alone (accept-invitations Edge Function).

create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  email extensions.citext not null check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.org_role not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  accepted_by uuid references public.profiles (id) on delete restrict,
  accepted_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete restrict,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint invitations_expiry_window check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
-- At most one open invitation per person, role and kindergarten.
create unique index invitations_one_pending_uq on public.invitations (organization_id, email, role) where status = 'pending';
create index invitations_email_pending_idx on public.invitations (lower(email::text)) where status = 'pending';
comment on table public.invitations is 'Pozivnica u vrtić. Jednokratna, vremenski ograničena, vezana uz e-adresu. Sensitivity R2.';

-- Guard: clients may only revoke a pending invitation; the revoker and time are set by the database.
create function private.guard_invitations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Only an org_admin may hand out org_admin rights; a director cannot escalate (roles matrix "Ogr.").
    -- platform_admin is not an org_role value at all, so it can never be invited.
    if new.role = 'org_admin' and not private.has_org_role(new.organization_id, array['org_admin']::public.org_role[]) then
      raise exception 'ONLY_ORG_ADMIN_MAY_INVITE_ORG_ADMIN' using errcode = '42501';
    end if;
    new.created_by := (select auth.uid());
    new.status := 'pending';
    return new;
  end if;
  if old.status <> 'pending' or new.status <> 'revoked' then
    raise exception 'INVITATION_ONLY_PENDING_CAN_BE_REVOKED' using errcode = '42501';
  end if;
  new.revoked_by := (select auth.uid());
  new.revoked_at := now();
  return new;
end $$;
create trigger invitations_guard before insert or update on public.invitations
  for each row execute function private.guard_invitations();
create trigger invitations_tenant_guard before update on public.invitations
  for each row execute function private.guard_tenant_columns();
create trigger invitations_touch before update on public.invitations
  for each row execute function private.touch_updated_at();
create trigger invitations_audit after insert or update on public.invitations
  for each row execute function private.audit_row();
revoke execute on function private.guard_invitations() from public, anon, authenticated;

alter table public.invitations enable row level security;
create policy invitations_select on public.invitations for select to authenticated
  using ((select private.is_org_manager(organization_id)));
create policy invitations_insert on public.invitations for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy invitations_update on public.invitations for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
grant insert (organization_id, email, role, first_name, last_name) on public.invitations to authenticated;
grant update (status) on public.invitations to authenticated;

-- Acceptance ------------------------------------------------------------------------------------------
-- True only if the Auth user exists, owns this e-mail and the address is confirmed. Definer because
-- auth.users is not readable by API roles; executable by service_role only.
create function private.auth_email_verified(p_user_id uuid, p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and lower(u.email) = lower(p_email) and u.email_confirmed_at is not null
  )
$$;
revoke execute on function private.auth_email_verified(uuid, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.auth_email_verified(uuid, text) to service_role;
grant execute on function private.org_today(uuid) to service_role;

-- SECURITY INVOKER and executable only by service_role (which bypasses RLS). The Edge Function passes the
-- user id and e-mail it obtained from Auth for the verified session — never from user_metadata or the body.
create function api.accept_invitations(p_user_id uuid, p_email text)
returns table (invitation_id uuid, organization_id uuid, role public.org_role)
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.invitations%rowtype;
  v_today date;
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
    insert into public.profiles (id, first_name, last_name)
    values (p_user_id, inv.first_name, inv.last_name)
    on conflict (id) do nothing;

    v_today := private.org_today(inv.organization_id);
    insert into public.memberships (organization_id, profile_id, role, status, valid_during, created_by)
    values (inv.organization_id, p_user_id, inv.role, 'active', daterange(v_today, null), inv.created_by)
    on conflict on constraint memberships_organization_id_profile_id_role_key
    do update set status = 'active', valid_during = daterange(v_today, null);

    update public.invitations
       set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
     where id = inv.id;

    insert into public.audit_events (organization_id, actor_id, action, target_table, target_id, details)
    values (inv.organization_id, p_user_id, 'invitation.accepted', 'invitations', inv.id, jsonb_build_object('role', inv.role));

    invitation_id := inv.id; organization_id := inv.organization_id; role := inv.role;
    return next;
  end loop;
end $$;
revoke execute on function api.accept_invitations(uuid, text) from public, anon, authenticated;
grant usage on schema api to service_role;
grant execute on function api.accept_invitations(uuid, text) to service_role;
