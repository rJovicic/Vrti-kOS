-- Retention guards (docs/security/data-retention.md, R-53). No retention or erasure job exists yet (rules are an open
-- controller/DPO decision, Q-P09); these checks prove that nothing today can destroy records that may have to be kept:
-- clients cannot delete, deletion of a person, child or kindergarten with records is refused by the database, and no
-- cascade reaches a record. An unused Auth account without a profile (unaccepted invitation, R-43) can be removed.
-- Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- 1. Clients (anon, authenticated) have no DELETE or TRUNCATE privilege on any application table.
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r(role)
   where n.nspname in ('public', 'audit', 'private') and c.relkind in ('r', 'p')
     and (has_table_privilege(r.role, c.oid, 'DELETE') or has_table_privilege(r.role, c.oid, 'TRUNCATE'))),
  0::bigint, 'no client role may DELETE or TRUNCATE any application table');

-- 2. Only device-bound settings cascade when a person's profile goes; every record that names a person, child,
--    guardian or kindergarten is RESTRICT (a future cascade would fail this check).
select is(
  (select array_agg(conrelid::regclass::text || '.' || a.attname order by 1)
   from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.contype = 'f' and c.confdeltype in ('c', 'n', 'd')
     and c.confrelid in ('public.profiles'::regclass, 'public.children'::regclass, 'public.guardians'::regclass, 'public.organizations'::regclass)),
  array['notification_preferences.profile_id', 'push_tokens.profile_id'],
  'only notification preferences and push tokens cascade; all records are RESTRICT');
select is((select confdeltype::text from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass),
  'r', 'profiles → auth.users is RESTRICT: an Auth account with a profile cannot be deleted directly');

-- Fixtures: one kindergarten, one person with a profile and a recorded arrival, one child.
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('d5350000-0000-4000-8000-0000000000a1', 'ret-a1@t.test', 'authenticated', 'authenticated', now()),
  ('d5350000-0000-4000-8000-0000000000b1', 'ret-b1@t.test', 'authenticated', 'authenticated', now());
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), 'd5350000-0000-4000-8000-0000000000b1', 'd5350000-0000-4000-8000-0000000000b1', 'email',
        '{"sub":"d5350000-0000-4000-8000-0000000000b1","email":"ret-b1@t.test"}', now(), now());
insert into public.profiles (id, first_name, last_name) values ('d5350000-0000-4000-8000-0000000000a1', 'Racun', 'Ret');
insert into public.organizations (id, name, slug) values ('d5350000-0000-4000-8000-00000000000a', 'Test Ret', 'test-ret');
insert into public.memberships (organization_id, profile_id, role, valid_during)
values ('d5350000-0000-4000-8000-00000000000a', 'd5350000-0000-4000-8000-0000000000a1', 'educator', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name, created_by)
values ('d5350000-0000-4000-8000-0000000000d1', 'd5350000-0000-4000-8000-00000000000a', 'Dijete', 'Ret', null);
insert into public.attendance_records (organization_id, child_id, kind, occurred_at, local_date, recorded_by, source, idempotency_key)
values ('d5350000-0000-4000-8000-00000000000a', 'd5350000-0000-4000-8000-0000000000d1', 'check_in', now(), current_date,
        'd5350000-0000-4000-8000-0000000000a1', 'app', gen_random_uuid());

-- 3. Deleting identities or records that other records depend on is refused (even for the database owner session).
select throws_ok($$delete from auth.users where id = 'd5350000-0000-4000-8000-0000000000a1'$$, '23503', null,
  'deleting the Auth account of a person with records is refused (profile RESTRICT)');
select throws_ok($$delete from public.profiles where id = 'd5350000-0000-4000-8000-0000000000a1'$$, '23503', null,
  'deleting the profile of a person who recorded an arrival is refused');
select throws_ok($$delete from public.children where id = 'd5350000-0000-4000-8000-0000000000d1'$$, '23503', null,
  'deleting a child with attendance records is refused');
select throws_ok($$delete from public.organizations where id = 'd5350000-0000-4000-8000-00000000000a'$$, '23503', null,
  'deleting a kindergarten with records is refused');

-- 4. An Auth account without a profile (e.g. created by an invitation that was never accepted) can be removed;
--    its identity goes with it.
select lives_ok($$delete from auth.users where id = 'd5350000-0000-4000-8000-0000000000b1'$$, 'an unused account without a profile can be deleted');

-- 5. realtime.messages (Supabase-internal, platform retention) has no link to application tables: erasure in the
--    application never reaches it, and it never blocks one.
select is((select count(*) from pg_constraint where contype = 'f' and (conrelid = 'realtime.messages'::regclass or confrelid = 'realtime.messages'::regclass)),
  0::bigint, 'realtime.messages has no foreign keys to or from application tables');

select * from finish();
rollback;
