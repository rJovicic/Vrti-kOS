-- VrtićOS — Q-T22 correction (owner, 2026-11-19): absences as dependencies of a same-day cancellation.
--
-- Defect in 20261119110000_same_day_cancellation.sql: private.same_day_dependents counted an absence only when it was
-- CREATED on or after the record's start day. An absence reported earlier that covers the start day or a later day
-- (e.g. reported yesterday for today) was missed, so a record it depends on could be cancelled.
--
-- Fix — an absence record is a dependency when either of its two business facts touches the record:
--   * the absence PERIOD: daterange(starts_on, ends_on, '[]') (inclusive, as everywhere for absences) overlaps
--     [start day, ∞) — the days the kindergarten was told about;
--   * the REPORT itself happened on or after the start day (created_at in the kindergarten's time zone) — the report was
--     made while this record was the basis (educators of the group notified through this enrolment; a guardian
--     reporting through this link). This is in addition to the period, never instead of it.
--   For a link, both apply only to absences reported by that guardian (identity of the reporter unchanged).
--   Cancelled absences count as well: the report and its cancellation are recorded history.
--   An absence reported before the start day for days that ended before it is NOT a dependency.
-- Other dependencies were reviewed and already use the date of the real event: attendance and handovers by
-- `local_date` / by reference, messages by the day they were sent (a message is itself the event).
-- No change to absence rules, to locking (20261119100000) or to anything else.

create or replace function private.same_day_dependents(p_kind text, p_record_id uuid, p_org uuid, p_child uuid, p_from date) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_guardian uuid;
  v_profile uuid;
  v_from_on daterange := daterange(p_from, null);
begin
  if p_kind = 'enrollment' then
    return exists (select 1 from public.attendance_records a where a.child_id = p_child and a.local_date >= p_from)
        or exists (select 1 from public.absence_records r where r.child_id = p_child
                   and (daterange(r.starts_on, r.ends_on, '[]') && v_from_on
                        or private.org_local_date(p_org, r.created_at) >= p_from))
        or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                   where c.child_id = p_child and private.org_local_date(p_org, m.created_at) >= p_from);
  elsif p_kind = 'child_guardian' then
    select cg.guardian_id, g.profile_id into v_guardian, v_profile
    from public.child_guardians cg join public.guardians g on g.id = cg.guardian_id where cg.id = p_record_id;
    return exists (select 1 from public.attendance_records a where a.handover_child_guardian_id = p_record_id)
        or exists (select 1 from public.absence_records r where r.child_id = p_child and v_profile is not null and r.reported_by = v_profile
                   and (daterange(r.starts_on, r.ends_on, '[]') && v_from_on
                        or private.org_local_date(p_org, r.created_at) >= p_from))
        or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                   where c.child_id = p_child and c.guardian_id = v_guardian and private.org_local_date(p_org, m.created_at) >= p_from);
  else
    return exists (select 1 from public.attendance_records a where a.handover_pickup_id = p_record_id);
  end if;
end $$;
comment on function private.same_day_dependents(text, uuid, uuid, uuid, date) is
  'Q-T22: postoji li događaj koji ovisi o zapisu od danas (dolazak/predaja; izostanak po razdoblju ili danu prijave; poruka).';
