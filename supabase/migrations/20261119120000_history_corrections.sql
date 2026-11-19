-- VrtićOS — D-41b (owner, 2026-11-19): historical correction of a child's relationships, implemented per
-- docs/architecture/d41b-plan.md. Decisions: D-41, Q-T17 (org_admin and director of the own kindergarten, MFA/AAL2,
-- never platform_admin), Q-T18 (mandatory reason code AND free-text note; no limit backwards; existing records only;
-- previous and new state, actor, time, kindergarten, reason and affected records recorded; never usable to hide or
-- delete history), Q-T21 (enrolments included).
--
--   * Record types: enrolment, guardian–child link, access restriction, pickup authorization. Correctable: the period;
--     for a pickup person also the name — only when NO attendance record (incl. voided) refers to the authorization
--     (CORRECTION_NAME_IN_USE), because handover history reads the current name.
--   * Never: creating or deleting a record, an empty or open-start period, a change that touches no day before today
--     (that is a regular operation — CORRECTION_NOT_HISTORICAL), a cancelled record (Q-T22), moving a record to another
--     child, group, guardian, link or kindergarten.
--   * No hiding of history: refused (CORRECTION_CONFLICTS) when the change would remove days on which dependent events
--     exist — enrolment: attendance, absences, messages of the child; link: handovers by the link, absences the guardian
--     reported, messages in that guardian's conversation; pickup: handovers by the person; restriction: any event of the
--     restricted guardian on a day whose restricted status changes. Extending a period never removes an event's basis.
--   * One transaction: authorise → lock child (FOR UPDATE; event writers take it FOR SHARE first, 20261119100000) →
--     lock record (restriction: its link FOR SHARE) → checks → append-only correction row → update → audit event.
--   * Evidence: public.history_corrections is append-only for every role (trigger; also TRUNCATE); managers of the
--     kindergarten with MFA read it; clients never write it. The note stays in this table only — never in audit,
--     logs, notifications or push.

create type public.history_correction_reason as enum ('entered_in_error', 'wrong_date_recorded', 'authority_document', 'late_information', 'other');

create table public.history_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  record_type text not null check (record_type in ('enrollment', 'child_guardian', 'access_restriction', 'pickup_authorization')),
  record_id uuid not null,
  old_values jsonb not null,
  new_values jsonb not null,
  reason_code public.history_correction_reason not null,
  note text not null check (char_length(note) between 10 and 1000 and note = btrim(note)),
  corrected_by uuid not null references public.profiles (id) on delete restrict,
  corrected_role public.org_role not null check (corrected_role in ('org_admin', 'director')),
  aal text not null check (aal = 'aal2'),
  corrected_at timestamptz not null default now(),
  correlation_id text check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9._-]{8,64}$'),
  affected jsonb not null default '{}'::jsonb,
  supersedes uuid references public.history_corrections (id) on delete restrict,
  unique (organization_id, id),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict
);
create index history_corrections_child_idx on public.history_corrections (organization_id, child_id, corrected_at desc);
create index history_corrections_record_idx on public.history_corrections (record_id, corrected_at desc);
comment on table public.history_corrections is
  'D-41b: povijesni ispravci odnosa djeteta (samo dodavanje). Bilješka (R4) ostaje samo ovdje; čita je samo uprava s MFA-om.';

create function private.history_corrections_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'HISTORY_CORRECTION_IMMUTABLE' using errcode = '42501';
end $$;
revoke execute on function private.history_corrections_immutable() from public, anon, authenticated;
create trigger history_corrections_no_change before update or delete on public.history_corrections
  for each row execute function private.history_corrections_immutable();
create trigger history_corrections_no_truncate before truncate on public.history_corrections
  for each statement execute function private.history_corrections_immutable();
create trigger history_corrections_audit after insert on public.history_corrections for each row execute function private.audit_row();

alter table public.history_corrections enable row level security;
create policy history_corrections_select on public.history_corrections for select to authenticated
  using ((select private.is_org_manager(organization_id)));
