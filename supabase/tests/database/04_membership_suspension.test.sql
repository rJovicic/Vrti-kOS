-- R-48: a pending invitation can never undo a suspension (migration 20261112075500_suspension_blocks_invitations.sql).
-- Lifecycle: invite → suspend → old invitation revoked → acceptance keeps the suspension; plus the legitimate
-- paths (new member, ended member invited again, active member) and the tenant boundary. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Fixtures ------------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('e4800000-0000-4000-8000-0000000000a1', 's-admin-a@t.test', 'authenticated', 'authenticated', now()),
  ('e4800000-0000-4000-8000-0000000000b1', 's-admin-b@t.test', 'authenticated', 'authenticated', now()),
  ('e4800000-0000-4000-8000-0000000000e1', 's-suspendiran@t.test', 'authenticated', 'authenticated', now()),
  ('e4800000-0000-4000-8000-0000000000e2', 's-zavrsen@t.test', 'authenticated', 'authenticated', now()),
  ('e4800000-0000-4000-8000-0000000000e3', 's-aktivan@t.test', 'authenticated', 'authenticated', now()),
  ('e4800000-0000-4000-8000-0000000000e4', 's-novi@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name)
select id, 'Test', split_part(email, '@', 1) from auth.users where id::text like 'e4800000-%' and email <> 's-novi@t.test';

insert into public.organizations (id, name, slug) values
  ('e4800000-0000-4000-8000-00000000000a', 'Test Suspenzija A', 'test-susp-a'),
  ('e4800000-0000-4000-8000-00000000000b', 'Test Suspenzija B', 'test-susp-b');
insert into public.memberships (id, organization_id, profile_id, role, status, valid_during) values
  ('e4800000-0000-4000-8000-0000000001a1', 'e4800000-0000-4000-8000-00000000000a', 'e4800000-0000-4000-8000-0000000000a1', 'org_admin', 'active', daterange(current_date - 30, null)),
  ('e4800000-0000-4000-8000-0000000001b1', 'e4800000-0000-4000-8000-00000000000b', 'e4800000-0000-4000-8000-0000000000b1', 'org_admin', 'active', daterange(current_date - 30, null)),
  -- the person who will be suspended in A; also an active educator in B
  ('e4800000-0000-4000-8000-0000000001e1', 'e4800000-0000-4000-8000-00000000000a', 'e4800000-0000-4000-8000-0000000000e1', 'educator', 'active', daterange(current_date - 30, null)),
  ('e4800000-0000-4000-8000-0000000002e1', 'e4800000-0000-4000-8000-00000000000b', 'e4800000-0000-4000-8000-0000000000e1', 'educator', 'active', daterange(current_date - 30, null)),
  ('e4800000-0000-4000-8000-0000000001e2', 'e4800000-0000-4000-8000-00000000000a', 'e4800000-0000-4000-8000-0000000000e2', 'educator', 'ended', daterange(current_date - 300, current_date - 100)),
  ('e4800000-0000-4000-8000-0000000001e3', 'e4800000-0000-4000-8000-00000000000a', 'e4800000-0000-4000-8000-0000000000e3', 'educator', 'active', daterange(current_date - 30, null));

create function pg_temp.login(uid uuid, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Catalog -------------------------------------------------------------------------------------------------
select has_trigger('public', 'memberships', 'memberships_suspension_revokes_invitations', 'memberships has the suspension trigger');
select ok(not has_function_privilege('anon', 'private.has_suspended_membership(uuid, text, public.org_role)', 'EXECUTE'), 'anon may not call the suspension lookup');
select ok(not has_function_privilege('authenticated', 'private.revoke_invitations_on_suspension()', 'EXECUTE'), 'the revoke trigger function is not callable by clients');

-- Pending invitations while the member is still active ------------------------------------------------------
select pg_temp.login('e4800000-0000-4000-8000-0000000000a1');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator', 'Sus', 'Pendiran')$$, 'A: pending educator invitation for the member (e.g. resent)');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'guardian', 'Sus', 'Pendiran')$$, 'A: pending guardian invitation for the same person (different role)');
reset role;
select pg_temp.login('e4800000-0000-4000-8000-0000000000b1');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000b', 's-suspendiran@t.test', 'educator', 'Sus', 'Pendiran')$$, 'B: pending educator invitation for the same person');
reset role;

-- Suspension revokes the matching pending invitation ---------------------------------------------------------
select pg_temp.login('e4800000-0000-4000-8000-0000000000a1');
select lives_ok($$update public.memberships set status = 'suspended' where id = 'e4800000-0000-4000-8000-0000000001e1'$$, 'A: manager suspends the educator');
select is((select status::text from public.invitations where organization_id = 'e4800000-0000-4000-8000-00000000000a' and email = 's-suspendiran@t.test' and role = 'educator'),
  'revoked', 'suspension revokes the pending invitation for the same kindergarten and role');
select is((select revoked_by from public.invitations where organization_id = 'e4800000-0000-4000-8000-00000000000a' and email = 's-suspendiran@t.test' and role = 'educator'),
  'e4800000-0000-4000-8000-0000000000a1'::uuid, 'the revocation is attributed to the suspending manager');
select is((select status::text from public.invitations where organization_id = 'e4800000-0000-4000-8000-00000000000a' and email = 's-suspendiran@t.test' and role = 'guardian'),
  'pending', 'an invitation for another role is not touched (suspension is per membership)');

-- A manager cannot invite the suspended person back into the suspended role ----------------------------------
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator', 'Sus', 'Pendiran')$$,
  'P0001', 'MEMBERSHIP_SUSPENDED', 'a new invitation cannot lift a suspension');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 'S-Suspendiran@T.test', 'educator', 'Sus', 'Pendiran')$$,
  'P0001', 'MEMBERSHIP_SUSPENDED', 'the check ignores e-mail letter case');
