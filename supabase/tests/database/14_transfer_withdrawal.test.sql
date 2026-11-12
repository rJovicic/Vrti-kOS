-- D2-E: transfer and withdrawal (migration 20261112130000_transfer_and_withdrawal.sql). FR-04-2, FR-04-3, AC-04-4,
-- AC-04-8, D-35 (withdrawal ends enrolment, links and pickup authorizations at the last day), D-36 (no dates in the
-- past; manual enrolment changes never rewrite past days), NEG-08 (educator access ends at once), audit, atomicity.
-- Synthetic data, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(91);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2e00000-0000-4000-8000-0000000000' || x)::uuid, 'tw-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f3', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2e00000-%';
insert into private.platform_admins (profile_id) values ('d2e00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d2e00000-0000-4000-8000-00000000000a', 'Test Premjestaj A', 'test-tw-a'),
  ('d2e00000-0000-4000-8000-00000000000b', 'Test Premjestaj B', 'test-tw-b');
insert into public.facilities (id, organization_id, name) values
  ('d2e00000-0000-4000-8000-0000000000fa', 'd2e00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d2e00000-0000-4000-8000-0000000000fb', 'd2e00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2e00000-0000-4000-8000-0000000000aa', 'd2e00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d2e00000-0000-4000-8000-0000000000bb', 'd2e00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name, archived_at) values
  ('d2e00000-0000-4000-8000-000000000051', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000fa', 'd2e00000-0000-4000-8000-0000000000aa', 'S1', null),
  ('d2e00000-0000-4000-8000-000000000052', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000fa', 'd2e00000-0000-4000-8000-0000000000aa', 'S2', null),
  ('d2e00000-0000-4000-8000-000000000053', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000fa', 'd2e00000-0000-4000-8000-0000000000aa', 'S3', now()),
  ('d2e00000-0000-4000-8000-000000000061', 'd2e00000-0000-4000-8000-00000000000b', 'd2e00000-0000-4000-8000-0000000000fb', 'd2e00000-0000-4000-8000-0000000000bb', 'B1', null);
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d2e00000-0000-4000-8000-0000000001' || x)::uuid, ('d2e00000-0000-4000-8000-00000000000' || o)::uuid, ('d2e00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f3', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000001e1', 'd2e00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000001e2', 'd2e00000-0000-4000-8000-000000000052', daterange(current_date - 30, null));
-- Children: Ivo (S1, transfer today), Jan (S1, transfer tomorrow), Kai (no group), Lin (S1 now, S2 planned from +10),
-- Mak (S1 from today), Ola (S1, withdrawal today), Pia (S1, withdrawal in +5 days), Rea (S1, manual edits), Beta (B).
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d2e00000-0000-4000-8000-0000000000' || x)::uuid, ('d2e00000-0000-4000-8000-00000000000' || o)::uuid, n, 'Test', null
from (values ('d1', 'a', 'Ivo'), ('d2', 'a', 'Jan'), ('d3', 'a', 'Kai'), ('d4', 'a', 'Lin'), ('d5', 'a', 'Mak'), ('d6', 'a', 'Ola'),
             ('d7', 'a', 'Pia'), ('d8', 'a', 'Rea'), ('db', 'b', 'Beta')) v(x, o, n);
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
select ('d2e00000-0000-4000-8000-00000000000' || o)::uuid, ('d2e00000-0000-4000-8000-0000000000' || c)::uuid, ('d2e00000-0000-4000-8000-0000000000' || g)::uuid, r, null
from (values ('a', 'd1', '51', daterange(current_date - 30, null)), ('a', 'd2', '51', daterange(current_date - 30, null)),
             ('a', 'd4', '51', daterange(current_date - 30, current_date + 10)), ('a', 'd4', '52', daterange(current_date + 10, null)),
             ('a', 'd5', '51', daterange(current_date, null)), ('a', 'd6', '51', daterange(current_date - 30, null)),
             ('a', 'd7', '51', daterange(current_date - 30, null)), ('a', 'd8', '51', daterange(current_date - 30, null)),
             ('b', 'db', '61', daterange(current_date - 30, null))) v(o, c, g, r);
-- Guardians: Ana (Ivo, Kai, Ola), Cvita (Ivo, restricted). Ola also has an ended link and ended/current pickups.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2e00000-0000-4000-8000-000000000a01', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null),
  ('d2e00000-0000-4000-8000-000000000a03', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000f3', 'Cvita', 'Skrbnik', null),
  ('d2e00000-0000-4000-8000-000000000a04', 'd2e00000-0000-4000-8000-00000000000a', null, 'Eva', 'Bivsa', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during, created_by) values
  ('d2e00000-0000-4000-8000-00000000c011', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d1', 'd2e00000-0000-4000-8000-000000000a01', true, false, true, daterange(current_date - 30, null), null),
  ('d2e00000-0000-4000-8000-00000000c031', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d1', 'd2e00000-0000-4000-8000-000000000a03', true, true, true, daterange(current_date - 30, null), null),
  ('d2e00000-0000-4000-8000-00000000c013', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d3', 'd2e00000-0000-4000-8000-000000000a01', true, true, true, daterange(current_date - 30, null), null),
  ('d2e00000-0000-4000-8000-00000000c016', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d6', 'd2e00000-0000-4000-8000-000000000a01', true, false, true, daterange(current_date - 30, null), null),
  ('d2e00000-0000-4000-8000-00000000c046', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d6', 'd2e00000-0000-4000-8000-000000000a04', true, true, true, daterange(current_date - 30, current_date - 5), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-00000000c031', daterange(current_date - 1, null), null);
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d2e00000-0000-4000-8000-00000000b011', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d1', 'Mara', 'Baka', daterange(current_date - 10, null), null),
  ('d2e00000-0000-4000-8000-00000000b016', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d6', 'Nina', 'Teta', daterange(current_date - 10, current_date + 100), null),
  ('d2e00000-0000-4000-8000-00000000b026', 'd2e00000-0000-4000-8000-00000000000a', 'd2e00000-0000-4000-8000-0000000000d6', 'Stari', 'Ovlasteni', daterange(current_date - 10, current_date - 2), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d2e00000-0000-4000-8000-0000000000' || x)::uuid $$;
grant execute on function pg_temp.uid(text) to authenticated;
create function pg_temp.kids() returns text language sql as $$
  select coalesce(string_agg(first_name, ',' order by first_name), '') from public.children
$$;
grant execute on function pg_temp.kids() to authenticated;
-- Enrolment periods of a child as text, ordered: 'S1 [a,b) | S2 [b,)' with dates relative to today.
create function pg_temp.periods(c text) returns text language sql as $$
  select string_agg(g.name || ' ' || (lower(e.valid_during) - current_date)::text || '..'
                    || coalesce((upper(e.valid_during) - current_date)::text, ''), ' | ' order by lower(e.valid_during))
  from public.enrollments e join public.groups g on g.id = e.group_id
  where e.child_id = pg_temp.uid(c)
$$;
create function pg_temp.upper_of(t text, id uuid) returns int language plpgsql as $$
declare r int;
begin
  execute format('select upper(valid_during) - current_date from public.%I where id = $1', t) into r using id;
  return r;
end $$;

-- Catalog ----------------------------------------------------------------------------------------------------------
select ok(not (select prosecdef from pg_proc where oid = 'api.transfer_child(uuid, uuid, date)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'api.withdraw_child(uuid, date)'::regprocedure), 'the exposed RPCs are SECURITY INVOKER (SR-API-01)');
select ok(not has_function_privilege('anon', 'api.transfer_child(uuid, uuid, date)', 'EXECUTE')
  and not has_function_privilege('anon', 'api.withdraw_child(uuid, date)', 'EXECUTE'), 'anon cannot call transfer or withdrawal');
select ok(not has_function_privilege('authenticated', 'private.lock_child_for_manager(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.guard_child_lifecycle()', 'EXECUTE'), 'internal helpers are not callable by clients');

-- Authorization: same answer for every caller without rights, nothing changes -------------------------------------
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('52'), current_date)$$, '42501', 'PERMISSION_DENIED', 'an educator cannot transfer');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date)$$, '42501', 'PERMISSION_DENIED', 'an educator cannot withdraw');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('52'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot transfer their own child');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot withdraw their own child');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('52'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot transfer');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot withdraw');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('61'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a B manager cannot transfer an A child (NEG-01)');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a B manager cannot withdraw an A child');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a platform admin cannot withdraw (NEG-10)');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.transfer_child('d2e00000-0000-4000-8000-00000000ffff', pg_temp.uid('52'), current_date)$$, '42501', 'PERMISSION_DENIED', 'an unknown child gets the same answer');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('61'), current_date)$$, '42501', 'PERMISSION_DENIED', 'a group of another kindergarten gets the same answer');
select throws_ok($$select api.withdraw_child(pg_temp.uid('db'), current_date)$$, '42501', 'PERMISSION_DENIED', 'an A manager cannot withdraw a B child');
reset role;
select is(pg_temp.periods('d1'), 'S1 -30..', 'after all denied attempts Ivo''s enrolment is unchanged');
select is((select status::text from public.children where id = pg_temp.uid('d1')), 'active', 'and Ivo is still active');

-- Validation (manager with MFA) ----------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), null, current_date)$$, '22023', 'INVALID_ARGUMENTS', 'missing arguments are rejected');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('52'), current_date - 1)$$, 'P0001', 'EFFECTIVE_DATE_IN_PAST', 'no transfer into the past (D-36)');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d6'), current_date - 1)$$, 'P0001', 'EFFECTIVE_DATE_IN_PAST', 'no withdrawal into the past (D-36)');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('51'), current_date)$$, 'P0001', 'TRANSFER_SAME_GROUP', 'no transfer into the current group');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('53'), current_date)$$, 'P0001', 'GROUP_ARCHIVED', 'no transfer into an archived group');
select throws_ok($$select api.transfer_child(pg_temp.uid('d3'), pg_temp.uid('52'), current_date)$$, 'P0001', 'CHILD_NOT_ENROLLED', 'a child without an enrolment is enrolled, not transferred (D-32)');
select throws_ok($$select api.transfer_child(pg_temp.uid('d4'), pg_temp.uid('52'), current_date + 1)$$, 'P0001', 'ENROLLMENT_OVERLAP', 'no transfer while a later enrolment is already planned');
select throws_ok($$select api.transfer_child(pg_temp.uid('d5'), pg_temp.uid('52'), current_date)$$, 'P0001', 'TRANSFER_ON_ENROLLMENT_START', 'no transfer on the first day of the enrolment');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d4'), current_date)$$, 'P0001', 'WITHDRAWAL_HAS_FUTURE_RECORDS', 'no withdrawal before a planned enrolment (not cancelled automatically)');
reset role;
select is(pg_temp.periods('d4'), 'S1 -30..10 | S2 10..', 'the planned enrolment is untouched after the refusals');

-- Transfer effective today (AC-04-4) -----------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select isnt(api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('52'), current_date), null, 'a manager transfers Ivo to S2 from today');
reset role;
select is(pg_temp.periods('d1'), 'S1 -30..0 | S2 0..', 'the S1 enrolment is closed yesterday and kept; the S2 enrolment starts today, open-ended like before');
select is((select created_by from public.enrollments where child_id = pg_temp.uid('d1') and group_id = pg_temp.uid('52')), pg_temp.uid('a1'), 'the new enrolment records the manager');
select pg_temp.login(pg_temp.uid('e1'));
select is(pg_temp.kids(), 'Jan,Lin,Mak,Ola,Pia,Rea', 'E1 no longer sees Ivo on the next request (NEG-08); the rest of S1 is unchanged');
select is((select count(*)::int from public.child_guardian_overview where child_id = pg_temp.uid('d1')), 0, 'E1 no longer sees Ivo''s guardians');
select is((select count(*)::int from public.pickup_authorizations where child_id = pg_temp.uid('d1')), 0, 'E1 no longer sees Ivo''s pickup persons');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select is(pg_temp.kids(), 'Ivo', 'E2 sees Ivo from today');
select is((select string_agg(is_restricted::text, ',' order by is_restricted) from public.child_guardian_overview where child_id = pg_temp.uid('d1')), 'false,true',
  'E2 sees both links of Ivo, the restriction mark is kept (D-33)');
select is((select string_agg(first_name, ',') from public.pickup_authorizations where child_id = pg_temp.uid('d1')), 'Mara', 'E2 sees Ivo''s pickup persons');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select is((select can_report_absence::text || can_view::text || receives_messages::text from public.child_guardians where child_id = pg_temp.uid('d1')), 'falsetruetrue',
  'Ana''s link and rights are unchanged by the transfer');
select ok((select count(*) from public.enrollments where child_id = pg_temp.uid('d1')) >= 1, 'Ana still sees Ivo''s enrolment');
reset role;
select pg_temp.login(pg_temp.uid('f3'));
select is(pg_temp.kids(), '', 'the restricted guardian still sees nothing after the transfer');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.transfer_child(pg_temp.uid('d1'), pg_temp.uid('51'), current_date)$$, 'P0001', 'TRANSFER_ON_ENROLLMENT_START', 'no second transfer on the same day');
reset role;

