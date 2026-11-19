-- VrtićOS — child event lock (shared by D-41b and Q-T22, approved 2026-11-19).
--
--   Same-day cancellation (Q-T22) and historical correction (D-41b) check that no dependent event exists (attendance,
--   handover, absence, message) and then change a relationship record. A writer that validated against the old state
--   and inserts a moment later would break that check. Both operations lock the child row FOR UPDATE (as transfer and
--   withdrawal already do); every writer of a dependent event now takes the child row FOR SHARE as its FIRST step,
--   before any of its own checks. So the two serialize: a writer either commits before the check sees its event, or
--   waits and then validates against the changed state.
--
--   Writers: private.record_attendance, record_missed_attendance (they create the first event of a day), report_absence,
--   record_absence_on_behalf, send_message. undo_attendance, correct_attendance and cancel_absence only act on an event
--   that already exists, which by itself blocks a cancellation or a correction of those days, so they are unchanged.
--   The function bodies below are the current ones (from the database), with only the lock line added.

create function private.lock_child_events(p_child uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from public.children c where c.id = p_child for share;
end $$;
revoke execute on function private.lock_child_events(uuid) from public, anon, authenticated;
comment on function private.lock_child_events(uuid) is 'Dijeljeno zaključavanje djeteta prije upisa događaja (D-41b, Q-T22).';

CREATE OR REPLACE FUNCTION private.record_attendance(p_child_id uuid, p_kind attendance_kind, p_idempotency_key uuid, p_occurred_at timestamp with time zone, p_source text, p_handover_child_guardian_id uuid, p_handover_pickup_id uuid)
 RETURNS TABLE(record_id uuid, kind attendance_kind, occurred_at timestamp with time zone, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_org uuid;
  v_day date;
  v_row public.attendance_records;
begin
  -- D-41b / Q-T22: serialize with corrections and same-day cancellations of this child (locks before any check).
  perform private.lock_child_events(p_child_id);
  if p_child_id is null or p_kind is null or p_idempotency_key is null or p_kind = 'void' then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  v_day := private.org_local_date(v_org, v_at);
  v_org := private.attendance_authorize(p_child_id, v_day);
  v_row := private.attendance_replay(v_org, p_idempotency_key);
  if v_row.id is not null then
    if v_row.child_id <> p_child_id or v_row.kind <> p_kind
       or v_row.handover_child_guardian_id is distinct from p_handover_child_guardian_id
       or v_row.handover_pickup_id is distinct from p_handover_pickup_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select v_row.id, v_row.kind, v_row.occurred_at, true;
    return;
  end if;
  if v_at > now() + interval '2 minutes' or v_day <> private.org_today(v_org) then
    raise exception 'ATTENDANCE_TIME_INVALID';
  end if;
  if not private.attendance_enrolled(p_child_id, v_day) then
    raise exception 'CHILD_NOT_ENROLLED';
  end if;
  perform private.attendance_handover_check(p_child_id, v_day, p_handover_child_guardian_id, p_handover_pickup_id);
  perform private.attendance_lock(p_child_id, v_day);
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key,
                                         handover_child_guardian_id, handover_pickup_id)
  values (v_org, p_child_id, p_kind, v_at, v_day, (select auth.uid()), private.attendance_source(p_source), p_idempotency_key,
          p_handover_child_guardian_id, p_handover_pickup_id)
  returning * into v_row;
  if not private.attendance_sequence_ok(p_child_id, v_day) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return query select v_row.id, v_row.kind, v_row.occurred_at, false;
end $function$;

CREATE OR REPLACE FUNCTION private.record_missed_attendance(p_child_id uuid, p_kind attendance_kind, p_occurred_at timestamp with time zone, p_reason attendance_correction_reason, p_idempotency_key uuid, p_source text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid;
  v_day date;
  v_row public.attendance_records;
begin
  -- D-41b / Q-T22: serialize with corrections and same-day cancellations of this child (locks before any check).
  perform private.lock_child_events(p_child_id);
  if p_child_id is null or p_kind is null or p_kind = 'void' or p_occurred_at is null or p_reason is null or p_idempotency_key is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  v_day := private.org_local_date(v_org, p_occurred_at);
  v_org := private.attendance_authorize(p_child_id, v_day);
  v_row := private.attendance_replay(v_org, p_idempotency_key);
  if v_row.id is not null then
    return v_row.id;
  end if;
  if p_occurred_at > now() + interval '2 minutes' then
    raise exception 'ATTENDANCE_TIME_INVALID';
  end if;
  if not private.attendance_enrolled(p_child_id, v_day) then
    raise exception 'CHILD_NOT_ENROLLED';
  end if;
  perform private.attendance_lock(p_child_id, v_day);
  insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, correction_reason, idempotency_key)
  values (v_org, p_child_id, p_kind, p_occurred_at, v_day, (select auth.uid()), private.attendance_source(p_source), p_reason, p_idempotency_key)
  returning * into v_row;
  if not private.attendance_sequence_ok(p_child_id, v_day) then
    raise exception 'ATTENDANCE_STATE_CONFLICT';
  end if;
  return v_row.id;
end $function$;

CREATE OR REPLACE FUNCTION private.report_absence(p_child_id uuid, p_starts_on date, p_ends_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid;
begin
  -- D-41b / Q-T22: serialize with corrections and same-day cancellations of this child (locks before any check).
  perform private.lock_child_events(p_child_id);
  if p_child_id is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  -- Same answer for an unknown child, another family's child, a missing flag and an active restriction (NEG-03/04/05).
  if p_child_id not in (select private.guardian_child_ids('can_report_absence')) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  return private.absence_insert(v_org, p_child_id, p_starts_on, p_ends_on, 'guardian');
end $function$;

CREATE OR REPLACE FUNCTION private.record_absence_on_behalf(p_child_id uuid, p_starts_on date, p_ends_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid;
begin
  -- D-41b / Q-T22: serialize with corrections and same-day cancellations of this child (locks before any check).
  perform private.lock_child_events(p_child_id);
  if p_child_id is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  if v_org is null or not private.is_org_manager(v_org) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return private.absence_insert(v_org, p_child_id, p_starts_on, p_ends_on, 'staff_on_behalf');
end $function$;

CREATE OR REPLACE FUNCTION private.send_message(p_conversation_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.conversations;
  v_id uuid;
begin
  -- D-41b / Q-T22: serialize with corrections and same-day cancellations of this child (locks before any check).
  perform private.lock_child_events((select cv.child_id from public.conversations cv where cv.id = p_conversation_id));
  v := private.conversation_for_participant(p_conversation_id);
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'MESSAGE_CONTENT_INVALID';
  end if;
  insert into public.messages (organization_id, conversation_id, sender_id, body)
  values (v.organization_id, v.id, (select auth.uid()), btrim(p_body))
  returning id into v_id;
  -- Only the participants of THIS conversation (the sender is skipped by private.notify).
  perform private.notify(v.organization_id, array(select x from private.conversation_participant_ids(v.id) x where x is not null),
                         'message.received', 'conversation', v.id);
  return v_id;
end $function$;
