-- VrtićOS D1 — only an org_admin may change the status or validity of an org_admin membership.
-- Mirrors the invitation rule (only org_admin invites org_admin): a director must not be able to lock out
-- the kindergarten's administrators (roles matrix: director "Ogr." for memberships). Replaces the D0 guard.
create or replace function private.guard_memberships() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new; -- service/migration context
  end if;
  if new.role is distinct from old.role or new.profile_id is distinct from old.profile_id
     or new.created_by is distinct from old.created_by then
    raise exception 'MEMBERSHIP_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  if old.profile_id = (select auth.uid()) then
    if new.status is distinct from old.status or new.valid_during is distinct from old.valid_during then
      raise exception 'MEMBERSHIP_SELF_CHANGE_FORBIDDEN' using errcode = '42501'; -- SR-AUTHZ-07
    end if;
  else
    if new.notice_ack_version is distinct from old.notice_ack_version or new.notice_ack_at is distinct from old.notice_ack_at then
      raise exception 'MEMBERSHIP_ACK_IS_PERSONAL' using errcode = '42501';
    end if;
    if old.role = 'org_admin'
       and (new.status is distinct from old.status or new.valid_during is distinct from old.valid_during)
       and not private.has_org_role(old.organization_id, array['org_admin']::public.org_role[]) then
      raise exception 'ONLY_ORG_ADMIN_MAY_CHANGE_ORG_ADMIN' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.guard_memberships() from public, anon, authenticated;
