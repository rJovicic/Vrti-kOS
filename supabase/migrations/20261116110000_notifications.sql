-- VrtićOS — D4-A: notification core (FS-08, FR-06-5, schema §5.21/5.22, SR-PUSH-01).
--
--   * public.notifications: one content-free row per recipient and event — type, resource type and id, read state, push
--     state. NO title, body, names or group: the app loads the resource under its own RLS (FR-08-3), so a notification
--     never shows more than the recipient may read at that moment.
--   * Rows are written only by private.notify() (definer, called from triggers of the source tables). Clients read own
--     rows of kindergartens where they are an active member today and mark them read through api.mark_notifications_read.
--   * push_status: 'pending' when the recipient wants push for the type (default yes, FR-08-4 is opt-out), otherwise
--     'not_applicable'. Delivery (device tokens, provider) is NOT built: it needs the owner's approval of ADR-0007 (D-40).
--   * public.notification_preferences: per person and type (not tenant-owned, like profiles; CASCADE with the profile:
--     a pure preference without evidentiary value, schema §5.22).
--   * First event: a new absence report notifies the educators of the child's group in that period (FR-06-5).

create type public.notification_type as enum ('announcement.published', 'absence.reported', 'message.received', 'daily_entry.published');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  type public.notification_type not null,
  resource_type text not null check (resource_type in ('announcement', 'absence_record', 'conversation', 'daily_entry')),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_status text not null default 'not_applicable' check (push_status in ('not_applicable', 'pending', 'sent', 'failed')),
  push_attempts integer not null default 0 check (push_attempts >= 0),
  unique (organization_id, id)
);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);
comment on table public.notifications is
  'D4-A: obavijesti u aplikaciji bez sadržaja (vrsta i ID resursa); sadržaj se učitava pod RLS-om resursa (SR-PUSH-01).';

create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  push_enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, type)
);
comment on table public.notification_preferences is 'D4-A: isključivanje push obavijesti po vrsti (FR-08-4); vrijedi za osobu.';

-- Fan-out ---------------------------------------------------------------------------------------------------------------
-- Inserts one row per distinct recipient (never the actor) who is an active member of the kindergarten today.
create function private.notify(p_org uuid, p_recipients uuid[], p_type public.notification_type, p_resource_type text, p_resource_id uuid)
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.notifications (organization_id, recipient_id, type, resource_type, resource_id, push_status)
  select p_org, r.id, p_type, p_resource_type, p_resource_id,
         case when coalesce(np.push_enabled, true) then 'pending' else 'not_applicable' end
  from (select distinct unnest(p_recipients) as id) r
  left join public.notification_preferences np on np.profile_id = r.id and np.type = p_type
  where r.id is not null
    and r.id is distinct from (select auth.uid())
    and exists (select 1 from public.memberships m
                where m.organization_id = p_org and m.profile_id = r.id and m.status = 'active'
                  and m.valid_during @> private.org_today(p_org));
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function private.notify(uuid, uuid[], public.notification_type, text, uuid) from public, anon, authenticated;

-- FR-06-5: educators assigned to the child's group during the absence period are told a report exists.
create function private.notify_absence_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(
    new.organization_id,
    array(
      select distinct m.profile_id
      from public.enrollments e
      join public.staff_assignments sa on sa.group_id = e.group_id and sa.organization_id = e.organization_id
      join public.memberships m on m.id = sa.membership_id and m.role = 'educator'
      where e.child_id = new.child_id
        and e.valid_during && daterange(new.starts_on, new.ends_on, '[]')
        and sa.valid_during && daterange(new.starts_on, new.ends_on, '[]')
        and sa.valid_during && e.valid_during
    ),
    'absence.reported', 'absence_record', new.id);
  return null;
end $$;
revoke execute on function private.notify_absence_reported() from public, anon, authenticated;
create trigger absence_records_notify after insert on public.absence_records
  for each row when (new.status = 'active' and new.split_from is null) execute function private.notify_absence_reported();

-- Reading and marking read ----------------------------------------------------------------------------------------------
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and organization_id in (select private.member_org_ids()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Marks the caller's own unread notifications read (all, or the given ids). Returns how many changed.
create function private.mark_notifications_read(p_ids uuid[]) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  update public.notifications n set read_at = now()
  where n.recipient_id = (select auth.uid())
    and n.read_at is null
    and n.organization_id in (select private.member_org_ids())
    and (p_ids is null or n.id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function private.mark_notifications_read(uuid[]) from public, anon;
grant execute on function private.mark_notifications_read(uuid[]) to authenticated;

create function api.mark_notifications_read(p_ids uuid[] default null) returns integer
language sql volatile security invoker set search_path = '' as $$
  select private.mark_notifications_read(p_ids)
$$;
revoke execute on function api.mark_notifications_read(uuid[]) from public, anon;
grant execute on function api.mark_notifications_read(uuid[]) to authenticated;
comment on function api.mark_notifications_read(uuid[]) is 'D4-A: označi vlastite obavijesti pročitanima (sve ili zadane).';

-- Preferences -----------------------------------------------------------------------------------------------------------
alter table public.notification_preferences enable row level security;
create policy notification_preferences_select on public.notification_preferences for select to authenticated
  using (profile_id = (select auth.uid()));
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
revoke all on public.notification_preferences from anon, authenticated;
-- Upserts (PostgREST: insert … on conflict do update set every sent column) need update on the key columns too; the
-- update policy's WITH CHECK keeps every row the caller's own.
grant select, insert, update (profile_id, type, push_enabled, updated_at) on public.notification_preferences to authenticated;

create function private.touch_notification_preferences() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger notification_preferences_touch before insert or update on public.notification_preferences
  for each row execute function private.touch_notification_preferences();
