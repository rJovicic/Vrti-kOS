-- VrtićOS D2-F — guardian invitation and acceptance link (FR-01-1, d2-plan §5, D-32).
-- Flow: a manager creates the child, the guardian record and the link (D2-A…C), then invites the guardian with the
-- record's id. Accepting the invitation attaches the Auth account to that guardian record (guardians.profile_id), which
-- is what gives the person access to the linked children (D2-B helpers). Until then the account sees no child.
-- Rules from the plan:
--   * the guardian record belongs to the same kindergarten (composite FK) and the invitation role is `guardian`;
--   * the R-50 limit and the R-48 suspension rule apply unchanged (same guard, same acceptance function);
--   * if at acceptance the record is already attached to another account, nothing is linked and the attempt is audited
--     as denied.
-- Technical decisions:
--   * guardian_id is optional: a guardian invitation without a record keeps the D1 behaviour (membership, no child).
--   * At invitation time a record that is ended or already attached is refused (GUARDIAN_ALREADY_LINKED), after
--     authorization. The check uses a definer helper because no client role can read guardians.profile_id (D-31).
--   * At acceptance a person who already has another guardian record in that kindergarten is not attached a second time
--     (one record per person and kindergarten, unique index); also audited as denied. The membership is still accepted:
--     it gives no child on its own.

alter table public.invitations
  add column guardian_id uuid,
  add constraint invitations_guardian_fk foreign key (organization_id, guardian_id)
    references public.guardians (organization_id, id) on delete restrict,
  add constraint invitations_guardian_role check (guardian_id is null or role = 'guardian');
create index invitations_guardian_idx on public.invitations (guardian_id) where guardian_id is not null;
comment on column public.invitations.guardian_id is 'D2-F: zapis skrbnika kojem se račun pridružuje pri prihvaćanju.';

grant insert (guardian_id) on public.invitations to authenticated;

-- 'free' | 'linked' | 'ended' | null (unknown). Called only by the invitation guard after authorization.
create function private.guardian_invite_state(p_guardian uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when g.status = 'ended' then 'ended' when g.profile_id is not null then 'linked' else 'free' end
  from public.guardians g where g.id = p_guardian
$$;
revoke execute on function private.guardian_invite_state(uuid) from public, anon;
grant execute on function private.guardian_invite_state(uuid) to authenticated;

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
      -- D2-F: only a guardian record that is active and not attached to an account can be invited.
      if new.guardian_id is not null and private.guardian_invite_state(new.guardian_id) in ('linked', 'ended') then
        raise exception 'GUARDIAN_ALREADY_LINKED';
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

-- Acceptance: unchanged (R-48, membership handling, audit) plus the guardian attachment at the end of each invitation.
create or replace function api.accept_invitations(p_user_id uuid, p_email text)
returns table (invitation_id uuid, organization_id uuid, role public.org_role)
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.invitations%rowtype;
  v_today date;
  v_membership public.memberships%rowtype;
  v_guardian public.guardians%rowtype;
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

    -- D2-F: attach the account to the guardian record named by the invitation.
    if inv.guardian_id is not null then
      select * into v_guardian from public.guardians g where g.id = inv.guardian_id for update;
      if v_guardian.profile_id = p_user_id then
        null; -- already attached to this person
      elsif v_guardian.profile_id is not null or v_guardian.status <> 'active'
            or exists (select 1 from public.guardians g2
                        where g2.organization_id = inv.organization_id and g2.profile_id = p_user_id) then
        insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, outcome, details)
        values (inv.organization_id, p_user_id, 'guardian.link_refused', 'guardians', inv.guardian_id, 'denied',
                jsonb_build_object('reason', 'GUARDIAN_ALREADY_LINKED', 'invitation_id', inv.id));
      else
        update public.guardians set profile_id = p_user_id where id = inv.guardian_id;
        insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
        values (inv.organization_id, p_user_id, 'guardian.account_linked', 'guardians', inv.guardian_id,
                jsonb_build_object('invitation_id', inv.id));
      end if;
    end if;

    invitation_id := inv.id; organization_id := inv.organization_id; role := inv.role;
    return next;
  end loop;
end $$;