-- Transfer in the future ----------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.transfer_child(pg_temp.uid('d2'), pg_temp.uid('52'), current_date + 7)$$, 'a transfer can be planned for a later date');
reset role;
select is(pg_temp.periods('d2'), 'S1 -30..7 | S2 7..', 'Jan stays in S1 until then and is in S2 from that day');
select pg_temp.login(pg_temp.uid('e1'));
select ok(pg_temp.kids() like '%Jan%', 'E1 still sees Jan today');
reset role;
select pg_temp.login(pg_temp.uid('e2'));
select ok(pg_temp.kids() not like '%Jan%', 'E2 does not see Jan before the transfer date');
reset role;

-- Audit of transfers --------------------------------------------------------------------------------------------
select is((select count(*)::int from audit.audit_events where action = 'child.transfer' and organization_id = 'd2e00000-0000-4000-8000-00000000000a'
           and actor_id = pg_temp.uid('a1') and actor_role = 'org_admin'), 2, 'each transfer writes one summary audit event with the actor role');
select is((select details ->> 'to_group_id' from audit.audit_events where action = 'child.transfer' and target_id = pg_temp.uid('d1')), pg_temp.uid('52')::text,
  'the summary names groups and dates by id only');
select is((select count(*)::int from audit.audit_events where target_table = 'enrollments' and actor_id = pg_temp.uid('a1')), 4,
  'the closed and the new enrolment rows are audited as well');