revoke all on public.history_corrections from anon, authenticated;
grant select on public.history_corrections to authenticated;

-- Events on given days that depend on a record (definer; never called by clients). Days as a date multirange.
create function private.correction_conflicts(p_type text, p_record_id uuid, p_org uuid, p_child uuid, p_days datemultirange)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_link uuid;
  v_guardian uuid;
  v_profile uuid;
begin
  if isempty(p_days) then
    return false;
  end if;
  if p_type = 'enrollment' then
    return exists (select 1 from public.attendance_records a where a.child_id = p_child and p_days @> a.local_date)
        or exists (select 1 from public.absence_records r where r.child_id = p_child
                   and p_days && datemultirange(daterange(r.starts_on, r.ends_on, '[]')))
        or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                   where c.child_id = p_child and p_days @> private.org_local_date(p_org, m.created_at));
  elsif p_type = 'pickup_authorization' then
    return exists (select 1 from public.attendance_records a where a.handover_pickup_id = p_record_id and p_days @> a.local_date);
  end if;
  -- Link or restriction: the events of that guardian for that child.
  if p_type = 'child_guardian' then
    v_link := p_record_id;
  else
    select ar.child_guardian_id into v_link from public.access_restrictions ar where ar.id = p_record_id;
  end if;
  select cg.guardian_id, g.profile_id into v_guardian, v_profile
  from public.child_guardians cg join public.guardians g on g.id = cg.guardian_id where cg.id = v_link;
  return exists (select 1 from public.attendance_records a where a.handover_child_guardian_id = v_link and p_days @> a.local_date)
      or exists (select 1 from public.absence_records r where r.child_id = p_child and v_profile is not null and r.reported_by = v_profile
                 and (p_days && datemultirange(daterange(r.starts_on, r.ends_on, '[]')) or p_days @> private.org_local_date(p_org, r.created_at)))
      or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                 where c.child_id = p_child and c.guardian_id = v_guardian and p_days @> private.org_local_date(p_org, m.created_at));
end $$;
revoke execute on function private.correction_conflicts(text, uuid, uuid, uuid, datemultirange) from public, anon, authenticated;

