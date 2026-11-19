-- D-41b: historical correction (migration 20261119120000_history_corrections.sql; plan docs/architecture/d41b-plan.md).
-- org_admin and director of the own kindergarten with MFA only; reason code and note; enrolments, links, restrictions
-- and pickup authorizations; no hiding of history (attendance, handovers, absences, messages keep their basis); pickup
-- names only when no attendance record refers to the person; append-only evidence; audit without the note; one
-- transaction; regular paths stay closed. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d41b0000-0000-4000-8000-0000000000' || x)::uuid, 'hc-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'a2', 'e1', 'f1', 'f2', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd41b0000-%';
insert into private.platform_admins (profile_id) values ('d41b0000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d41b0000-0000-4000-8000-00000000000a', 'Test Ispravak A', 'test-hc-a'),
  ('d41b0000-0000-4000-8000-00000000000b', 'Test Ispravak B', 'test-hc-b');
insert into public.facilities (id, organization_id, name) values ('d41b0000-0000-4000-8000-0000000000fa', 'd41b0000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d41b0000-0000-4000-8000-0000000000aa', 'd41b0000-0000-4000-8000-00000000000a', 'PG', current_date - 90, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d41b0000-0000-4000-8000-000000000051', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000fa', 'd41b0000-0000-4000-8000-0000000000aa', 'S1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d41b0000-0000-4000-8000-0000000001' || x)::uuid, ('d41b0000-0000-4000-8000-00000000000' || o)::uuid, ('d41b0000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 90, null)
from (values ('a1', 'a', 'org_admin'), ('a2', 'a', 'director'), ('e1', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f2', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000001e1', 'd41b0000-0000-4000-8000-000000000051', daterange(current_date - 90, null));
insert into public.children (id, organization_id, first_name, last_name, created_by, withdrawn_on, status)
select ('d41b0000-0000-4000-8000-0000000000' || x)::uuid, 'd41b0000-0000-4000-8000-00000000000a', 'Dijete', x, null,
       case when x = 'd4' then current_date - 5 end, (case when x = 'd4' then 'withdrawn' else 'active' end)::public.child_status
from unnest(array['d1', 'd2', 'd3', 'd4']) x;
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d41b0000-0000-4000-8000-00000000e001', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'd41b0000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d41b0000-0000-4000-8000-00000000e002', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d2', 'd41b0000-0000-4000-8000-000000000051', daterange(current_date - 30, null), null),
  ('d41b0000-0000-4000-8000-00000000e03a', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d3', 'd41b0000-0000-4000-8000-000000000051', daterange(current_date - 30, current_date - 10), null),
  ('d41b0000-0000-4000-8000-00000000e03b', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d3', 'd41b0000-0000-4000-8000-000000000051', daterange(current_date - 10, null), null),
  ('d41b0000-0000-4000-8000-00000000e004', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d4', 'd41b0000-0000-4000-8000-000000000051', daterange(current_date - 30, current_date - 4), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d41b0000-0000-4000-8000-000000000a10', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000f1', 'Ana', 'Prva', null),
  ('d41b0000-0000-4000-8000-000000000a20', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000f2', 'Ivan', 'Drugi', null);
-- L1: Ana → D1 since -30 (used at handover on -15, absence reported on -25 for day -12). L2: Ivan → D1 since -20, restricted
-- from -10 (R1); Ivan reported an absence on day -15, before the restriction.
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d41b0000-0000-4000-8000-00000000c001', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'd41b0000-0000-4000-8000-000000000a10', true, true, true, daterange(current_date - 30, null), null),
  ('d41b0000-0000-4000-8000-00000000c002', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'd41b0000-0000-4000-8000-000000000a20', true, true, true, daterange(current_date - 20, null), null);
insert into public.access_restrictions (id, organization_id, child_guardian_id, valid_during, created_by) values
  ('d41b0000-0000-4000-8000-00000000f001', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-00000000c002', daterange(current_date - 10, null), null);
-- P1 used at a handover on -15; P2 never used; P3 cancelled today (Q-T22).
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during, created_by, cancelled_at, cancelled_period) values
  ('d41b0000-0000-4000-8000-00000000b001', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'Mara', 'Baka', daterange(current_date - 30, null), null, null, null),
  ('d41b0000-0000-4000-8000-00000000b002', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'Ivna', 'Tetaa', daterange(current_date - 30, null), null, null, null),
  ('d41b0000-0000-4000-8000-00000000b003', 'd41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'Pogresna', 'Osoba', 'empty', null, now(), daterange(current_date, null));
-- Past events (as recorded on those days).
insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key, handover_child_guardian_id, handover_pickup_id) values
  ('d41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'check_in', (current_date - 15) + time '08:00', current_date - 15, 'd41b0000-0000-4000-8000-0000000000e1', 'app', gen_random_uuid(), null, 'd41b0000-0000-4000-8000-00000000b001'),
  ('d41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', 'check_out', (current_date - 15) + time '15:00', current_date - 15, 'd41b0000-0000-4000-8000-0000000000e1', 'app', gen_random_uuid(), 'd41b0000-0000-4000-8000-00000000c001', null),
  ('d41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d2', 'check_in', (current_date - 20) + time '08:00', current_date - 20, 'd41b0000-0000-4000-8000-0000000000e1', 'app', gen_random_uuid(), null, null);
insert into public.absence_records (organization_id, child_id, starts_on, ends_on, reported_by, source, created_at) values
  ('d41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', current_date - 12, current_date - 12, 'd41b0000-0000-4000-8000-0000000000f1', 'guardian', (current_date - 25) + time '09:00'),
  ('d41b0000-0000-4000-8000-00000000000a', 'd41b0000-0000-4000-8000-0000000000d1', current_date - 14, current_date - 14, 'd41b0000-0000-4000-8000-0000000000f2', 'guardian', (current_date - 15) + time '09:00');

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d41b0000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.id(x text) returns uuid language sql as $$ select ('d41b0000-0000-4000-8000-00000000' || x)::uuid $$;
grant execute on function pg_temp.id(text) to authenticated;
create function pg_temp.fix(t text, rid text, r daterange, reason text default 'wrong_date_recorded', note text default 'Datum je pogrešno upisan u evidenciju.',
                            fn text default null, ln text default null) returns uuid language sql as $$
  select api.correct_relationship_history(t, pg_temp.id(rid), r, reason::public.history_correction_reason, note, fn, ln) $$;
grant execute on function pg_temp.fix(text, text, daterange, text, text, text, text) to authenticated;
create function pg_temp.affected(q text) returns int language plpgsql as $$
declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;
grant execute on function pg_temp.affected(text) to authenticated;

-- Catalog -------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.history_corrections'::regclass), 'RLS on history_corrections');
select ok(not has_table_privilege('authenticated', 'public.history_corrections', 'INSERT')
  and not has_table_privilege('authenticated', 'public.history_corrections', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.history_corrections', 'DELETE')
  and not has_table_privilege('anon', 'public.history_corrections', 'SELECT'), 'clients never write the evidence; anon reads nothing');
select ok(not (select prosecdef from pg_proc where oid = 'api.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text)'::regprocedure)
  and not has_function_privilege('anon', 'api.correct_relationship_history(text, uuid, daterange, public.history_correction_reason, text, text, text)', 'EXECUTE'),
  'invoker wrapper, not for anon (SR-API-01)');
select is((select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prosecdef and n.nspname in ('private', 'api', 'public')
             and pg_get_functiondef(p.oid) ~* '(update|insert into|delete from)\s+public\.(enrollments|child_guardians|access_restrictions|pickup_authorizations)\M'),
  'cancel_future_record,cancel_same_day_record,correct_relationship_history,transfer_child,withdraw_child',
  'only reviewed definer functions write the four relationship tables (a new one fails this until reviewed)');

-- Who may correct (Q-T17) -----------------------------------------------------------------------------------------------
select pg_temp.login('e1');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null))$$, '42501', 'PERMISSION_DENIED', 'an educator cannot correct');
reset role;
select pg_temp.login('f1');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null))$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot correct');
reset role;
select pg_temp.login('a1');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null))$$, '42501', 'PERMISSION_DENIED', 'an org_admin without MFA cannot correct');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null))$$, '42501', 'PERMISSION_DENIED', 'a manager of another kindergarten cannot correct');
select throws_ok($$select api.correct_relationship_history('pickup_authorization', gen_random_uuid(), daterange(current_date - 40, null), 'other', 'Nepostojeći zapis za test.')$$,
  '42501', 'PERMISSION_DENIED', 'an unknown id gets the same answer');
