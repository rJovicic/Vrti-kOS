-- D2-F: guardian invitation and acceptance link (migration 20261112150000_guardian_invitations.sql). FR-01-1,
-- d2-plan §5/§7: the invitation names a guardian record of the same kindergarten; acceptance attaches the account to
-- it, which gives exactly the linked children; an ended or already attached record is refused (audited); R-48 and R-50
-- are unchanged. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d2f00000-0000-4000-8000-0000000000' || x)::uuid, 'gi-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'd1', 'b1', 'f1', 'f2', 'f3', 'f4']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd2f00000-%' and email not in ('gi-f1@t.test', 'gi-f2@t.test', 'gi-f3@t.test');
insert into public.organizations (id, name, slug) values
  ('d2f00000-0000-4000-8000-00000000000a', 'Test Pozivnica A', 'test-gi-a'),
  ('d2f00000-0000-4000-8000-00000000000b', 'Test Pozivnica B', 'test-gi-b');
insert into public.memberships (organization_id, profile_id, role, valid_during)
select ('d2f00000-0000-4000-8000-00000000000' || o)::uuid, ('d2f00000-0000-4000-8000-0000000000' || x)::uuid, r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('d1', 'a', 'director'), ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.children (id, organization_id, first_name, last_name, created_by) values
  ('d2f00000-0000-4000-8000-0000000000c1', 'd2f00000-0000-4000-8000-00000000000a', 'Lea', 'Test', null),
  ('d2f00000-0000-4000-8000-0000000000c2', 'd2f00000-0000-4000-8000-00000000000a', 'Mia', 'Test', null);
-- Guardian records: Ana (free, linked to Lea), Bruno (free), Cvita (ended), Dora (already attached to f4), Beta (in B).
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, status, created_by) values
  ('d2f00000-0000-4000-8000-000000000a01', 'd2f00000-0000-4000-8000-00000000000a', null, 'Ana', 'Skrbnik', 'active', null),
  ('d2f00000-0000-4000-8000-000000000a02', 'd2f00000-0000-4000-8000-00000000000a', null, 'Bruno', 'Skrbnik', 'active', null),
  ('d2f00000-0000-4000-8000-000000000a03', 'd2f00000-0000-4000-8000-00000000000a', null, 'Cvita', 'Skrbnik', 'ended', null),
  ('d2f00000-0000-4000-8000-000000000a04', 'd2f00000-0000-4000-8000-00000000000a', 'd2f00000-0000-4000-8000-0000000000f4', 'Dora', 'Skrbnik', 'active', null),
  ('d2f00000-0000-4000-8000-000000000b01', 'd2f00000-0000-4000-8000-00000000000b', null, 'Beta', 'Skrbnik', 'active', null);
