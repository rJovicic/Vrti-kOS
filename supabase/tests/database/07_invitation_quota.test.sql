-- R-50: per-kindergarten invitation limit (migration 20261112085000_invitation_quota.sql). The limit is lowered to 3
-- for the test kindergarten. Parallel requests are covered by tests/integration/src/invitation-limit.test.ts.
-- Synthetic fixtures, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('e5000000-0000-4000-8000-0000000000a1', 'lim-admin-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5000000-0000-4000-8000-0000000000a2', 'lim-ravnatelj-a@t.test', 'authenticated', 'authenticated', now()),
  ('e5000000-0000-4000-8000-0000000000b1', 'lim-admin-b@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where id::text like 'e5000000-%';
insert into public.organizations (id, name, slug, invitation_limit_per_hour) values
  ('e5000000-0000-4000-8000-00000000000a', 'Test Limit A', 'test-limit-a', 3),
  ('e5000000-0000-4000-8000-00000000000b', 'Test Limit B', 'test-limit-b', 3);
insert into public.memberships (organization_id, profile_id, role, valid_during) values
  ('e5000000-0000-4000-8000-00000000000a', 'e5000000-0000-4000-8000-0000000000a1', 'org_admin', daterange(current_date - 30, null)),
  ('e5000000-0000-4000-8000-00000000000a', 'e5000000-0000-4000-8000-0000000000a2', 'director', daterange(current_date - 30, null)),
  ('e5000000-0000-4000-8000-00000000000b', 'e5000000-0000-4000-8000-0000000000b1', 'org_admin', daterange(current_date - 30, null));
-- Old invitations (created two hours ago) fill the quota of a past window and must not count now.
insert into public.invitations (organization_id, email, role, first_name, last_name, created_by, created_at, expires_at)
select 'e5000000-0000-4000-8000-00000000000a', 'staro' || g || '@t.test', 'guardian', 'S', 'Taro', 'e5000000-0000-4000-8000-0000000000a1',
       now() - interval '2 hours', now() + interval '5 days'
from generate_series(1, 5) g;

create function pg_temp.login(uid uuid, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.invite(org uuid, addr text) returns setof uuid language sql as $$
  insert into public.invitations (organization_id, email, role, first_name, last_name)
  values (org, addr, 'guardian', 'Ra', 'Ta') returning id
$$;
grant execute on function pg_temp.invite(uuid, text) to authenticated;

select has_column('public', 'organizations', 'invitation_limit_per_hour', 'the limit is a per-kindergarten setting');

-- Within the limit ----------------------------------------------------------------------------------------------
select pg_temp.login('e5000000-0000-4000-8000-0000000000a1');
select isnt_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'n1@t.test')$$, 'invitation 1 of 3 (older invitations do not count)');
select isnt_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'n2@t.test')$$, 'invitation 2 of 3');
select lives_ok($$update public.invitations set status = 'revoked' where email = 'n2@t.test'$$, 'revoking one does not free quota');
reset role;
select pg_temp.login('e5000000-0000-4000-8000-0000000000a2');
select isnt_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'n3@t.test')$$, 'invitation 3 of 3 by the director (shared kindergarten quota)');

-- Over the limit: not created, audited as denied -----------------------------------------------------------------------
select is_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'n4@t.test')$$, 'invitation 4 is not created (limit reached)');
reset role;
select pg_temp.login('e5000000-0000-4000-8000-0000000000a1');
select is_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'n5@t.test')$$, 'the org_admin is limited too');
reset role;
select is((select count(*)::int from public.invitations where organization_id = 'e5000000-0000-4000-8000-00000000000a' and created_at > now() - interval '1 hour'),
  3, 'exactly the limit was created in the window');
select is((select count(*)::int from audit.audit_events where organization_id = 'e5000000-0000-4000-8000-00000000000a' and action = 'invitation.limit_reached' and outcome = 'denied'),
  2, 'each refused attempt is audited as denied');
select is((select string_agg(distinct actor_role, ',' order by actor_role) from audit.audit_events where action = 'invitation.limit_reached'),
  'director,org_admin', 'the audit row names the actor role');
select ok(not exists (select 1 from audit.audit_events where action = 'invitation.limit_reached' and details::text ~ '@'),
  'the audit row holds no e-mail address');
select is((select details ->> 'reason' from audit.audit_events where action = 'invitation.limit_reached' limit 1), 'INVITATION_LIMIT_REACHED', 'stable reason code');

-- Other paths and kindergartens --------------------------------------------------------------------------------------
set local role service_role;
select is_empty($$insert into public.invitations (organization_id, email, role, first_name, last_name, created_by)
  values ('e5000000-0000-4000-8000-00000000000a', 'servis@t.test', 'guardian', 'Se', 'Rvis', 'e5000000-0000-4000-8000-0000000000a1') returning id$$,
  'the service key cannot bypass the limit');
reset role;
select pg_temp.login('e5000000-0000-4000-8000-0000000000b1');
select isnt_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000b', 'b1@t.test')$$, 'another kindergarten has its own quota');
select throws_ok($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'uljez@t.test')$$, '42501', 'PERMISSION_DENIED',
  'a foreign manager gets permission_denied, not the limit state of A');
select is((select count(*)::int from audit.audit_events where action = 'invitation.limit_reached' and actor_id = 'e5000000-0000-4000-8000-0000000000b1'),
  0, 'an unauthorized attempt never reaches the limit check');
select throws_ok($$update public.organizations set invitation_limit_per_hour = 1000 where id = 'e5000000-0000-4000-8000-00000000000b'$$, '42501', null,
  'a manager cannot raise the limit');
reset role;
select pg_temp.login('e5000000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'aal1@t.test')$$, '42501', 'PERMISSION_DENIED', 'without AAL2: permission_denied first');
reset role;
select throws_ok($$update public.organizations set invitation_limit_per_hour = 0 where id = 'e5000000-0000-4000-8000-00000000000a'$$, '23514', null,
  'the limit cannot be set below 1');
update public.organizations set invitation_limit_per_hour = 4 where id = 'e5000000-0000-4000-8000-00000000000a';
select pg_temp.login('e5000000-0000-4000-8000-0000000000a1');
select isnt_empty($$select pg_temp.invite('e5000000-0000-4000-8000-00000000000a', 'n6@t.test')$$, 'an operator can raise the limit for one kindergarten');
reset role;

select * from finish();
rollback;
