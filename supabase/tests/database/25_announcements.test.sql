-- D4-B: announcements (migration 20261116120000_announcements.sql). AC-07-1 (audience), AC-07-2 (computed from current
-- relationships: transfer), AC-07-3 (edit keeps a revision, audit without text), AC-07-5 (limits), SR-AUTHZ-10 (only
-- managers publish), link started after publishing [pretpostavka FR-07-4], restriction, archive, notifications,
-- NEG-01/07/09/10. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4b00000-0000-4000-8000-0000000000' || x)::uuid, 'ann-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'e3', 'f1', 'f3', 'f5', 'f6', 'f9', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4b00000-%';
insert into private.platform_admins (profile_id) values ('d4b00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d4b00000-0000-4000-8000-00000000000a', 'Test Objave A', 'test-ann-a'),
  ('d4b00000-0000-4000-8000-00000000000b', 'Test Objave B', 'test-ann-b');
insert into public.facilities (id, organization_id, name) values
  ('d4b00000-0000-4000-8000-0000000000f1', 'd4b00000-0000-4000-8000-00000000000a', 'Objekt 1'),
  ('d4b00000-0000-4000-8000-0000000000f2', 'd4b00000-0000-4000-8000-00000000000a', 'Objekt 2'),
  ('d4b00000-0000-4000-8000-0000000000fb', 'd4b00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4b00000-0000-4000-8000-0000000000aa', 'd4b00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d4b00000-0000-4000-8000-0000000000bb', 'd4b00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
-- S1, S2 in facility 1; S3 in facility 2; B1 in B.
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4b00000-0000-4000-8000-000000000051', 'd4b00000-0000-4000-8000-00000000000a', 'd4b00000-0000-4000-8000-0000000000f1', 'd4b00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d4b00000-0000-4000-8000-000000000052', 'd4b00000-0000-4000-8000-00000000000a', 'd4b00000-0000-4000-8000-0000000000f1', 'd4b00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d4b00000-0000-4000-8000-000000000053', 'd4b00000-0000-4000-8000-00000000000a', 'd4b00000-0000-4000-8000-0000000000f2', 'd4b00000-0000-4000-8000-0000000000aa', 'S3'),
  ('d4b00000-0000-4000-8000-000000000061', 'd4b00000-0000-4000-8000-00000000000b', 'd4b00000-0000-4000-8000-0000000000fb', 'd4b00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d4b00000-0000-4000-8000-0000000001' || x)::uuid, ('d4b00000-0000-4000-8000-00000000000' || o)::uuid, ('d4b00000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('e3', 'a', 'educator'),
             ('f1', 'a', 'guardian'), ('f3', 'a', 'guardian'), ('f5', 'a', 'guardian'), ('f6', 'a', 'guardian'), ('f9', 'a', 'guardian'),
             ('b1', 'b', 'org_admin')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during)
select 'd4b00000-0000-4000-8000-00000000000a', ('d4b00000-0000-4000-8000-0000000001' || e)::uuid, ('d4b00000-0000-4000-8000-0000000000' || g)::uuid, daterange(current_date - 30, null)
from (values ('e1', '51'), ('e2', '52'), ('e3', '53')) v(e, g);
-- D1, D2 and D5 in S1; D9 in S3.
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d4b00000-0000-4000-8000-0000000000' || x)::uuid, 'd4b00000-0000-4000-8000-00000000000a', 'Dijete', x, null
from unnest(array['d1', 'd2', 'd5', 'd9']) x;
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during, created_by)
select ('d4b00000-0000-4000-8000-00000000e00' || substr(c, 2))::uuid, 'd4b00000-0000-4000-8000-00000000000a', ('d4b00000-0000-4000-8000-0000000000' || c)::uuid,
       ('d4b00000-0000-4000-8000-0000000000' || g)::uuid, daterange(current_date - 30, null), null
from (values ('d1', '51'), ('d2', '51'), ('d5', '51'), ('d9', '53')) v(c, g);
-- F1 → D1, F3 → D2, F5 → D5 (link only from today), F6 → D1 (restricted), F9 → D9.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by)
select ('d4b00000-0000-4000-8000-000000000a' || substr(x, 2) || '0')::uuid, 'd4b00000-0000-4000-8000-00000000000a', ('d4b00000-0000-4000-8000-0000000000' || x)::uuid, 'Skrbnik', x, null
from unnest(array['f1', 'f3', 'f5', 'f6', 'f9']) x;
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by)
select ('d4b00000-0000-4000-8000-00000000c0' || substr(f, 2) || '0')::uuid, 'd4b00000-0000-4000-8000-00000000000a', ('d4b00000-0000-4000-8000-0000000000' || c)::uuid,
       ('d4b00000-0000-4000-8000-000000000a' || substr(f, 2) || '0')::uuid, true, daterange(s, null), null