insert into public.child_guardians (organization_id, child_id, guardian_id, can_view, valid_during, created_by) values
  ('d2f00000-0000-4000-8000-00000000000a', 'd2f00000-0000-4000-8000-0000000000c1', 'd2f00000-0000-4000-8000-000000000a01', true, daterange(current_date - 1, null), null),
  ('d2f00000-0000-4000-8000-00000000000a', 'd2f00000-0000-4000-8000-0000000000c2', 'd2f00000-0000-4000-8000-000000000a02', true, daterange(current_date - 1, null), null);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.uid(x text) returns uuid language sql as $$ select ('d2f00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.g(x text) returns uuid language sql as $$ select ('d2f00000-0000-4000-8000-000000000' || x)::uuid $$;
grant execute on function pg_temp.g(text) to authenticated, service_role;
grant execute on function pg_temp.uid(text) to authenticated, service_role;
create function pg_temp.invite(mail text, guardian uuid, r text default 'guardian', org text default 'a') returns void language sql as $$
  insert into public.invitations (organization_id, email, role, first_name, last_name, guardian_id)
  values (('d2f00000-0000-4000-8000-00000000000' || org)::uuid, mail, r::public.org_role, 'Pozvani', 'Skrbnik', guardian)
$$;
grant execute on function pg_temp.invite(text, uuid, text, text) to authenticated;

-- Catalog -------------------------------------------------------------------------------------------------------
select ok(has_column_privilege('authenticated', 'public.invitations', 'guardian_id', 'INSERT'), 'managers can name a guardian record');
select ok(not has_column_privilege('authenticated', 'public.invitations', 'guardian_id', 'UPDATE'), 'the named record cannot be changed afterwards');
select ok(not has_column_privilege('authenticated', 'public.guardians', 'profile_id', 'SELECT')
  and not has_column_privilege('authenticated', 'public.guardians', 'profile_id', 'UPDATE'), 'no client reads or sets the account of a guardian record (D-31)');

-- Invitation time -------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select lives_ok($$select pg_temp.invite('gi-f1@t.test', pg_temp.g('a01'))$$, 'a manager invites Ana with her guardian record');
select lives_ok($$select pg_temp.invite('gi-f2@t.test', pg_temp.g('a02'))$$, 'and Bruno with his');
select throws_ok($$select pg_temp.invite('gi-f3@t.test', pg_temp.g('a03'))$$, 'P0001', 'GUARDIAN_ALREADY_LINKED', 'an ended guardian record cannot be invited');
select throws_ok($$select pg_temp.invite('gi-x@t.test', pg_temp.g('a04'))$$, 'P0001', 'GUARDIAN_ALREADY_LINKED', 'a record already attached to an account cannot be invited');
select throws_ok($$select pg_temp.invite('gi-y@t.test', pg_temp.g('b01'))$$, '23503', null, 'a guardian record of another kindergarten cannot be named (composite FK)');
select throws_ok($$select pg_temp.invite('gi-z@t.test', pg_temp.g('a02'), 'educator')$$, '23514', null, 'a guardian record only goes with the guardian role');
select lives_ok($$select pg_temp.invite('gi-plain@t.test', null)$$, 'a guardian invitation without a record still works (D1 behaviour)');
reset role;
select pg_temp.login(pg_temp.uid('b1'), 'aal2');
select throws_ok($$select pg_temp.invite('gi-q@t.test', pg_temp.g('a01'))$$, '42501', 'PERMISSION_DENIED', 'another kindergarten''s manager gets PERMISSION_DENIED first');
reset role;
select pg_temp.login(pg_temp.uid('a1'), 'aal1');
select throws_ok($$select pg_temp.invite('gi-r@t.test', pg_temp.g('a02'))$$, '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot invite');
reset role;
select pg_temp.login(pg_temp.uid('d1'), 'aal2');
select lives_ok($$select pg_temp.invite('gi-f3@t.test', pg_temp.g('a02'))$$, 'a director may invite a guardian (Bruno''s record, second address)');
reset role;

-- Before acceptance the account sees nothing -------------------------------------------------------------------
select pg_temp.login(pg_temp.uid('f1'));
select is((select count(*)::int from public.children), 0, 'Ana sees no child before accepting');
reset role;

-- Acceptance (as the Edge Function's service role) ---------------------------------------------------------------
set local role service_role;
select results_eq($$select role::text from api.accept_invitations(pg_temp.uid('f1'), 'gi-f1@t.test')$$, array['guardian'], 'Ana accepts');
reset role;
select is((select profile_id from public.guardians where id = pg_temp.g('a01')), pg_temp.uid('f1'), 'her account is attached to her guardian record');
select ok(exists (select 1 from audit.audit_events where action = 'guardian.account_linked' and target_id = pg_temp.g('a01') and actor_id = pg_temp.uid('f1')), 'the attachment is audited');
select pg_temp.login(pg_temp.uid('f1'));
select is((select string_agg(first_name, ',') from public.children), 'Lea', 'Ana now sees exactly the linked child');
select is((select count(*)::int from public.guardians), 1, 'and only her own guardian record');
reset role;

-- Two addresses invited for Bruno's record: the first attaches, the second is refused and audited.
set local role service_role;
select results_eq($$select role::text from api.accept_invitations(pg_temp.uid('f2'), 'gi-f2@t.test')$$, array['guardian'], 'Bruno accepts');
select results_eq($$select role::text from api.accept_invitations(pg_temp.uid('f3'), 'gi-f3@t.test')$$, array['guardian'], 'the second address accepts its membership');
reset role;
select is((select profile_id from public.guardians where id = pg_temp.g('a02')), pg_temp.uid('f2'), 'Bruno''s record stays attached to Bruno');
select ok(exists (select 1 from audit.audit_events where action = 'guardian.link_refused' and target_id = pg_temp.g('a02') and actor_id = pg_temp.uid('f3') and outcome = 'denied'),
  'the refused attachment is audited as denied');
select pg_temp.login(pg_temp.uid('f3'));
select is((select count(*)::int from public.children), 0, 'the second account sees no child');
reset role;

-- A record that was attached in the meantime is not taken over.
set local role service_role;
insert into public.invitations (organization_id, email, role, first_name, last_name, guardian_id, created_by)
values ('d2f00000-0000-4000-8000-00000000000a', 'gi-f4@t.test', 'guardian', 'Dora', 'Skrbnik', pg_temp.g('a01'), pg_temp.uid('a1'));
select results_eq($$select role::text from api.accept_invitations(pg_temp.uid('f4'), 'gi-f4@t.test')$$, array['guardian'], 'Dora''s account accepts an invitation naming Ana''s record');
reset role;
select is((select profile_id from public.guardians where id = pg_temp.g('a01')), pg_temp.uid('f1'), 'Ana''s record is not taken over');
select is((select profile_id from public.guardians where id = pg_temp.g('a04')), pg_temp.uid('f4'), 'Dora keeps her own record (one per person and kindergarten)');

-- R-48 unchanged: a suspended guardian membership is not reactivated by a guardian invitation.
update public.memberships set status = 'suspended' where profile_id = pg_temp.uid('f2') and role = 'guardian';
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select throws_ok($$select pg_temp.invite('gi-f2@t.test', pg_temp.g('a02'))$$, 'P0001', 'MEMBERSHIP_SUSPENDED', 'a suspended guardian is not invited again (R-48 is checked first)');
reset role;
select pg_temp.login(pg_temp.uid('f2'));
select is((select count(*)::int from public.children), 0, 'a suspended guardian sees no child although the record stays attached');
reset role;

-- R-50 unchanged: guardian invitations count toward the limit.
update public.organizations set invitation_limit_per_hour = 5 where id = 'd2f00000-0000-4000-8000-00000000000a';
select pg_temp.login(pg_temp.uid('a1'), 'aal2');
select is((select count(*)::int from public.invitations where organization_id = 'd2f00000-0000-4000-8000-00000000000a'), 5, 'five invitations in the last hour');
select lives_ok($$select pg_temp.invite('gi-over@t.test', null)$$, 'the sixth is skipped, not raised (R-50)');
select is((select count(*)::int from public.invitations where email = 'gi-over@t.test'), 0, 'and not stored');
reset role;
select ok(exists (select 1 from audit.audit_events where action = 'invitation.limit_reached' and organization_id = 'd2f00000-0000-4000-8000-00000000000a'), 'the refusal is audited');

select * from finish();
rollback;
