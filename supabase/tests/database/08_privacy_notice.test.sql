-- FR-01-5 / AC-01-5: privacy notices (migration 20261112093000_privacy_notices.sql). Read only by members of that
-- kindergarten, immutable versions, published version must exist, acknowledgement only of the published version with
-- a database timestamp, never on behalf of someone else. Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('e0100000-0000-4000-8000-0000000000a1', 'pn-admin-a@t.test', 'authenticated', 'authenticated', now()),
  ('e0100000-0000-4000-8000-0000000000a2', 'pn-roditelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('e0100000-0000-4000-8000-0000000000a3', 'pn-suspendiran-a@t.test', 'authenticated', 'authenticated', now()),
  ('e0100000-0000-4000-8000-0000000000b1', 'pn-roditelj-b@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where id::text like 'e0100000-%';
insert into public.organizations (id, name, slug) values
  ('e0100000-0000-4000-8000-00000000000a', 'Test Obavijest A', 'test-pn-a'),
  ('e0100000-0000-4000-8000-00000000000b', 'Test Obavijest B', 'test-pn-b');
insert into public.memberships (id, organization_id, profile_id, role, status, valid_during) values
  ('e0100000-0000-4000-8000-0000000001a1', 'e0100000-0000-4000-8000-00000000000a', 'e0100000-0000-4000-8000-0000000000a1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('e0100000-0000-4000-8000-0000000001a2', 'e0100000-0000-4000-8000-00000000000a', 'e0100000-0000-4000-8000-0000000000a2', 'guardian', 'active', daterange(current_date - 30, null)),
  ('e0100000-0000-4000-8000-0000000001a3', 'e0100000-0000-4000-8000-00000000000a', 'e0100000-0000-4000-8000-0000000000a3', 'educator', 'suspended', daterange(current_date - 30, null)),
  ('e0100000-0000-4000-8000-0000000001b1', 'e0100000-0000-4000-8000-00000000000b', 'e0100000-0000-4000-8000-0000000000b1', 'guardian', 'active', daterange(current_date - 30, null));
insert into public.privacy_notices (organization_id, version, title, body, is_demo) values
  ('e0100000-0000-4000-8000-00000000000a', '2026-1', 'Obavijest A (test)', 'Sintetički tekst A, verzija 1.', true),
  ('e0100000-0000-4000-8000-00000000000a', '2026-2', 'Obavijest A (test)', 'Sintetički tekst A, verzija 2.', true),
  ('e0100000-0000-4000-8000-00000000000b', '2026-1', 'Obavijest B (test)', 'Sintetički tekst B.', true);
update public.organizations set privacy_notice_version = '2026-1' where id = 'e0100000-0000-4000-8000-00000000000a';

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Catalog and grants --------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.privacy_notices'::regclass), 'RLS is enabled on privacy_notices');
select ok(not has_table_privilege('authenticated', 'public.privacy_notices', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients cannot write notices');
select ok(not has_table_privilege('anon', 'public.privacy_notices', 'SELECT'), 'anon cannot read notices');
select ok(exists (select 1 from audit.audit_events where target_table = 'privacy_notices' and action = 'privacy_notices.insert'
  and organization_id = 'e0100000-0000-4000-8000-00000000000a'), 'publishing a notice version is audited');

-- Reads ----------------------------------------------------------------------------------------------------------------
select pg_temp.login('e0100000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.privacy_notices where organization_id = 'e0100000-0000-4000-8000-00000000000a'), 2, 'an A guardian reads A notices (all versions)');
select is((select count(*)::int from public.privacy_notices where organization_id = 'e0100000-0000-4000-8000-00000000000b'), 0, 'an A guardian reads no B notice');
select throws_ok($$insert into public.privacy_notices (organization_id, version, title, body) values ('e0100000-0000-4000-8000-00000000000a', 'x', 'X', 'X')$$, '42501', null, 'a member cannot publish a notice');
select throws_ok($$update public.privacy_notices set body = 'promijenjeno' where organization_id = 'e0100000-0000-4000-8000-00000000000a'$$, '42501', null, 'a member cannot change a notice (no grant)');
reset role;
select pg_temp.login('e0100000-0000-4000-8000-0000000000b1');
select is((select count(*)::int from public.privacy_notices where organization_id = 'e0100000-0000-4000-8000-00000000000a'), 0, 'a B guardian reads no A notice (cross-tenant)');
reset role;
select pg_temp.login('e0100000-0000-4000-8000-0000000000a3');
select is((select count(*)::int from public.privacy_notices), 0, 'a suspended member reads no notice');
reset role;
select pg_temp.login('e0100000-0000-4000-8000-0000000000a1', 'aal2');
select is((select count(*)::int from public.privacy_notices where organization_id = 'e0100000-0000-4000-8000-00000000000a'), 2, 'an A manager reads A notices');
select throws_ok($$delete from public.privacy_notices where organization_id = 'e0100000-0000-4000-8000-00000000000a'$$, '42501', null, 'a manager cannot delete a notice');

-- Publishing: only a version of the kindergarten's own notices ---------------------------------------------------------
select throws_ok($$update public.organizations set privacy_notice_version = 'ne-postoji' where id = 'e0100000-0000-4000-8000-00000000000a'$$, '23503', null,
  'a kindergarten cannot publish a version that does not exist');
reset role;
select throws_ok($$update public.privacy_notices set body = 'tiho promijenjeno' where organization_id = 'e0100000-0000-4000-8000-00000000000a' and version = '2026-1'$$,
  '42501', 'PRIVACY_NOTICE_IMMUTABLE', 'a published text cannot be changed, not even by the owner role');
select throws_ok($$delete from public.privacy_notices where organization_id = 'e0100000-0000-4000-8000-00000000000a' and version = '2026-1'$$,
  '23503', null, 'the published version cannot be deleted');
select throws_ok($$update public.organizations set privacy_notice_version = '2026-2' where id = 'e0100000-0000-4000-8000-00000000000b'$$,
  '23503', null, 'a kindergarten cannot publish another kindergarten''s notice version');

-- Acknowledgement ------------------------------------------------------------------------------------------------------
select pg_temp.login('e0100000-0000-4000-8000-0000000000a2');
select throws_ok($$update public.memberships set notice_ack_version = '2026-2' where id = 'e0100000-0000-4000-8000-0000000001a2'$$,
  '22023', 'NOTICE_VERSION_MISMATCH', 'only the currently published version can be acknowledged');
select throws_ok($$update public.memberships set notice_ack_version = 'izmisljeno' where id = 'e0100000-0000-4000-8000-0000000001a2'$$,
  '22023', 'NOTICE_VERSION_MISMATCH', 'an invented version cannot be acknowledged');
select lives_ok($$update public.memberships set notice_ack_version = '2026-1', notice_ack_at = '2000-01-01' where id = 'e0100000-0000-4000-8000-0000000001a2'$$,
  'the guardian acknowledges the published version');
select throws_ok($$update public.memberships set notice_ack_version = null where id = 'e0100000-0000-4000-8000-0000000001a2'$$,
  '22023', 'NOTICE_VERSION_MISMATCH', 'an acknowledgement cannot be withdrawn to a blank state by the client');
reset role;
select is((select notice_ack_version || ' ' || (notice_ack_at > now() - interval '1 minute')::text from public.memberships where id = 'e0100000-0000-4000-8000-0000000001a2'),
  '2026-1 true', 'version stored, time set by the database (client time ignored)');
select ok(exists (select 1 from audit.audit_events where target_table = 'memberships' and target_id = 'e0100000-0000-4000-8000-0000000001a2'
  and details -> 'changed_columns' ? 'notice_ack_version'), 'the acknowledgement is audited (column names only)');
select pg_temp.login('e0100000-0000-4000-8000-0000000000a1', 'aal2');
select throws_ok($$update public.memberships set notice_ack_version = '2026-1' where id = 'e0100000-0000-4000-8000-0000000001a3'$$,
  '42501', 'MEMBERSHIP_ACK_IS_PERSONAL', 'a manager cannot acknowledge on behalf of someone else');
reset role;
select pg_temp.login('e0100000-0000-4000-8000-0000000000b1');
select throws_ok($$update public.memberships set notice_ack_version = '2026-1' where id = 'e0100000-0000-4000-8000-0000000001b1'$$,
  '22023', 'NOTICE_VERSION_MISMATCH', 'a kindergarten without a published notice has nothing to acknowledge');
reset role;

-- A new version makes earlier acknowledgements outdated ---------------------------------------------------------------------
update public.organizations set privacy_notice_version = '2026-2' where id = 'e0100000-0000-4000-8000-00000000000a';
select isnt((select notice_ack_version from public.memberships where id = 'e0100000-0000-4000-8000-0000000001a2'),
  (select privacy_notice_version from public.organizations where id = 'e0100000-0000-4000-8000-00000000000a'), 'after a new version the old acknowledgement no longer matches (app asks again)');
select pg_temp.login('e0100000-0000-4000-8000-0000000000a2');
select lives_ok($$update public.memberships set notice_ack_version = '2026-2' where id = 'e0100000-0000-4000-8000-0000000001a2'$$, 'the new version can be acknowledged');
reset role;

select * from finish();
rollback;