select ok(not exists (select 1 from audit.audit_events where action like 'child.%' and details::text ~ 'Ivo|Jan|Ana|Mara|S1|S2'),
  'no names in the audit details');
select is((select count(*)::int from audit.audit_events where action like 'child.%' and outcome <> 'success'), 0, 'refused calls write nothing (they roll back)');

-- Withdrawal effective today (D-35, AC-04-8) --------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.withdraw_child(pg_temp.uid('d6'), current_date)$$, 'a manager withdraws Ola with today as the last day');
reset role;
select is((select status::text || ' ' || (withdrawn_on - current_date)::text from public.children where id = pg_temp.uid('d6')), 'withdrawn 0', 'Ola is withdrawn with today as the last day');
select is(pg_temp.periods('d6'), 'S1 -30..1', 'the enrolment is kept and valid through today');
select is(pg_temp.upper_of('child_guardians', 'd2e00000-0000-4000-8000-00000000c016'), 1, 'Ana''s link to Ola is valid through today');
select is(pg_temp.upper_of('child_guardians', 'd2e00000-0000-4000-8000-00000000c046'), -5, 'an already ended link keeps its own end');
select is(pg_temp.upper_of('pickup_authorizations', 'd2e00000-0000-4000-8000-00000000b016'), 1, 'Nina''s authorization (planned to +100) ends with the last day');
select is(pg_temp.upper_of('pickup_authorizations', 'd2e00000-0000-4000-8000-00000000b026'), -2, 'an already ended authorization keeps its own end');
select is((select can_report_absence::text from public.child_guardians where id = 'd2e00000-0000-4000-8000-00000000c016'), 'false', 'link rights are not changed by the withdrawal');
select is((select count(*)::int from public.child_guardians where child_id = pg_temp.uid('d6')) + (select count(*)::int from public.pickup_authorizations where child_id = pg_temp.uid('d6'))
  + (select count(*)::int from public.enrollments where child_id = pg_temp.uid('d6')), 5, 'no row is deleted');
