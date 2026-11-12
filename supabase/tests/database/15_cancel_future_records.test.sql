-- D-37: cancelling records that have not taken effect (migration 20261112140000_cancel_future_records.sql).
-- Managers with MFA only; strictly future start; records in effect are never removed; audit with id, type, actor,
-- time and reason code; one transaction; no effect on anything else; no bypass through the API. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2700000-0000-4000-8000-0000000000' || x)::uuid, 'cf-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'f1', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2700000-%';
insert into private.platform_admins (profile_id) values ('d2700000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d2700000-0000-4000-8000-00000000000a', 'Test Ponistenje A', 'test-cf-a'),
  ('d2700000-0000-4000-8000-00000000000b', 'Test Ponistenje B', 'test-cf-b');
insert into public.facilities (id, organization_id, name) values
  ('d2700000-0000-4000-8000-0000000000fa', 'd2700000-0000-4000-8000-00000000000a', 'Objekt A');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d2700000-0000-4000-8000-0000000000aa', 'd2700000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d2700000-0000-4000-8000-000000000051', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000fa', 'd2700000-0000-4000-8000-0000000000aa', 'S1'),
  ('d2700000-0000-4000-8000-000000000052', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000fa', 'd2700000-0000-4000-8000-0000000000aa', 'S2');
insert into public.memberships (organization_id, profile_id, role, valid_during)
select ('d2700000-0000-4000-8000-00000000000' || o)::uuid, ('d2700000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('f1', 'a', 'guardian'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2700000-0000-4000-8000-0000000000d1', 'd2700000-0000-4000-8000-00000000000a', 'Ivo', 'Test', null);
-- Ivo: S1 until +10 (in effect), S2 planned from +10. Ana: current link and a planned second link from +5 for Eva;
-- a planned link for Cvita from +3 with a restriction. Pickups: Mara (in effect), Iva (from tomorrow), Tea (from today).
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by) values
  ('d2700000-0000-4000-8000-0000000000e1', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'd2700000-0000-4000-8000-000000000051', daterange(current_date - 30, current_date + 10), null),
  ('d2700000-0000-4000-8000-0000000000e2', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'd2700000-0000-4000-8000-000000000052', daterange(current_date + 10, null), null);
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by) values
  ('d2700000-0000-4000-8000-000000000a01', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000f1', 'Ana', 'Skrbnik', null),
  ('d2700000-0000-4000-8000-000000000a02', 'd2700000-0000-4000-8000-00000000000a', null, 'Eva', 'Skrbnik', null),
  ('d2700000-0000-4000-8000-000000000a03', 'd2700000-0000-4000-8000-00000000000a', null, 'Cvita', 'Skrbnik', null);
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d2700000-0000-4000-8000-00000000c001', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'd2700000-0000-4000-8000-000000000a01', true, daterange(current_date - 30, null), null),
  ('d2700000-0000-4000-8000-00000000c002', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'd2700000-0000-4000-8000-000000000a02', true, daterange(current_date + 5, null), null),
  ('d2700000-0000-4000-8000-00000000c003', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'd2700000-0000-4000-8000-000000000a03', true, daterange(current_date + 3, null), null);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-00000000c003', daterange(current_date + 3, null), null);
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during, created_by) values
  ('d2700000-0000-4000-8000-00000000b001', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'Mara', 'Baka', daterange(current_date - 10, null), null),
  ('d2700000-0000-4000-8000-00000000b002', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'Iva', 'Teta', daterange(current_date + 1, null), null),
  ('d2700000-0000-4000-8000-00000000b003', 'd2700000-0000-4000-8000-00000000000a', 'd2700000-0000-4000-8000-0000000000d1', 'Tea', 'Susjeda', daterange(current_date, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d2700000-0000-4000-8000-0000000000' || x)::uuid $$;
grant execute on function pg_temp.uid(text) to authenticated;
create function pg_temp.id(x text) returns uuid language sql as $$ select ('d2700000-0000-4000-8000-00000000' || x)::uuid $$;
grant execute on function pg_temp.id(text) to authenticated;
create function pg_temp.state() returns text language sql as $$
  select (select count(*) from public.enrollments where child_id = pg_temp.uid('d1')) || '/'
      || (select count(*) from public.child_guardians where child_id = pg_temp.uid('d1')) || '/'
      || (select count(*) from public.pickup_authorizations where child_id = pg_temp.uid('d1')) || '/'
      || (select count(*) from public.access_restrictions where organization_id = 'd2700000-0000-4000-8000-00000000000a')
$$;

-- Catalog and bypass ----------------------------------------------------------------------------------------------
select ok(not (select prosecdef from pg_proc where oid = 'api.cancel_future_record(text, uuid, public.cancellation_reason)'::regprocedure), 'the exposed RPC is SECURITY INVOKER (SR-API-01)');
select ok(not has_function_privilege('anon', 'api.cancel_future_record(text, uuid, public.cancellation_reason)', 'EXECUTE'), 'anon cannot cancel');
select ok(not has_table_privilege('authenticated', 'public.enrollments', 'DELETE')
  and not has_table_privilege('authenticated', 'public.child_guardians', 'DELETE')
  and not has_table_privilege('authenticated', 'public.pickup_authorizations', 'DELETE'), 'no client can delete these records directly (rule 7)');
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$delete from public.enrollments where id = pg_temp.id('00e2')$$, '42501', null, 'a manager cannot delete a future enrolment directly');
select throws_ok($$delete from public.pickup_authorizations where id = pg_temp.id('b002')$$, '42501', null, 'nor a future pickup authorization');
reset role;
select is(pg_temp.state(), '2/3/3/1', 'initial state');

-- Authorization (rule 1): same answer for every caller without rights, nothing changes --------------------------
select pg_temp.login(pg_temp.uid('e1'));
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'an educator cannot cancel');
reset role;
select pg_temp.login(pg_temp.uid('f1'));
select throws_ok($$select api.cancel_future_record('child_guardian', pg_temp.id('c002'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot cancel a link of their child');
select throws_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b002'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'nor a pickup authorization');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot cancel');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'a manager of another kindergarten cannot cancel (NEG-01)');
reset role;
select pg_temp.login(pg_temp.uid('c1'), 'aal2');
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'a platform admin cannot cancel (NEG-10)');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.cancel_future_record('enrollment', 'd2700000-0000-4000-8000-00000000ffff', 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'an unknown id gets the same answer');
select throws_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('00e2'), 'plan_changed')$$, '42501', 'PERMISSION_DENIED', 'an id of another record type gets the same answer');
select throws_ok($$select api.cancel_future_record('access_restriction', pg_temp.id('c003'), 'plan_changed')$$, '22023', 'INVALID_ARGUMENTS', 'only the three record types can be cancelled');
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), null)$$, '22023', 'INVALID_ARGUMENTS', 'a reason is required');
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), 'Ivo se seli')$$, '22P02', null, 'free text is not accepted as a reason (no personal data in the audit)');
reset role;
select is(pg_temp.state(), '2/3/3/1', 'after all refused attempts nothing changed');