reset role;
select pg_temp.login('c1', 'aal2');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null))$$, '42501', 'PERMISSION_DENIED', 'a platform admin cannot correct');
reset role;

-- Input (Q-T18) ---------------------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.correct_relationship_history('pickup_authorization', pg_temp.id('b002'), daterange(current_date - 40, null), null, 'Datum je pogrešno upisan.')$$, '22023', null, 'a reason code is required');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null), 'wrong_date_recorded', null)$$, 'P0001', 'CORRECTION_NOTE_INVALID', 'a note is required');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null), 'wrong_date_recorded', '   kratko  ')$$, 'P0001', 'CORRECTION_NOTE_INVALID', 'a note of fewer than 10 characters is refused');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null), 'wrong_date_recorded', repeat('x', 1001))$$, 'P0001', 'CORRECTION_NOTE_INVALID', 'a note over 1,000 characters is refused');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', 'empty')$$, 'P0001', 'CORRECTION_PERIOD_INVALID', 'an empty period would delete the record — refused');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(null, current_date))$$, 'P0001', 'CORRECTION_PERIOD_INVALID', 'an open start is refused');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 30, null))$$, 'P0001', 'CORRECTION_NO_CHANGE', 'no change is refused');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 30, current_date + 30))$$, 'P0001', 'CORRECTION_NOT_HISTORICAL', 'a change of future days only is a regular operation');
select throws_ok($$select pg_temp.fix('enrollment', 'e001', daterange(current_date - 40, null), 'other', 'Pogrešan unos imena.', 'Ime', 'Prezime')$$, '22023', null, 'names exist only for pickup persons');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 30, null), 'entered_in_error', 'Ime je pogrešno upisano.', '', 'Teta')$$, 'P0001', 'CORRECTION_NAME_INVALID', 'a name must be valid');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b003', daterange(current_date - 3, null))$$, 'P0001', 'RECORD_ALREADY_CANCELLED', 'a cancelled record (Q-T22) cannot be corrected');
reset role;

