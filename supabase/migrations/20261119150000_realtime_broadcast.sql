-- D-43 (owner approval 2026-11-19): minimal live updates through Supabase Realtime private Broadcast.
-- docs/architecture/realtime.md
--
-- Design
--   * Every event goes to the PERSONAL private topic of each recipient: 'user:<profile id>'. The only Realtime
--     authorization rule is "you may receive your own topic". It never depends on memberships, groups or links, so the
--     per-connection policy cache of Realtime (re-evaluated only on join and on a new access token) can never keep a
--     revoked right alive.
--   * WHO receives an event is decided here, in the database, at the moment the event happens, with the same rules that
--     decide who may read the row (child_educator_participants, conversation_participant_ids, announcement_recipients,
--     notification recipient, active managers). Losing a right (assignment ended, group changed, link ended,
--     restriction, suspension) removes the person from the next event, even while their subscription stays open.
--   * Payloads carry ids and a kind only — never names, text, message bodies or child data. Clients treat an event as a
--     hint and refetch through the normal API, where RLS decides again.
--   * Clients can never send: there is no insert policy on realtime.messages. Public channels are refused on hosted
--     projects by the Realtime setting private_only (staging: docs/architecture/staging.md); events are sent private
--     only, so a public channel with the same name receives nothing.
--   * realtime.send() swallows its own errors (warning), so an unavailable Realtime never blocks a write; messages are
--     inserted in the writer's transaction and only committed events are delivered.

-- Recipients -------------------------------------------------------------------------------------------------------

-- Active managers (org_admin, director) of a kindergarten today. They read attendance and announcements in the admin
-- app; reading still requires MFA (is_org_manager) when they refetch.
create function private.org_manager_ids(p_org uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.profile_id
  from public.memberships m
  where m.organization_id = p_org
    and m.role in ('org_admin', 'director')
    and m.status = 'active'
    and m.valid_during @> private.org_today(p_org)
$$;
revoke execute on function private.org_manager_ids(uuid) from public, anon, authenticated;

-- Sends one private broadcast per distinct recipient to 'user:<id>'. Payload: ids and kind only.
create function private.realtime_notify(p_recipients uuid[], p_event text, p_payload jsonb) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in select distinct r from unnest(p_recipients) r where r is not null loop
    perform realtime.send(p_payload, p_event, 'user:' || v_id::text, true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke execute on function private.realtime_notify(uuid[], text, jsonb) from public, anon, authenticated;

-- Triggers ---------------------------------------------------------------------------------------------------------

-- 1. Attendance (insert-only table; corrections and voids are new rows): educators of the child's group today and the
--    managers of the kindergarten.
create function private.realtime_attendance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.realtime_notify(
    array(select e.profile_id from private.child_educator_participants(new.child_id) e
          union select private.org_manager_ids(new.organization_id)),
    'attendance',
    jsonb_build_object('kind', 'attendance', 'organization_id', new.organization_id, 'child_id', new.child_id,
                       'record_id', new.id, 'local_date', new.local_date));
  return null;
end $$;
revoke execute on function private.realtime_attendance() from public, anon, authenticated;
create trigger attendance_records_realtime after insert on public.attendance_records
  for each row execute function private.realtime_attendance();

-- 2. Messages (new and withdrawn): the current participants of that conversation only (the guardian of that
--    conversation and the educators of the child's group today). Never the body.
create function private.realtime_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.realtime_notify(
    array(select x from private.conversation_participant_ids(new.conversation_id) x),
    'message',
    jsonb_build_object('kind', 'message', 'organization_id', new.organization_id,
                       'conversation_id', new.conversation_id, 'message_id', new.id));
  return null;
end $$;
revoke execute on function private.realtime_message() from public, anon, authenticated;
create trigger messages_realtime after insert or update of withdrawn_at on public.messages
  for each row execute function private.realtime_message();

-- 3. Notifications: only the recipient of the row (private.notify already applied the audience rules).
create function private.realtime_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.realtime_notify(
    array[new.recipient_id],
    'notification',
    jsonb_build_object('kind', 'notification', 'organization_id', new.organization_id, 'notification_id', new.id,
                       'resource_type', new.resource_type, 'resource_id', new.resource_id));
  return null;
end $$;
revoke execute on function private.realtime_notification() from public, anon, authenticated;
create trigger notifications_realtime after insert on public.notifications
  for each row execute function private.realtime_notification();

-- 4. Announcements: managers always (they maintain drafts too); the published audience after the change; and, when a
--    published announcement is edited or archived, the audience it had before the change (computed in a BEFORE
--    trigger while the row still holds the old values), so people who lose it refresh too. A person in both sets can
--    receive two hints for one change; clients refetch, so this never duplicates data.
create function private.realtime_announcement_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.realtime_notify(
    array(select private.org_manager_ids(new.organization_id)
          union select private.announcement_recipients(new.id)),
    'announcement',
    jsonb_build_object('kind', 'announcement', 'organization_id', new.organization_id, 'announcement_id', new.id));
  return null;
end $$;
revoke execute on function private.realtime_announcement_after() from public, anon, authenticated;
create trigger announcements_realtime after insert or update on public.announcements
  for each row execute function private.realtime_announcement_after();

create function private.realtime_announcement_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'published' then
    perform private.realtime_notify(
      array(select r from private.announcement_recipients(old.id) r
            except select private.org_manager_ids(old.organization_id)),
      'announcement',
      jsonb_build_object('kind', 'announcement', 'organization_id', old.organization_id, 'announcement_id', old.id));
  end if;
  return new;
end $$;
revoke execute on function private.realtime_announcement_before() from public, anon, authenticated;
create trigger announcements_realtime_previous_audience before update on public.announcements
  for each row execute function private.realtime_announcement_before();

-- Authorization on realtime.messages -------------------------------------------------------------------------------
-- Receive: only Broadcast on the caller's own personal topic. No insert policy: clients cannot send or track presence.
create policy vrticos_receive_own_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select auth.uid()) is not null
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

comment on function private.realtime_notify(uuid[], text, jsonb) is
  'D-43: one private broadcast per recipient to user:<id>; payload ids and kind only; recipients decided by the caller from the read rules at event time.';
