-- R-51: audit log aligned with SR-AUD-01/02 (migration 20261112084900_audit_schema_and_actor.sql).
-- Actor and role filled by the database, correlation id propagation, service attribution, append-only for every
-- API role, denied events, tenant isolation of reads. Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Fixtures ------------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('e5100000-0000-4000-8000-0000000000a1', 'aud-admin-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5100000-0000-4000-8000-0000000000a2', 'aud-ravnatelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5100000-0000-4000-8000-0000000000a3', 'aud-odgojitelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5100000-0000-4000-8000-0000000000b1', 'aud-admin-b@t.test', 'authenticated', 'authenticated', now()),
  ('e5100000-0000-4000-8000-0000000000c1', 'aud-platforma@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where id::text like 'e5100000-%';
insert into private.platform_admins (profile_id) values ('e5100000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('e5100000-0000-4000-8000-00000000000a', 'Test Audit A', 'test-audit-a'),
  ('e5100000-0000-4000-8000-00000000000b', 'Test Audit B', 'test-audit-b');
insert into public.memberships (organization_id, profile_id, role, valid_during) values
  ('e5100000-0000-4000-8000-00000000000a', 'e5100000-0000-4000-8000-0000000000a1', 'org_admin', daterange(current_date - 30, null)),
  ('e5100000-0000-4000-8000-00000000000a', 'e5100000-0000-4000-8000-0000000000a2', 'director', daterange(current_date - 30, null)),
  ('e5100000-0000-4000-8000-00000000000a', 'e5100000-0000-4000-8000-0000000000a3', 'educator', daterange(current_date - 30, null)),
  ('e5100000-0000-4000-8000-00000000000b', 'e5100000-0000-4000-8000-0000000000b1', 'org_admin', daterange(current_date - 30, null));

create function pg_temp.login(uid uuid, aal text default 'aal2', headers jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('request.headers', headers::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service(headers jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.headers', headers::text, true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.last_audit(p_target text) returns audit.audit_events language sql as $$
  select * from audit.audit_events where target_table = p_target order by id desc limit 1
$$;

-- Placement and privileges (SR-AUD-02) ------------------------------------------------------------------------
select has_table('audit', 'audit_events', 'the audit table lives in the non-exposed audit schema');
select is((select c.relkind::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'audit_events'),
  'v', 'public.audit_events is only a view');
select ok(not has_table_privilege('authenticated', 'audit.audit_events', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'authenticated cannot write the audit table');
select ok(not has_table_privilege('service_role', 'audit.audit_events', 'UPDATE,DELETE,TRUNCATE'), 'the service role cannot change or delete audit rows');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'authenticated cannot write through the view');
select ok(not has_table_privilege('service_role', 'public.audit_events', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'the service role cannot write through the view');
select ok(not has_schema_privilege('anon', 'audit', 'USAGE'), 'anon has no access to the audit schema');
select ok(not has_function_privilege('authenticated', 'api.record_audit_event(uuid, uuid, text, text, text, text)', 'EXECUTE'), 'clients cannot call record_audit_event');

-- Actor and role, filled by the database ---------------------------------------------------------------------
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1');
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt audit 1');
reset role;
select is((select actor_id::text || ' ' || actor_role from pg_temp.last_audit('facilities')),
  'e5100000-0000-4000-8000-0000000000a1 org_admin', 'org_admin action: actor and role recorded');
select pg_temp.login('e5100000-0000-4000-8000-0000000000a2');
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt audit 2');
reset role;
select is((select actor_role from pg_temp.last_audit('facilities')), 'director', 'director action: role director');
select set_config('request.jwt.claims', '', true); -- no session at all, as in a migration or scheduled job
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt audit 3');
select is((select coalesce(actor_id::text, 'null') || ' ' || actor_role from pg_temp.last_audit('facilities')),
  'null system', 'a system process (no session) is recorded as system, not as a person');
select pg_temp.login('e5100000-0000-4000-8000-0000000000c1');
update public.organizations set name = 'Test Audit A' where id = 'e5100000-0000-4000-8000-00000000000a';
reset role;
select is((select actor_role from pg_temp.last_audit('organizations')), null, 'a platform admin has no update right on a kindergarten (no row written)');
insert into audit.audit_events (organization_id, actor_id, action, target_table) values
  (null, 'e5100000-0000-4000-8000-0000000000c1', 'organization.config_viewed', 'organizations');
select is((select actor_role from pg_temp.last_audit('organizations')), 'platform_admin', 'a platform operator is recorded as platform_admin');
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1');
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt audit 4');
reset role;
select ok((select occurred_at is not null and details ? 'changed_columns' is false from pg_temp.last_audit('facilities')), 'insert row has a time and no content values');
select ok(not exists (select 1 from audit.audit_events where details::text ~ 'Objekt audit'), 'no content values (names) are copied into the audit');

-- correlation_id propagation ---------------------------------------------------------------------------------
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1', 'aal2', '{"x-correlation-id":"corr-0001-test"}');
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt corr');
reset role;
select is((select correlation_id from pg_temp.last_audit('facilities')), 'corr-0001-test', 'x-correlation-id header is stored');
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1', 'aal2', '{"x-correlation-id":"bad id <script>"}');
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt corr 2');
reset role;
select is((select correlation_id from pg_temp.last_audit('facilities')), null, 'a malformed correlation id is not stored');
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1', 'aal2', '{"x-correlation-id":"from-header-01"}');
select set_config('app.correlation_id', 'from-setting-01', true);
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000a', 'Objekt corr 3');
reset role;
select set_config('app.correlation_id', '', true);
select is((select correlation_id from pg_temp.last_audit('facilities')), 'from-setting-01', 'app.correlation_id takes precedence over the header');

-- Service attribution: x-actor-id is honoured only for the service role --------------------------------------
select pg_temp.as_service('{"x-actor-id":"e5100000-0000-4000-8000-0000000000a1","x-correlation-id":"svc-corr-0001"}');
select api.record_audit_event('e5100000-0000-4000-8000-00000000000a', null, 'invitation.create', 'invitations', 'denied', 'PERMISSION_DENIED');
reset role;
select is((select actor_id::text || ' ' || actor_role || ' ' || outcome || ' ' || (details ->> 'via') || ' ' || correlation_id from pg_temp.last_audit('invitations')),
  'e5100000-0000-4000-8000-0000000000a1 org_admin denied service svc-corr-0001', 'service write attributed to the person it acts for, marked via=service');
select pg_temp.login('e5100000-0000-4000-8000-0000000000b1', 'aal2', '{"x-actor-id":"e5100000-0000-4000-8000-0000000000a1"}');
insert into public.facilities (organization_id, name) values ('e5100000-0000-4000-8000-00000000000b', 'Objekt B');
reset role;
select is((select actor_id::text || ' ' || actor_role || ' ' || coalesce(details ->> 'via', '-') from pg_temp.last_audit('facilities')),
  'e5100000-0000-4000-8000-0000000000b1 org_admin -', 'a client cannot impersonate another actor with x-actor-id');
select pg_temp.as_service();
select api.record_audit_event('e5100000-0000-4000-8000-0000000000ff', 'e5100000-0000-4000-8000-0000000000b1', 'invitation.create', 'invitations', 'denied', 'PERMISSION_DENIED');
reset role;
select is((select coalesce(organization_id::text, 'null') || ' ' || actor_role from pg_temp.last_audit('invitations')),
  'null none', 'denied attempt against an unknown kindergarten is recorded without an organisation and without error');
select pg_temp.as_service();
select throws_ok($$select api.record_audit_event('e5100000-0000-4000-8000-00000000000a', null, 'Free text!', 'invitations', 'denied', 'x')$$,
  '22023', 'INVALID_ARGUMENTS', 'record_audit_event accepts only the allow-listed shape (no free text)');
select throws_ok($$select api.record_audit_event('e5100000-0000-4000-8000-00000000000a', null, 'invitation.create', 'invitations', 'success', 'OK_CODE')$$,
  '22023', 'INVALID_ARGUMENTS', 'record_audit_event records only denied or error outcomes');

-- Append-only for every API role (ST-AUD-03) -------------------------------------------------------------------
select throws_ok($$update public.audit_events set action = 'x'$$, '42501', null, 'service role cannot update through the view');
select throws_ok($$delete from public.audit_events$$, '42501', null, 'service role cannot delete through the view');
select throws_ok($$insert into public.audit_events (action, target_table) values ('x.y', 'x')$$, '42501', null, 'service role cannot insert through the view');
select throws_ok($$truncate audit.audit_events$$, '42501', null, 'service role cannot truncate the audit table');
reset role;
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1');
select throws_ok($$update public.audit_events set action = 'x'$$, '42501', null, 'a manager cannot update the audit');
select throws_ok($$delete from public.audit_events$$, '42501', null, 'a manager cannot delete the audit');
reset role;
select throws_ok($$update audit.audit_events set action = 'x' where organization_id = 'e5100000-0000-4000-8000-00000000000a'$$,
  '42501', 'AUDIT_APPEND_ONLY', 'even the owner role cannot rewrite audit rows');

-- Reads: own kindergarten only, educators nothing, roles visible to managers --------------------------------------
select pg_temp.login('e5100000-0000-4000-8000-0000000000a1');
select ok((select count(*) from public.audit_events where organization_id = 'e5100000-0000-4000-8000-00000000000a' and actor_role in ('org_admin', 'director', 'system')) >= 4,
  'A manager reads A audit rows with actor roles');
reset role;
select pg_temp.login('e5100000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.audit_events where organization_id = 'e5100000-0000-4000-8000-00000000000a'), 0, 'B manager reads no A audit rows');
reset role;
select pg_temp.login('e5100000-0000-4000-8000-0000000000a3', 'aal1');
select is((select count(*)::int from public.audit_events), 0, 'an educator reads no audit rows');
reset role;

select * from finish();
rollback;