-- Successful corrections of all four types -----------------------------------------------------------------------------
select pg_temp.login('f1');
select is((select count(*)::int from public.children where id = pg_temp.id('00d1')), 1, 'before: Ana sees D1');
reset role;
select pg_temp.login('a1', 'aal2');
select lives_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null))$$, 'org_admin with MFA: an earlier start of a pickup authorization');
select lives_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, null), 'entered_in_error', 'Ime je pogrešno upisano pri unosu.', 'Iva', 'Teta')$$,
  'a pickup person never used at a handover can have the name corrected');
reset role;
select pg_temp.login('a2', 'aal2');
select lives_ok($$select pg_temp.fix('enrollment', 'e001', daterange(current_date - 45, null), 'late_information')$$, 'director with MFA: an earlier enrolment start');
select lives_ok($$select pg_temp.fix('child_guardian', 'c002', daterange(current_date - 25, null), 'authority_document')$$, 'a link start corrected (its restriction stays inside)');
select lives_ok($$select pg_temp.fix('access_restriction', 'f001', daterange(current_date - 12, null), 'authority_document')$$, 'a restriction start corrected (no event of the guardian on the added days)');
reset role;
select pg_temp.login('f1');
select is((select count(*)::int from public.children where id = pg_temp.id('00d1')), 1, 'after: corrections of past days do not change Ana''s access today');
reset role;

-- History of events keeps its meaning -----------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b001', daterange(current_date - 30, null), 'entered_in_error', 'Ime je pogrešno upisano pri unosu.', 'Marija', 'Baka')$$,
  'P0001', 'CORRECTION_NAME_IN_USE', 'a person recorded at a handover keeps the recorded name');
