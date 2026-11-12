-- VrtićOS — R-50: per-kindergarten limit on new invitations (each one sends an e-mail and may create an Auth account).
-- Enforced in the invitation guard, so it holds for every write path (invite-member, direct PostgREST insert by a
-- manager, service-key insert). Concurrent requests are serialised per kindergarten with a transaction-scoped advisory
-- lock, so parallel requests cannot overshoot the limit.
-- Over the limit the insert is SKIPPED (the trigger returns NULL) instead of raising, so the refusal can be written to
-- the audit log in the same, committed transaction (SR-AUD-01, ST-AUD-02): the caller gets no row back, and
-- invite-member answers 429 INVITATION_LIMIT_REACHED.
-- Every created invitation counts, whatever its later status, so create-and-revoke loops cannot bypass the limit.
-- The value is a configurable business setting, NOT an owner decision: initial default 50 per rolling hour
-- (docs/risks.md R-50). Only the service role / operators can change it (no client grant on the column).

alter table public.organizations
  add column invitation_limit_per_hour smallint not null default 50
    constraint organizations_invitation_limit_check check (invitation_limit_per_hour between 1 and 1000);
comment on column public.organizations.invitation_limit_per_hour is
  'R-50: maximum new invitations per rolling hour for this kindergarten. Operator setting; default 50 (provisional).';

-- True (and audited as denied) when the kindergarten has reached its limit. VOLATILE on purpose: after the advisory
-- lock is granted, the count must see invitations committed by concurrent transactions.
create function private.invitation_limit_reached(p_org uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_limit int;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended('vrticos.invitations:' || p_org::text, 0));
  select o.invitation_limit_per_hour into v_limit from public.organizations o where o.id = p_org;
  if v_limit is null then
    return false; -- unknown kindergarten: the FK / RLS decide
  end if;
  select count(*) into v_count from public.invitations i
   where i.organization_id = p_org and i.created_at > now() - interval '1 hour';
  if v_count < v_limit then
    return false;
  end if;
  insert into audit.audit_events (organization_id, actor_id, action, target_table, outcome, details)
  values (p_org, (select auth.uid()), 'invitation.limit_reached', 'invitations', 'denied',
          jsonb_build_object('reason', 'INVITATION_LIMIT_REACHED', 'limit_per_hour', v_limit));
  return true;
end $$;
revoke execute on function private.invitation_limit_reached(uuid) from public, anon;
grant execute on function private.invitation_limit_reached(uuid) to authenticated, service_role;

create or replace function private.guard_invitations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      -- Authorization before any data-dependent rule, so callers without rights always get permission_denied and
      -- learn nothing about memberships, invitations or limits of a kindergarten they do not manage.
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
    end if;
    -- R-50: applies to clients and to the service key alike (migrations and the seed run as the owner).
    if current_user in ('authenticated', 'anon', 'service_role') and private.invitation_limit_reached(new.organization_id) then
      return null;
    end if;
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.status <> 'pending' or new.status <> 'revoked' then
    raise exception 'INVITATION_ONLY_PENDING_CAN_BE_REVOKED' using errcode = '42501';
  end if;
  new.revoked_by := (select auth.uid());
  new.revoked_at := now();
  return new;
end $$;