select is(private.has_suspended_membership('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator'), true,
  'the suspension lookup answers for the kindergarten the caller manages');
reset role;
select pg_temp.login('e4800000-0000-4000-8000-0000000000a1', 'aal1');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator', 'Sus', 'Pendiran')$$,
  '42501', 'PERMISSION_DENIED', 'without AAL2 the caller gets permission_denied, not the suspension state');
reset role;
select pg_temp.login('e4800000-0000-4000-8000-0000000000b1');
select throws_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator', 'Sus', 'Pendiran')$$,
  '42501', 'PERMISSION_DENIED', 'another kindergarten''s manager learns nothing about the suspension (no cross-tenant oracle)');
select is((select status::text from public.invitations where organization_id = 'e4800000-0000-4000-8000-00000000000b' and email = 's-suspendiran@t.test'),
  'pending', 'suspension in A does not revoke invitations in B');
select is(private.has_suspended_membership('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator'), false,
  'the suspension lookup answers false for a kindergarten the caller does not manage');
reset role;

-- Defensive path: a pending invitation that exists despite the suspension (e.g. created before this migration)
insert into public.invitations (organization_id, email, role, first_name, last_name, created_by) values
  ('e4800000-0000-4000-8000-00000000000a', 's-suspendiran@t.test', 'educator', 'Sus', 'Pendiran', 'e4800000-0000-4000-8000-0000000000a1');

set local role service_role;
select results_eq($$select organization_id::text || ':' || role::text from api.accept_invitations('e4800000-0000-4000-8000-0000000000e1', 's-suspendiran@t.test') order by 1$$,
  array['e4800000-0000-4000-8000-00000000000a:guardian', 'e4800000-0000-4000-8000-00000000000b:educator'],
  'acceptance returns only the legitimate invitations, never the suspended role');
reset role;
select is((select status::text from public.memberships where id = 'e4800000-0000-4000-8000-0000000001e1'), 'suspended', 'the suspended membership stays suspended after sign-in');
select is((select count(*)::int from public.invitations where organization_id = 'e4800000-0000-4000-8000-00000000000a' and email = 's-suspendiran@t.test' and role = 'educator' and status = 'pending'),
  0, 'the stale invitation is consumed (no pending invitation is left to retry)');
select ok(exists (select 1 from public.audit_events where action = 'invitation.accept_refused' and outcome = 'denied'
  and actor_id = 'e4800000-0000-4000-8000-0000000000e1' and details ->> 'reason' = 'membership_suspended'), 'the refused acceptance is audited as denied');
select ok(not exists (select 1 from public.audit_events where action = 'invitation.accept_refused' and details::text like '%@%'), 'the audit row holds no e-mail address');
select is((select status::text from public.memberships where id = 'e4800000-0000-4000-8000-0000000002e1'), 'active', 'the membership in B is unaffected');

set local role service_role;
select is_empty($$select * from api.accept_invitations('e4800000-0000-4000-8000-0000000000e1', 's-suspendiran@t.test')$$, 'a repeated acceptance changes nothing (idempotent)');
reset role;
select is((select count(*)::int from public.memberships where profile_id = 'e4800000-0000-4000-8000-0000000000e1'), 3,
  'after repeated acceptance: suspended educator A, active educator B, new guardian A, nothing else');
select is((select status::text from public.memberships where id = 'e4800000-0000-4000-8000-0000000001e1'), 'suspended', 'still suspended after the repeated acceptance');

-- Legitimate paths keep working --------------------------------------------------------------------------------
select pg_temp.login('e4800000-0000-4000-8000-0000000000a1');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-zavrsen@t.test', 'educator', 'Za', 'Vrsen')$$, 'a person whose membership ended may be invited again');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-aktivan@t.test', 'educator', 'Ak', 'Tivan')$$, 'an active member may receive an invitation');
select lives_ok($$insert into public.invitations (organization_id, email, role, first_name, last_name) values ('e4800000-0000-4000-8000-00000000000a', 's-novi@t.test', 'educator', 'No', 'Vi')$$, 'a new person may be invited');
reset role;

set local role service_role;
select results_eq($$select role::text from api.accept_invitations('e4800000-0000-4000-8000-0000000000e2', 's-zavrsen@t.test')
  union all select role::text from api.accept_invitations('e4800000-0000-4000-8000-0000000000e3', 's-aktivan@t.test')
  union all select role::text from api.accept_invitations('e4800000-0000-4000-8000-0000000000e4', 's-novi@t.test')$$,
  array['educator', 'educator', 'educator'], 'ended, active and new people accept their invitations');
reset role;
select is((select status::text || ' ' || lower(valid_during)::text from public.memberships where id = 'e4800000-0000-4000-8000-0000000001e2'),
  'active ' || current_date::text, 'an ended membership is re-activated from today');
select is((select lower(valid_during) from public.memberships where id = 'e4800000-0000-4000-8000-0000000001e3'),
  current_date - 30, 'an active membership is left unchanged (start date kept)');
select is((select status::text from public.memberships where profile_id = 'e4800000-0000-4000-8000-0000000000e4'), 'active', 'a new person gets an active membership');

-- Reactivation by a manager remains the way back ------------------------------------------------------------------
select pg_temp.login('e4800000-0000-4000-8000-0000000000a1');
select lives_ok($$update public.memberships set status = 'active' where id = 'e4800000-0000-4000-8000-0000000001e1'$$, 'the manager re-activates the suspended educator');
reset role;

select * from finish();
rollback;