-- Records in effect are never cancelled (rules 2 and 3) ---------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e1'), 'entered_in_error')$$, 'P0001', 'RECORD_ALREADY_EFFECTIVE', 'an enrolment in effect cannot be cancelled');
select throws_ok($$select api.cancel_future_record('child_guardian', pg_temp.id('c001'), 'entered_in_error')$$, 'P0001', 'RECORD_ALREADY_EFFECTIVE', 'a link in effect cannot be cancelled');
select throws_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b001'), 'entered_in_error')$$, 'P0001', 'RECORD_ALREADY_EFFECTIVE', 'an authorization in effect cannot be cancelled');
select throws_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b003'), 'entered_in_error')$$, 'P0001', 'RECORD_ALREADY_EFFECTIVE', 'a record starting today counts as in effect (strictly after today only)');
select throws_ok($$select api.cancel_future_record('child_guardian', pg_temp.id('c003'), 'entered_in_error')$$, 'P0001', 'CANCEL_RECORD_REFERENCED', 'a future link with a restriction is not cancelled (rule 6)');
reset role;
select is(pg_temp.state(), '2/3/3/1', 'still nothing changed');

-- Atomicity (rule 5): when the audit write fails, nothing is cancelled -------------------------------------------
create function pg_temp.boom() returns trigger language plpgsql as $$ begin raise exception 'BOOM'; end $$;
create trigger zz_boom before insert on audit.audit_events for each row execute function pg_temp.boom();
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b002'), 'plan_changed')$$, 'P0001', 'BOOM', 'a failing audit write fails the cancellation');
reset role;
drop trigger zz_boom on audit.audit_events;
select is(pg_temp.state(), '2/3/3/1', 'and the record is still there');