from (values ('f1', 'd1', current_date - 30), ('f3', 'd2', current_date - 30), ('f5', 'd5', current_date),
             ('f6', 'd1', current_date - 30), ('f9', 'd9', current_date - 30)) v(f, c, s);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d4b00000-0000-4000-8000-00000000000a', 'd4b00000-0000-4000-8000-00000000c060', daterange(current_date - 1, null), null);

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4b00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- Which of the given accounts read the announcement with the given title right now, e.g. 'f1,f3'.
create function pg_temp.readers(p_title text, p_who text[]) returns text language plpgsql as $$
declare
  x text;
  out text[] := '{}';
  n int;
begin
  foreach x in array p_who loop
    perform pg_temp.login(x, case when x in ('a1', 'b1') then 'aal2' else 'aal1' end);
    select count(*) into n from public.announcements where title = p_title;
    perform set_config('role', 'none', true);
    if n > 0 then out := out || x; end if;
  end loop;
  return array_to_string(out, ',');
end $$;
create function pg_temp.g(x text) returns uuid language sql as $$ select ('d4b00000-0000-4000-8000-0000000000' || x)::uuid $$;
create function pg_temp.ann(p_title text) returns uuid language sql security definer as $$ select id from public.announcements where title = p_title $$;
grant execute on function pg_temp.g(text), pg_temp.ann(text) to authenticated;
create temp table everyone (who text[]);
insert into everyone values (array['a1', 'e1', 'e2', 'e3', 'f1', 'f3', 'f5', 'f6', 'f9', 'b1', 'c1']);
grant select on everyone to authenticated;

-- Catalog ---------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.announcements'::regclass), 'RLS on announcements');
select ok((select relrowsecurity from pg_class where oid = 'public.announcement_revisions'::regclass), 'RLS on revisions');
select ok(not has_table_privilege('authenticated', 'public.announcements', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients write only through the RPCs');
select ok(not has_table_privilege('anon', 'public.announcements', 'SELECT'), 'anon reads nothing (NEG-15)');
select ok(not (select bool_or(prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api' and p.proname like '%announcement%'),
  'the exposed RPCs are SECURITY INVOKER (SR-API-01)');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'announcements'
  and column_name ~* 'attach|file|urgent|priority'), 0, 'no attachments and no "urgent" flag (FR-07-2, FR-07-6)');

-- Who may write (SR-AUTHZ-10) and what (AC-07-5) -----------------------------------------------------------------------
select pg_temp.login('e1');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'group', array[pg_temp.g('51')], array['guardians'])$$,
  '42501', 'PERMISSION_DENIED', 'an educator cannot write an announcement, not even for the own group (SR-AUTHZ-10)');
reset role;
select pg_temp.login('a1');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'organization', '{}', array['staff'])$$,
  '42501', 'PERMISSION_DENIED', 'a manager without MFA cannot');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'organization', '{}', array['staff'])$$,
  '42501', 'PERMISSION_DENIED', 'another kindergarten''s manager cannot (NEG-01)');
reset role;
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'group', array[pg_temp.g('61')], array['guardians'])$$,
  'P0001', 'ANNOUNCEMENT_AUDIENCE_INVALID', 'a group of another kindergarten is not an audience');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'facility', array[pg_temp.g('51')], array['guardians'])$$,
  'P0001', 'ANNOUNCEMENT_AUDIENCE_INVALID', 'a group id is not a facility');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'group', array[pg_temp.g('51')], array['parents'])$$,
  'P0001', 'ANNOUNCEMENT_AUDIENCE_INVALID', 'roles are guardians and/or staff only');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', repeat('x', 121), 'Y', 'organization', '{}', array['staff'])$$,
  'P0001', 'ANNOUNCEMENT_CONTENT_INVALID', 'title at most 120 characters');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', repeat('y', 4001), 'organization', '{}', array['staff'])$$,
  'P0001', 'ANNOUNCEMENT_CONTENT_INVALID', 'text at most 4,000 characters');
select lives_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'Izlet S1', 'Tekst', 'group', array[pg_temp.g('51')], array['guardians'])$$,
  'the manager saves a draft for the guardians of S1');
reset role;
select is(pg_temp.readers('Izlet S1', (select who from everyone)), 'a1', 'a draft is visible to the managers only');

-- AC-07-1: audience -------------------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.publish_announcement(pg_temp.ann('Izlet S1'))$$, 'published');
select throws_ok($$select api.publish_announcement(pg_temp.ann('Izlet S1'))$$, 'P0001', 'ANNOUNCEMENT_STATE_INVALID', 'not twice');
select lives_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'Sastanak objekta 1', 'Tekst', 'facility', array[pg_temp.g('f1')], array['staff'])$$, 'staff of facility 1');
select lives_ok($$select api.publish_announcement(pg_temp.ann('Sastanak objekta 1'))$$, 'published');
select lives_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'Cijeli vrtic', 'Tekst', 'organization', '{}', array['guardians', 'staff'])$$, 'whole kindergarten, everyone');
select lives_ok($$select api.publish_announcement(pg_temp.ann('Cijeli vrtic'))$$, 'published');
reset role;
select is(pg_temp.readers('Izlet S1', (select who from everyone)), 'a1,f1,f3,f5',
  'S1 guardians: F1, F3 and F5 (link from today); not F9 (S3), not the restricted F6, not educators (AC-07-1), not B or the platform admin');