create function private.correct_relationship_history(
  p_record_type text, p_record_id uuid, p_new_valid_during daterange,
  p_reason_code public.history_correction_reason, p_note text,
  p_new_first_name text default null, p_new_last_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_child uuid;
  v_org public.children;
  v_today date;
  v_past daterange;
  v_old daterange;
  v_cancelled timestamptz;
  v_link uuid;
  v_link_period daterange;
  v_first text;
  v_last text;
  v_new_first text;
  v_new_last text;
  v_note text := btrim(coalesce(p_note, ''));
  v_name_change boolean := false;
  v_removed datemultirange;
  v_check datemultirange;
  v_role public.org_role;
  v_corr text;
  v_prev uuid;
  v_id uuid;
begin
  if p_record_type is null or p_record_id is null or p_new_valid_during is null or p_reason_code is null
     or p_record_type not in ('enrollment', 'child_guardian', 'access_restriction', 'pickup_authorization')
     or (p_record_type <> 'pickup_authorization' and (p_new_first_name is not null or p_new_last_name is not null)) then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  -- Which child (definer read; nothing is revealed before authorisation).
  if p_record_type = 'enrollment' then
    select e.child_id into v_child from public.enrollments e where e.id = p_record_id;
  elsif p_record_type = 'child_guardian' then
    select cg.child_id into v_child from public.child_guardians cg where cg.id = p_record_id;
  elsif p_record_type = 'pickup_authorization' then
    select pa.child_id into v_child from public.pickup_authorizations pa where pa.id = p_record_id;
  else
    select cg.child_id into v_child from public.access_restrictions ar join public.child_guardians cg on cg.id = ar.child_guardian_id where ar.id = p_record_id;
  end if;
  if v_child is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- org_admin or director of the child's kindergarten with AAL2 (Q-T17); same answer as an unknown id. Locks the child.
  v_org := private.lock_child_for_manager(v_child);
  v_today := private.org_today(v_org.organization_id);
  v_past := daterange(null, v_today);

  if p_record_type = 'enrollment' then
    select e.valid_during, e.cancelled_at into v_old, v_cancelled from public.enrollments e where e.id = p_record_id for update;
  elsif p_record_type = 'child_guardian' then
    select cg.valid_during, cg.cancelled_at into v_old, v_cancelled from public.child_guardians cg where cg.id = p_record_id for update;
  elsif p_record_type = 'pickup_authorization' then
    select pa.valid_during, pa.cancelled_at, pa.first_name, pa.last_name into v_old, v_cancelled, v_first, v_last
    from public.pickup_authorizations pa where pa.id = p_record_id for update;
  else
    select ar.valid_during, ar.child_guardian_id into v_old, v_link from public.access_restrictions ar where ar.id = p_record_id for update;
    select cg.valid_during into v_link_period from public.child_guardians cg where cg.id = v_link for share;
  end if;
  if v_cancelled is not null then
    raise exception 'RECORD_ALREADY_CANCELLED';
  end if;

  -- Input (Q-T18): reason code + note, a real period, valid names.
  if char_length(v_note) not between 10 and 1000 then
    raise exception 'CORRECTION_NOTE_INVALID';
  end if;
  if isempty(p_new_valid_during) or lower_inf(p_new_valid_during) then
    raise exception 'CORRECTION_PERIOD_INVALID';
  end if;
  if p_record_type = 'pickup_authorization' and (p_new_first_name is not null or p_new_last_name is not null) then
    v_new_first := btrim(coalesce(p_new_first_name, ''));
    v_new_last := btrim(coalesce(p_new_last_name, ''));
    if char_length(v_new_first) not between 1 and 60 or char_length(v_new_last) not between 1 and 60 then
      raise exception 'CORRECTION_NAME_INVALID';
    end if;
    v_name_change := v_new_first is distinct from v_first or v_new_last is distinct from v_last;
  end if;
  if p_new_valid_during = v_old and not v_name_change then
    raise exception 'CORRECTION_NO_CHANGE';
  end if;
  -- Only the past: a change that touches no day before today is a regular operation (D-41a).
  if (v_old * v_past) is not distinct from (p_new_valid_during * v_past)
     and not (v_name_change and not isempty(v_old * v_past)) then
    raise exception 'CORRECTION_NOT_HISTORICAL';
  end if;

  -- Consistency with the rest of the model.
  if v_org.withdrawn_on is not null
     and (upper_inf(p_new_valid_during) or upper(p_new_valid_during) > v_org.withdrawn_on + 1) then
    raise exception 'CHILD_WITHDRAWN';
  end if;
  if p_record_type = 'access_restriction' and not (v_link_period @> p_new_valid_during) then
    raise exception 'CORRECTION_OUTSIDE_LINK';
  end if;
  if p_record_type = 'child_guardian'
     and exists (select 1 from public.access_restrictions ar where ar.child_guardian_id = p_record_id
                 and not (p_new_valid_during @> ar.valid_during)) then
    raise exception 'CORRECTION_CONFLICTS';
  end if;

  -- History of events must keep its meaning.
  if v_name_change and exists (select 1 from public.attendance_records a where a.handover_pickup_id = p_record_id) then
    raise exception 'CORRECTION_NAME_IN_USE';
  end if;
  v_removed := datemultirange(v_old) - datemultirange(p_new_valid_during);
  v_check := case when p_record_type = 'access_restriction'
                  then v_removed + (datemultirange(p_new_valid_during) - datemultirange(v_old))
                  else v_removed end;
  if private.correction_conflicts(p_record_type, p_record_id, v_org.organization_id, v_child, v_check) then
    raise exception 'CORRECTION_CONFLICTS';
  end if;

  -- Evidence first, then the change, then the audit event — one transaction.
  select m.role into v_role from public.memberships m
  where m.organization_id = v_org.organization_id and m.profile_id = (select auth.uid()) and m.status = 'active'
    and m.role in ('org_admin', 'director') and m.valid_during @> v_today
  order by (m.role = 'org_admin') desc limit 1;
  begin
    v_corr := coalesce(nullif(current_setting('app.correlation_id', true), ''),
                       nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-correlation-id');
  exception when others then
    v_corr := null;
  end;
  if v_corr !~ '^[A-Za-z0-9._-]{8,64}$' then
    v_corr := null;
  end if;
  select hc.id into v_prev from public.history_corrections hc where hc.record_id = p_record_id order by hc.corrected_at desc, hc.id limit 1;
  insert into public.history_corrections (organization_id, child_id, record_type, record_id, old_values, new_values, reason_code, note,
                                          corrected_by, corrected_role, aal, correlation_id, affected, supersedes)
  values (v_org.organization_id, v_child, p_record_type, p_record_id,
          jsonb_strip_nulls(jsonb_build_object('valid_during', v_old::text, 'first_name', v_first, 'last_name', v_last)),
          jsonb_strip_nulls(jsonb_build_object('valid_during', p_new_valid_during::text,
            'first_name', coalesce(v_new_first, v_first), 'last_name', coalesce(v_new_last, v_last))),
          p_reason_code, v_note, (select auth.uid()), v_role, coalesce((select auth.jwt()) ->> 'aal', ''), v_corr,
          jsonb_build_object('checked_days', v_check::text, 'dependent_events', 0), v_prev)
  returning id into v_id;

  begin
    if p_record_type = 'enrollment' then
      update public.enrollments set valid_during = p_new_valid_during where id = p_record_id;
    elsif p_record_type = 'child_guardian' then
      update public.child_guardians set valid_during = p_new_valid_during where id = p_record_id;
    elsif p_record_type = 'pickup_authorization' then
      update public.pickup_authorizations
      set valid_during = p_new_valid_during, first_name = coalesce(v_new_first, first_name), last_name = coalesce(v_new_last, last_name)
      where id = p_record_id;
    else
      update public.access_restrictions set valid_during = p_new_valid_during where id = p_record_id;
    end if;
  exception when exclusion_violation then
    raise exception 'CORRECTION_OVERLAP';
  end;

  insert into audit.audit_events (organization_id, actor_id, action, target_table, target_id, details)
  values (v_org.organization_id, (select auth.uid()), 'history.corrected',
          case p_record_type when 'enrollment' then 'enrollments' when 'child_guardian' then 'child_guardians'
                             when 'access_restriction' then 'access_restrictions' else 'pickup_authorizations' end,
          p_record_id,
          jsonb_build_object('record_type', p_record_type, 'correction_id', v_id, 'reason', p_reason_code,
                             'changed_columns', to_jsonb(array_remove(array[
                               case when p_new_valid_during is distinct from v_old then 'valid_during' end,
                               case when v_name_change then 'name' end], null)),
                             'old_starts_on', lower(v_old), 'old_ends_on', upper(v_old) - 1,
                             'new_starts_on', lower(p_new_valid_during), 'new_ends_on', upper(p_new_valid_during) - 1));
  return v_id;
end $$;
revoke execute on function private.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text) from public, anon;
grant execute on function private.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text) to authenticated;

create function api.correct_relationship_history(
  p_record_type text, p_record_id uuid, p_new_valid_during daterange,
  p_reason_code public.history_correction_reason, p_note text,
  p_new_first_name text default null, p_new_last_name text default null)
returns uuid
language sql security invoker set search_path = '' as $$
  select private.correct_relationship_history(p_record_type, p_record_id, p_new_valid_during, p_reason_code, p_note, p_new_first_name, p_new_last_name)
$$;
revoke execute on function api.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text) from public, anon;
grant execute on function api.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text) to authenticated;
comment on function api.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text) is
  'D-41b: povijesni ispravak upisa, veze, ograničenja ili ovlaštene osobe. Samo org_admin/director s MFA-om; kod razloga i bilješka obvezni; auditirano; bez skrivanja povijesti.';
