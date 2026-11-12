-- VrtićOS — R-48: a pending invitation must never undo a suspension.
-- Before: api.accept_invitations set any existing membership to 'active' (ON CONFLICT DO UPDATE), so an invitation
-- that was pending when a member was suspended re-activated them at their next sign-in.
-- Business rules kept: suspension is per membership (kindergarten + person + role) and is lifted only by a manager
-- ("Ponovno aktiviraj"); a person whose membership ENDED may be invited again; managers need AAL2.
-- Three controls:
--   1. suspending a membership revokes that person's pending invitations for the same kindergarten and role;
--   2. a manager cannot create an invitation for a role whose membership is suspended (reactivate instead);
--   3. acceptance never re-activates a suspended membership: the invitation is consumed (revoked) and audited as
--      denied. Ended or expired memberships are re-activated as before; an active one is left unchanged (idempotent).

-- Helper: does this e-mail address hold a suspended membership with this role in this kindergarten?
-- Definer because auth.users is not readable by API roles. The private schema is not exposed through the Data API;
-- in addition the function answers only for a kindergarten the caller manages (AAL2), so it can never be used to
-- probe other kindergartens, even if it were reachable.
create function private.has_suspended_membership(p_org uuid, p_email text, p_role public.org_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_org_manager(p_org) and exists (
    select 1
    from public.memberships m
    join auth.users u on u.id = m.profile_id
    where m.organization_id = p_org
      and m.role = p_role
      and m.status = 'suspended'
      and lower(u.email) = lower(p_email)
  )
$$;
revoke execute on function private.has_suspended_membership(uuid, text, public.org_role) from public, anon;
grant execute on function private.has_suspended_membership(uuid, text, public.org_role) to authenticated;

-- 2. Invitation guard: authorization first, then the existing org_admin rule, then the suspension rule.
create or replace function private.guard_invitations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Authorization before any data-dependent rule, so callers without rights always get permission_denied and
    -- learn nothing about memberships of a kindergarten they do not manage.
    if not private.is_org_manager(new.organization_id) then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
    -- Only an org_admin may hand out org_admin rights; a director cannot escalate (roles matrix "Ogr.").
    -- platform_admin is not an org_role value at all, so it can never be invited.
    if new.role = 'org_admin' and not private.has_org_role(new.organization_id, array['org_admin']::public.org_role[]) then
      raise exception 'ONLY_ORG_ADMIN_MAY_INVITE_ORG_ADMIN' using errcode = '42501';
    end if;
    -- A suspended membership is lifted by reactivation, never by a new invitation (R-48).
    if private.has_suspended_membership(new.organization_id, new.email::text, new.role) then
      raise exception 'MEMBERSHIP_SUSPENDED' using errcode = 'P0001',
        hint = 'Reactivate the suspended membership instead of inviting again.';
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

-- 1. Suspension revokes pending invitations for the same kindergarten, role and e-mail.
-- Definer: reads auth.users and updates invitations regardless of the caller's column grants. Runs only after a
-- membership row has already passed RLS and the membership guard (manager, not self, org_admin rule).
create function private.revoke_invitations_on_suspension() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations i
     set status = 'revoked', revoked_by = (select auth.uid()), revoked_at = now()
   where i.organization_id = new.organization_id
     and i.role = new.role
     and i.status = 'pending'
     and lower(i.email::text) = (select lower(u.email) from auth.users u where u.id = new.profile_id);
  return null;
end $$;
revoke execute on function private.revoke_invitations_on_suspension() from public, anon, authenticated;

create trigger memberships_suspension_revokes_invitations
  after update of status on public.memberships
  for each row
  when (new.status = 'suspended' and old.status is distinct from 'suspended')
  execute function private.revoke_invitations_on_suspension();

-- 3. Acceptance: same signature and grants (service_role only); suspended memberships are never re-activated.
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
      insert into public.audit_events (organization_id, actor_id, action, target_table, target_id, outcome, details)
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

    insert into public.audit_events (organization_id, actor_id, action, target_table, target_id, details)
    values (inv.organization_id, p_user_id, 'invitation.accepted', 'invitations', inv.id, jsonb_build_object('role', inv.role));

    invitation_id := inv.id; organization_id := inv.organization_id; role := inv.role;
    return next;
  end loop;
end $$;