select is(pg_temp.readers('Sastanak objekta 1', (select who from everyone)), 'a1,e1,e2', 'facility 1 staff: E1 and E2, not E3 (facility 2), no guardian');
select is(pg_temp.readers('Cijeli vrtic', (select who from everyone)), 'a1,e1,e2,e3,f1,f3,f5,f9', 'everyone of A except the restricted guardian; nobody of B (NEG-01), not the platform admin (NEG-10)');
select is((select string_agg(split_part(p.last_name, '-', 2), ',' order by p.last_name) from public.notifications n join public.profiles p on p.id = n.recipient_id
           where n.resource_id = pg_temp.ann('Izlet S1')), 'f1,f3,f5', 'publishing notified exactly the current audience, content-free');
select is((select count(*)::int from public.notifications n where n.resource_id = pg_temp.ann('Cijeli vrtic') and n.recipient_id = pg_temp.g('a1')), 0, 'not the author');

-- [pretpostavka FR-07-4]: an announcement published before the link started is not visible -----------------------------
update public.announcements set published_at = now() - interval '2 days' where title = 'Izlet S1';
select is(pg_temp.readers('Izlet S1', array['f1', 'f5']), 'f1', 'F5''s link started after publishing: not visible');
update public.announcements set published_at = now() where title = 'Izlet S1';

-- AC-07-2: computed from current relationships ---------------------------------------------------------------------------
update public.enrollments set valid_during = daterange(current_date - 30, current_date) where id = 'd4b00000-0000-4000-8000-00000000e001';
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
values ('d4b00000-0000-4000-8000-00000000000a', pg_temp.g('d1'), pg_temp.g('52'), daterange(current_date, null), null);
select is(pg_temp.readers('Izlet S1', array['f1', 'f3']), 'f3', 'after D1 moves to S2, F1 no longer sees the S1 announcement (AC-07-2)');
select is(pg_temp.readers('Cijeli vrtic', array['f1']), 'f1', 'the kindergarten-wide one stays visible');
update public.memberships set status = 'suspended' where id = 'd4b00000-0000-4000-8000-0000000001e1';
select is(pg_temp.readers('Sastanak objekta 1', array['e1', 'e2']), 'e2', 'a suspended educator reads nothing (NEG-09)');

-- AC-07-3: edit after publishing ------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.edit_announcement(pg_temp.ann('Izlet S1'), 'Izlet S1 (novo vrijeme)', 'Novi tekst')$$, 'the manager edits the published text');
reset role;
select is((select title || '|' || body from public.announcement_revisions where announcement_id = pg_temp.ann('Izlet S1 (novo vrijeme)')),
  'Izlet S1|Tekst', 'the previous version is kept as a revision');
select pg_temp.login('f3');
select is((select (edited_at is not null)::text || '|' || body from public.announcements where title = 'Izlet S1 (novo vrijeme)'), 'true|Novi tekst',
  'recipients see the new text marked edited');
select is((select count(*)::int from public.announcement_revisions), 0, 'revisions are not readable by recipients');
reset role;
select is((select details::text from audit.audit_events where target_id = pg_temp.ann('Izlet S1 (novo vrijeme)') and action = 'announcements.update' order by id desc limit 1),
  '{"changed_columns": ["body", "edited_at", "title"]}', 'the audit records the fact and column names, never the text');
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.save_announcement_draft('d4b00000-0000-4000-8000-00000000000a', 'X', 'Y', 'organization', '{}', array['staff'], pg_temp.ann('Cijeli vrtic'))$$,
  'P0001', 'ANNOUNCEMENT_STATE_INVALID', 'a published announcement is not a draft (audience fixed)');
reset role;
select pg_temp.login('e2');
select throws_ok($$select api.edit_announcement(pg_temp.ann('Cijeli vrtic'), 'X', 'Y')$$, '42501', 'PERMISSION_DENIED', 'an educator cannot edit');
reset role;
select pg_temp.login('b1', 'aal2');
select throws_ok($$select api.archive_announcement(pg_temp.ann('Cijeli vrtic'))$$, '42501', 'PERMISSION_DENIED', 'another kindergarten cannot archive (NEG-01)');
reset role;

-- Archive -------------------------------------------------------------------------------------------------------------------
select pg_temp.login('a1', 'aal2');
select lives_ok($$select api.archive_announcement(pg_temp.ann('Cijeli vrtic'))$$, 'archived');
select throws_ok($$select api.edit_announcement(pg_temp.ann('Cijeli vrtic'), 'X', 'Y')$$, 'P0001', 'ANNOUNCEMENT_STATE_INVALID', 'an archived announcement cannot be edited');
reset role;
select is(pg_temp.readers('Cijeli vrtic', (select who from everyone)), 'a1', 'archived: managers only');
select is((select count(*)::int from audit.audit_events where target_table = 'announcements' and actor_id = pg_temp.g('a1')), 8,
  'every action of the manager is audited: 3 drafts, 3 publishes, 1 edit, 1 archive');

select * from finish();
rollback;
