-- VrtićOS — FR-01-5 / AC-01-5: the privacy notice of a kindergarten, shown in the app before any data and acknowledged
-- with its version. The acknowledgement is NOT consent (FR-01-5). The text is the kindergarten's (controller's) document
-- (⚖️); the platform stores and displays it, it does not author it. Demo texts are flagged `is_demo` and the app labels
-- them as synthetic.

create table public.privacy_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  version text not null check (char_length(version) between 1 and 40),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 20000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, version),
  unique (organization_id, id)
);
comment on table public.privacy_notices is
  'Obavijest o privatnosti vrtića (FR-01-5), po verzijama; nepromjenjiva nakon unosa. Bez osobnih podataka. Sensitivity R1.';

-- The published version of a kindergarten must be one of its own notices.
alter table public.organizations
  add constraint organizations_privacy_notice_fk
  foreign key (id, privacy_notice_version) references public.privacy_notices (organization_id, version);

-- Versions are append-only: what a person acknowledged must never change under them.
create function private.privacy_notice_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'PRIVACY_NOTICE_IMMUTABLE' using errcode = '42501';
end $$;
revoke execute on function private.privacy_notice_immutable() from public, anon, authenticated;
create trigger privacy_notices_immutable before update on public.privacy_notices
  for each row execute function private.privacy_notice_immutable();
create trigger privacy_notices_audit after insert on public.privacy_notices
  for each row execute function private.audit_row();

-- Read: active members of that kindergarten (incl. managers). Write: no client role (operators / service only until a
-- managed authoring flow exists). No DELETE: a published version is protected by the FK above.
alter table public.privacy_notices enable row level security;
create policy privacy_notices_select on public.privacy_notices for select to authenticated
  using (organization_id in (select private.member_org_ids()));
revoke all on public.privacy_notices from anon, authenticated;
grant select on public.privacy_notices to authenticated;

-- Acknowledgement integrity: a person may only acknowledge the version their kindergarten currently publishes, and
-- the time is set by the database. Everything else in the guard is unchanged (20261111100200).
create or replace function private.guard_memberships() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_published text;
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
    if new.notice_ack_version is distinct from old.notice_ack_version or new.notice_ack_at is distinct from old.notice_ack_at then
      select o.privacy_notice_version into v_published from public.organizations o where o.id = old.organization_id;
      if v_published is null or new.notice_ack_version is distinct from v_published then
        raise exception 'NOTICE_VERSION_MISMATCH' using errcode = '22023';
      end if;
      new.notice_ack_at := now();
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