select ok(not exists (select 1 from public.enrollments where child_id = pg_temp.uid('d6') and valid_during @> current_date + 1)
  and not exists (select 1 from public.child_guardians where child_id = pg_temp.uid('d6') and valid_during @> current_date + 1)
  and not exists (select 1 from public.pickup_authorizations where child_id = pg_temp.uid('d6') and valid_during @> current_date + 1),
  'nothing about Ola is valid from tomorrow: educator, guardian and pickup access end then');
select pg_temp.login(pg_temp.uid('e1'));
select ok(pg_temp.kids() like '%Ola%', 'on the last day E1 still sees Ola');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select ok(pg_temp.kids() like '%Ola%', 'on the last day Ana still sees Ola');
reset role;
select is((select (details ->> 'closed_enrollments') || (details ->> 'closed_guardian_links') || (details ->> 'closed_pickup_authorizations')
           from audit.audit_events where action = 'child.withdraw' and target_id = pg_temp.uid('d6') and actor_role = 'org_admin'), '111',
  'the withdrawal is audited once with counts only');
select is((select count(*)::int from audit.audit_events where target_id = pg_temp.uid('d6') and action = 'children.update'), 1, 'the status change of the child is audited');

-- After withdrawal: nothing can be reopened (D-35) --------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d6'), current_date + 1)$$, 'P0001', 'CHILD_WITHDRAWN', 'a child is withdrawn once');
select throws_ok($$select api.transfer_child(pg_temp.uid('d6'), pg_temp.uid('52'), current_date)$$, 'P0001', 'CHILD_WITHDRAWN', 'a withdrawn child is not transferred');
select throws_ok($$insert into public.enrollments (organization_id, child_id, group_id, valid_during)
  values ('d2e00000-0000-4000-8000-00000000000a', pg_temp.uid('d6'), pg_temp.uid('52'), daterange(current_date + 3, null))$$, 'P0001', 'CHILD_WITHDRAWN', 'no new enrolment after the last day');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 30, null) where child_id = pg_temp.uid('d6')$$, 'P0001', 'CHILD_WITHDRAWN', 'the enrolment cannot be reopened');
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during)
  values ('d2e00000-0000-4000-8000-00000000000a', pg_temp.uid('d6'), 'd2e00000-0000-4000-8000-000000000a03', true, daterange(current_date, null))$$, 'P0001', 'CHILD_WITHDRAWN', 'no new guardian link after the last day');