-- Cancellations ----------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.cancel_future_record('enrollment', pg_temp.id('00e2'), 'plan_changed')$$, 'a manager cancels the planned S2 enrolment');
select lives_ok($$select api.cancel_future_record('child_guardian', pg_temp.id('c002'), 'entered_in_error')$$, 'a manager cancels a planned link');
select lives_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b002'), 'other')$$, 'a manager cancels a planned authorization');
select throws_ok($$select api.cancel_future_record('pickup_authorization', pg_temp.id('b002'), 'other')$$, '42501', 'PERMISSION_DENIED', 'a cancelled record is gone (second call: unknown id)');
reset role;
select is(pg_temp.state(), '1/2/2/1', 'exactly the three planned records are gone');
-- Rule 6: everything else is unchanged.
select is((select upper(valid_during) - current_date from public.enrollments where id = pg_temp.id('00e1')), 10, 'the enrolment in effect keeps its period');
select is((select string_agg(id::text, ',' order by id) from public.child_guardians where child_id = pg_temp.uid('d1')),
  pg_temp.id('c001')::text || ',' || pg_temp.id('c003')::text, 'the other links remain, including the restricted one');
select ok(exists (select 1 from public.access_restrictions where child_guardian_id = pg_temp.id('c003')), 'the restriction is untouched');
select is((select string_agg(first_name, ',' order by first_name) from public.pickup_authorizations where child_id = pg_temp.uid('d1')), 'Mara,Tea', 'the other authorizations remain');
select pg_temp.login(pg_temp.uid('f1'));
select is((select count(*)::int from public.children where id = pg_temp.uid('d1')), 1, 'Ana''s access to Ivo is unchanged');
reset role;

-- Audit (rule 4) -----------------------------------------------------------------------------------------------
select is((select count(*)::int from audit.audit_events where action = 'record.cancel' and organization_id = 'd2700000-0000-4000-8000-00000000000a'
           and actor_id = pg_temp.uid('a1') and actor_role = 'org_admin' and occurred_at is not null), 3, 'each cancellation is audited with actor, role and time');
select is((select details ->> 'record_type' || ':' || (details ->> 'reason') || ':' || target_table from audit.audit_events where action = 'record.cancel' and target_id = pg_temp.id('00e2')),
  'enrollment:plan_changed:enrollments', 'the audit names the record id, type and reason code');
select ok(not exists (select 1 from audit.audit_events where action = 'record.cancel' and details::text ~ 'Ivo|Ana|Eva|Iva|Teta|S2'), 'no names in the audit');
select is((select count(*)::int from audit.audit_events where action = 'record.cancel' and outcome <> 'success'), 0, 'refused attempts leave no cancellation event');

-- Unblocks D2-E: with the planned enrolment gone, the transfer and withdrawal rules apply as before ----------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select api.withdraw_child(pg_temp.uid('d1'), current_date + 4)$$, 'withdrawal is possible once no future record starts after the last day');
reset role;
select is((select status::text from public.children where id = pg_temp.uid('d1')), 'withdrawn', 'withdrawal rules unchanged (D-35)');

select * from finish();
rollback;