select throws_ok($$select pg_temp.fix('pickup_authorization', 'b001', daterange(current_date - 10, null))$$, 'P0001', 'CORRECTION_CONFLICTS', 'pickup: days with a handover cannot be removed');
select throws_ok($$select pg_temp.fix('child_guardian', 'c001', daterange(current_date - 10, null))$$, 'P0001', 'CORRECTION_CONFLICTS', 'link: days with a handover by the link cannot be removed');
select throws_ok($$select pg_temp.fix('child_guardian', 'c001', daterange(current_date - 30, current_date - 13))$$, 'P0001', 'CORRECTION_CONFLICTS', 'link: the day of a reported absence cannot be removed');
select throws_ok($$select pg_temp.fix('enrollment', 'e002', daterange(current_date - 10, null))$$, 'P0001', 'CORRECTION_CONFLICTS', 'enrolment: a day with attendance cannot be removed');
select throws_ok($$select pg_temp.fix('access_restriction', 'f001', daterange(current_date - 16, null), 'authority_document')$$, 'P0001', 'CORRECTION_CONFLICTS',
  'restriction: days on which the guardian acted cannot become restricted');
select throws_ok($$select pg_temp.fix('child_guardian', 'c002', daterange(current_date - 5, null))$$, 'P0001', 'CORRECTION_CONFLICTS', 'link: its restriction would fall outside it');
select throws_ok($$select pg_temp.fix('access_restriction', 'f001', daterange(current_date - 40, null), 'authority_document')$$, 'P0001', 'CORRECTION_OUTSIDE_LINK', 'restriction: not before its link');
select throws_ok($$select pg_temp.fix('enrollment', 'e03a', daterange(current_date - 30, current_date - 5))$$, 'P0001', 'CORRECTION_OVERLAP', 'enrolments never overlap');
select throws_ok($$select pg_temp.fix('enrollment', 'e004', daterange(current_date - 30, current_date - 2))$$, 'P0001', 'CHILD_WITHDRAWN', 'nothing valid after a withdrawal (D-35)');
reset role;
select is((select count(*)::int from public.attendance_records where organization_id = 'd41b0000-0000-4000-8000-00000000000a'), 3, 'no attendance record changed');
select is((select count(*)::int from public.absence_records where organization_id = 'd41b0000-0000-4000-8000-00000000000a'), 2, 'no absence record changed');
select is((select first_name || ' ' || last_name from public.pickup_authorizations where id = pg_temp.id('b001')), 'Mara Baka', 'the handover still shows the recorded name');

-- Evidence and audit ----------------------------------------------------------------------------------------------------
select is((select count(*)::int from public.history_corrections where organization_id = 'd41b0000-0000-4000-8000-00000000000a'), 5, 'one evidence row per successful correction');
select is((select old_values ->> 'valid_during' || ' → ' || (new_values ->> 'valid_during') || ' · ' || reason_code || ' · ' || corrected_role || ' · ' || aal
           from public.history_corrections where record_id = pg_temp.id('e001')),
  daterange(current_date - 30, null)::text || ' → ' || daterange(current_date - 45, null)::text || ' · late_information · director · aal2',
  'previous and new state, reason, role and MFA level are recorded');
select is((select (new_values ->> 'first_name') || ' ' || (new_values ->> 'last_name') || ' / ' || (old_values ->> 'first_name')
           from public.history_corrections where record_id = pg_temp.id('b002') and new_values ->> 'first_name' = 'Iva'), 'Iva Teta / Ivna', 'a name correction keeps the old name');
select ok((select supersedes is not null from public.history_corrections where record_id = pg_temp.id('b002') and new_values ->> 'first_name' = 'Iva'),
  'a second correction of the same record points to the earlier one');