select throws_ok($$update public.child_guardians set valid_during = daterange(current_date - 30, null) where id = 'd2e00000-0000-4000-8000-00000000c016'$$, 'P0001', 'CHILD_WITHDRAWN', 'a closed link cannot be reopened');
select throws_ok($$insert into public.pickup_authorizations (organization_id, child_id, first_name, last_name, valid_during)
  values ('d2e00000-0000-4000-8000-00000000000a', pg_temp.uid('d6'), 'Nova', 'Osoba', daterange(current_date, null))$$, 'P0001', 'CHILD_WITHDRAWN', 'no new pickup person after the last day');
select throws_ok($$update public.pickup_authorizations set valid_during = daterange(current_date - 10, current_date + 30) where id = 'd2e00000-0000-4000-8000-00000000b016'$$, 'P0001', 'CHILD_WITHDRAWN', 'a closed authorization cannot be extended');
select throws_ok($$update public.children set status = 'active', withdrawn_on = null where id = pg_temp.uid('d6')$$, '42501', null, 'the status cannot be reset directly');
select lives_ok($$update public.child_guardians set receives_messages = false where id = 'd2e00000-0000-4000-8000-00000000c016'$$, 'records within the last day can still be corrected');
reset role;
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during)
  values ('d2e00000-0000-4000-8000-00000000000a', pg_temp.uid('d6'), 'd2e00000-0000-4000-8000-000000000a03', true, daterange(current_date, null))$$, '42501', 'PERMISSION_DENIED',
  'an educator gets PERMISSION_DENIED first, not the withdrawal state');