select is((select count(*)::int from audit.audit_events where action = 'history.corrected' and organization_id = 'd41b0000-0000-4000-8000-00000000000a'), 5, 'each correction is audited');
select is((select count(*)::int from audit.audit_events where action = 'history.corrected'
           and (details::text ~ 'pogrešno|Iva|Ivna|Teta|Mara' or details::text ~ 'note')), 0, 'the audit event holds no note and no names');
select is((select string_agg(distinct k, ',' order by k) from audit.audit_events, jsonb_object_keys(details) k where action = 'history.corrected'),
  'changed_columns,correction_id,new_ends_on,new_starts_on,old_ends_on,old_starts_on,reason,record_type', 'audit keys: ids, dates and codes only');

-- Append-only evidence, read by managers only ----------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select is((select count(*)::int from public.history_corrections), 5, 'an org_admin with MFA reads the corrections of the kindergarten');
select throws_ok($$update public.history_corrections set note = 'promijenjeno, ne smije'$$, '42501', null, 'a client cannot change a correction');
select throws_ok($$delete from public.history_corrections$$, '42501', null, 'nor delete one');
reset role;
select throws_ok($$update public.history_corrections set note = 'promijenjeno, ne smije'$$, '42501', 'HISTORY_CORRECTION_IMMUTABLE', 'the owner role in a normal session is also stopped by the trigger (it could still disable or drop the trigger — trust boundary, see threat model)');
select throws_ok($$delete from public.history_corrections$$, '42501', 'HISTORY_CORRECTION_IMMUTABLE', 'nor delete one in a normal session');
select throws_ok($$truncate public.history_corrections$$, '42501', 'HISTORY_CORRECTION_IMMUTABLE', 'nor truncate the table in a normal session');
select pg_temp.login('a1');
select is((select count(*)::int from public.history_corrections), 0, 'a manager without MFA reads nothing');
reset role;
select pg_temp.login('b1', 'aal2');
select is((select count(*)::int from public.history_corrections), 0, 'another kindergarten reads nothing');
reset role;
select pg_temp.login('e1');
select is((select count(*)::int from public.history_corrections), 0, 'an educator reads nothing');
reset role;
select pg_temp.login('c1', 'aal2');
select is((select count(*)::int from public.history_corrections), 0, 'a platform admin reads nothing');
reset role;

-- Effect on access today, regular path still closed, atomicity ----------------------------------------------------------
select pg_temp.login('e1');
select is((select count(*)::int from api.handover_candidates(pg_temp.id('00d1')) where first_name = 'Iva'), 1, 'before: Iva is offered at handover today');
reset role;
select pg_temp.login('a1', 'aal2');
select lives_ok($$select pg_temp.fix('pickup_authorization', 'b002', daterange(current_date - 40, current_date - 1), 'authority_document', 'Ovlaštenje je prema dokumentu prestalo prije dva dana.')$$,
  'a correction may end a never-used authorization in the past');
select throws_ok($$update public.pickup_authorizations set valid_during = daterange(current_date - 50, current_date - 1) where id = pg_temp.id('b002')$$, 'P0001', 'HISTORY_IMMUTABLE',
  'a direct update of past days is still refused (D-41a)');
reset role;
select pg_temp.login('e1');
select is((select count(*)::int from api.handover_candidates(pg_temp.id('00d1')) where first_name = 'Iva'), 0, 'after: the corrected period applies on the next request');
reset role;
create function pg_temp.boom() returns trigger language plpgsql as $$ begin if new.action = 'history.corrected' then raise exception 'BOOM'; end if; return new; end $$;
create trigger zz_boom before insert on audit.audit_events for each row execute function pg_temp.boom();
select pg_temp.login('a1', 'aal2');
select throws_ok($$select pg_temp.fix('enrollment', 'e001', daterange(current_date - 50, null))$$, 'P0001', 'BOOM', 'a failing audit write fails the correction');
reset role;
drop trigger zz_boom on audit.audit_events;
select is((select lower(valid_during) from public.enrollments where id = pg_temp.id('e001')), current_date - 45, 'and nothing changed: the record keeps the previous period');
select is((select count(*)::int from public.history_corrections where record_id = pg_temp.id('e001')), 1, 'and no evidence row was left behind');

select * from finish();
rollback;