reset role;

-- Withdrawal planned in the future, and of a child without a group -----------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.withdraw_child(pg_temp.uid('d7'), current_date + 5)$$, 'a withdrawal can be planned with a later last day');
select lives_ok($$select api.withdraw_child(pg_temp.uid('d3'), current_date)$$, 'a child without a group can be withdrawn (D-32)');
reset role;
select is(pg_temp.periods('d7'), 'S1 -30..6', 'Pia stays enrolled through her last day');
select pg_temp.login(pg_temp.uid('e1'));
select ok(pg_temp.kids() like '%Pia%', 'access follows the dates, not the status: E1 still sees Pia');
reset role;
select is(pg_temp.upper_of('child_guardians', 'd2e00000-0000-4000-8000-00000000c013'), 1, 'Ana''s link to Kai ends with Kai''s last day');

-- D-36: manual changes of an enrolment period never rewrite past days ---------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 20, null) where child_id = pg_temp.uid('d8')$$, 'P0001', 'HISTORY_IMMUTABLE', 'the start in the past cannot move');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date - 30, current_date - 3) where child_id = pg_temp.uid('d8')$$, 'P0001', 'HISTORY_IMMUTABLE', 'an enrolment cannot be ended in the past');
select lives_ok($$update public.enrollments set valid_during = daterange(current_date - 30, current_date + 40) where child_id = pg_temp.uid('d8')$$, 'a future end can be set');
select lives_ok($$update public.enrollments set valid_during = daterange(current_date - 30, current_date) where child_id = pg_temp.uid('d8')$$, 'an enrolment can end yesterday (no past day changes)');
select throws_ok($$update public.enrollments set valid_during = daterange(current_date, current_date) where child_id = pg_temp.uid('d5')$$, '23514', null,
  'a period starting today can be shortened but never emptied');
reset role;

-- Atomicity: a failure in any step rolls back the whole operation ------------------------------------------------
create function pg_temp.boom() returns trigger language plpgsql as $$ begin raise exception 'BOOM'; end $$;
create trigger zz_boom before insert on public.enrollments for each row execute function pg_temp.boom();
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.transfer_child(pg_temp.uid('d2'), pg_temp.uid('52'), current_date + 1)$$, 'P0001', null, 'a transfer that fails while opening the new enrolment raises');
reset role;
select is(pg_temp.periods('d2'), 'S1 -30..7 | S2 7..', 'and leaves no half-closed enrolment behind');
drop trigger zz_boom on public.enrollments;
create trigger zz_boom before update on public.children for each row execute function pg_temp.boom();
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.withdraw_child(pg_temp.uid('d8'), current_date)$$, 'P0001', null, 'a withdrawal that fails at the last step raises');
reset role;
select is(pg_temp.periods('d8') || ' ' || (select status::text from public.children where id = pg_temp.uid('d8')), 'S1 -30..0 active',
  'and changes nothing: enrolment, links, authorizations and status are as before');
drop trigger zz_boom on public.children;
select is((select count(*)::int from audit.audit_events where action = 'child.withdraw' and target_id = pg_temp.uid('d8')), 0, 'a rolled-back operation leaves no audit event');

-- Managers see the full history; others never gain access through these operations -------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select is((select count(*)::int from public.enrollments where child_id in (pg_temp.uid('d1'), pg_temp.uid('d2'))), 4, 'the manager sees closed and new enrolments (history)');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select is((select count(*)::int from public.enrollments where organization_id = 'd2e00000-0000-4000-8000-00000000000a'), 0, 'B sees none of it');
reset role;

select * from finish();
rollback;
