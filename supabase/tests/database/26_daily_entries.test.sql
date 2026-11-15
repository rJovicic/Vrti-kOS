-- D4-E: daily overview (migration 20261116130000_daily_entries.sql). AC-10-1 (who reads: guardians with can_view of
-- children in the group on that day, managers), AC-10-2 (only an educator of the group writes), fixed tags, limits,
-- draft vs published, same-day edit marked, notifications, transfer ("on that day"), restriction, audit without text,
-- NEG-01/07/09/10. Synthetic, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('d4e00000-0000-4000-8000-0000000000' || x)::uuid, 'day-' || x || '@t.test', 'authenticated', 'authenticated', now()
from unnest(array['a1', 'e1', 'e2', 'f1', 'f2', 'f3', 'f6', 'f7', 'f8', 'b1', 'c1']) x;
insert into public.profiles (id, first_name, last_name)
select id, 'Racun', split_part(email, '@', 1) from auth.users where id::text like 'd4e00000-%';
insert into private.platform_admins (profile_id) values ('d4e00000-0000-4000-8000-0000000000c1');
insert into public.organizations (id, name, slug) values
  ('d4e00000-0000-4000-8000-00000000000a', 'Test Pregled A', 'test-day-a'),
  ('d4e00000-0000-4000-8000-00000000000b', 'Test Pregled B', 'test-day-b');
insert into public.facilities (id, organization_id, name) values
  ('d4e00000-0000-4000-8000-0000000000fa', 'd4e00000-0000-4000-8000-00000000000a', 'Objekt A'),
  ('d4e00000-0000-4000-8000-0000000000fb', 'd4e00000-0000-4000-8000-00000000000b', 'Objekt B');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values
  ('d4e00000-0000-4000-8000-0000000000aa', 'd4e00000-0000-4000-8000-00000000000a', 'PG', current_date - 60, current_date + 300, 'active'),
  ('d4e00000-0000-4000-8000-0000000000bb', 'd4e00000-0000-4000-8000-00000000000b', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values
  ('d4e00000-0000-4000-8000-000000000051', 'd4e00000-0000-4000-8000-00000000000a', 'd4e00000-0000-4000-8000-0000000000fa', 'd4e00000-0000-4000-8000-0000000000aa', 'S1'),
  ('d4e00000-0000-4000-8000-000000000052', 'd4e00000-0000-4000-8000-00000000000a', 'd4e00000-0000-4000-8000-0000000000fa', 'd4e00000-0000-4000-8000-0000000000aa', 'S2'),
  ('d4e00000-0000-4000-8000-000000000061', 'd4e00000-0000-4000-8000-00000000000b', 'd4e00000-0000-4000-8000-0000000000fb', 'd4e00000-0000-4000-8000-0000000000bb', 'B1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during)
select ('d4e00000-0000-4000-8000-0000000001' || x)::uuid, ('d4e00000-0000-4000-8000-00000000000' || o)::uuid, ('d4e00000-0000-4000-8000-0000000000' || x)::uuid,
       r::public.org_role, daterange(current_date - 30, null)
from (values ('a1', 'a', 'org_admin'), ('e1', 'a', 'educator'), ('e2', 'a', 'educator'), ('f1', 'a', 'guardian'), ('f2', 'a', 'guardian'),
             ('f3', 'a', 'guardian'), ('f6', 'a', 'guardian'), ('f7', 'a', 'guardian'), ('f8', 'a', 'guardian'), ('b1', 'b', 'educator')) v(x, o, r);
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values
  ('d4e00000-0000-4000-8000-00000000000a', 'd4e00000-0000-4000-8000-0000000001e1', 'd4e00000-0000-4000-8000-000000000051', daterange(current_date - 30, null)),
  ('d4e00000-0000-4000-8000-00000000000a', 'd4e00000-0000-4000-8000-0000000001e2', 'd4e00000-0000-4000-8000-000000000052', daterange(current_date - 30, null)),
  ('d4e00000-0000-4000-8000-00000000000b', 'd4e00000-0000-4000-8000-0000000001b1', 'd4e00000-0000-4000-8000-000000000061', daterange(current_date - 30, null));
-- D1, D2 in S1; D8 in S2; D7 was in S1 until yesterday, in S2 from today.
insert into public.children (id, organization_id, first_name, last_name, created_by)
select ('d4e00000-0000-4000-8000-0000000000' || x)::uuid, 'd4e00000-0000-4000-8000-00000000000a', 'Dijete', x, null
from unnest(array['d1', 'd2', 'd7', 'd8']) x;
insert into public.enrollments (organization_id, child_id, group_id, valid_during, created_by)
select 'd4e00000-0000-4000-8000-00000000000a', ('d4e00000-0000-4000-8000-0000000000' || c)::uuid, ('d4e00000-0000-4000-8000-0000000000' || g)::uuid, r, null
from (values ('d1', '51', daterange(current_date - 30, null)), ('d2', '51', daterange(current_date - 30, null)), ('d8', '52', daterange(current_date - 30, null)),
             ('d7', '51', daterange(current_date - 30, current_date)), ('d7', '52', daterange(current_date, null))) v(c, g, r);
-- F1 → D1 (can_view), F2 → D1 (no can_view), F6 → D1 (restricted), F3 → D2, F7 → D7, F8 → D8.
insert into public.guardians (id, organization_id, profile_id, first_name, last_name, created_by)
select ('d4e00000-0000-4000-8000-000000000a' || substr(x, 2) || '0')::uuid, 'd4e00000-0000-4000-8000-00000000000a', ('d4e00000-0000-4000-8000-0000000000' || x)::uuid, 'Skrbnik', x, null
from unnest(array['f1', 'f2', 'f3', 'f6', 'f7', 'f8']) x;
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, valid_during, created_by)
select ('d4e00000-0000-4000-8000-00000000c0' || substr(f, 2) || '0')::uuid, 'd4e00000-0000-4000-8000-00000000000a', ('d4e00000-0000-4000-8000-0000000000' || c)::uuid,
       ('d4e00000-0000-4000-8000-000000000a' || substr(f, 2) || '0')::uuid, v, daterange(current_date - 30, null), null
from (values ('f1', 'd1', true), ('f2', 'd1', false), ('f6', 'd1', true), ('f3', 'd2', true), ('f7', 'd7', true), ('f8', 'd8', true)) x(f, c, v);
insert into public.access_restrictions (organization_id, child_guardian_id, valid_during, created_by) values
  ('d4e00000-0000-4000-8000-00000000000a', 'd4e00000-0000-4000-8000-00000000c060', daterange(current_date - 1, null), null);
-- Yesterday's published S1 overview (written then by E1).
insert into public.daily_entries (id, organization_id, group_id, entry_date, body, status, author_id, published_at) values
  ('d4e00000-0000-4000-8000-00000000dd01', 'd4e00000-0000-4000-8000-00000000000a', 'd4e00000-0000-4000-8000-000000000051', current_date - 1, 'Jucer', 'published',
   'd4e00000-0000-4000-8000-0000000000e1', now() - interval '1 day');

create function pg_temp.login(x text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('d4e00000-0000-4000-8000-0000000000' || x)::uuid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.readers(p_body text, p_who text[]) returns text language plpgsql as $$
declare
  x text;
  out text[] := '{}';
  n int;
begin
  foreach x in array p_who loop
    perform pg_temp.login(x, case when x in ('a1', 'c1') then 'aal2' else 'aal1' end);
    select count(*) into n from public.daily_entries where body = p_body;
    perform set_config('role', 'none', true);
    if n > 0 then out := out || x; end if;
  end loop;
  return array_to_string(out, ',');
end $$;
create temp table everyone (who text[]);
insert into everyone values (array['a1', 'e1', 'e2', 'f1', 'f2', 'f3', 'f6', 'f7', 'f8', 'b1', 'c1']);
grant select on everyone to authenticated;

-- Catalog ---------------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.daily_entries'::regclass), 'RLS on daily_entries');
select ok(not has_table_privilege('authenticated', 'public.daily_entries', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'clients write only through the RPC');
select ok(not has_table_privilege('anon', 'public.daily_entries', 'SELECT'), 'anon reads nothing (NEG-15)');
select ok(not (select prosecdef from pg_proc where oid = 'api.save_daily_entry(uuid, text, text[], boolean)'::regprocedure), 'the RPC is SECURITY INVOKER (SR-API-01)');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'daily_entries'
  and column_name ~* 'child|photo|media|health|attach'), 0, 'group level only: no child, media or health column (FR-10-4)');

-- Who may write (AC-10-2) and what ---------------------------------------------------------------------------------------
select pg_temp.login('e2');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'X')$$, '42501', 'PERMISSION_DENIED', 'an educator of another group cannot (AC-10-2, NEG-07)');
reset role;
select pg_temp.login('a1', 'aal2');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'X')$$, '42501', 'PERMISSION_DENIED', 'managers read, they do not write');
reset role;
select pg_temp.login('b1');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'X')$$, '42501', 'PERMISSION_DENIED', 'another kindergarten cannot (NEG-01)');
reset role;
select pg_temp.login('e1');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', repeat('x', 1001))$$, 'P0001', 'DAILY_ENTRY_CONTENT_INVALID', 'at most 1,000 characters');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'X', array['health'])$$, 'P0001', 'DAILY_ENTRY_CONTENT_INVALID', 'tags only from the fixed list');
select lives_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'Danas smo bili vani.', array['outdoor', 'music', 'outdoor'])$$, 'E1 saves a draft for S1');
reset role;
select is(pg_temp.readers('Danas smo bili vani.', (select who from everyone)), 'a1,e1', 'a draft is read by the managers and the group''s educator only');
select is((select activity_tags::text || '/' || status || '/' || (entry_date = current_date)::text from public.daily_entries where body = 'Danas smo bili vani.'),
  '{music,outdoor}/draft/true', 'tags deduplicated; for today; still a draft');

-- Publishing and readers (AC-10-1) --------------------------------------------------------------------------------------
select pg_temp.login('e1');
select is((select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'Danas smo bili vani.', array['outdoor'], true)),
  (select id from public.daily_entries where body = 'Danas smo bili vani.'), 'publishing keeps the same overview of the day');
reset role;
select is(pg_temp.readers('Danas smo bili vani.', (select who from everyone)), 'a1,e1,f1,f3',
  'readers: managers, the group''s educator, guardians of S1 children with can_view; not without can_view (F2), not restricted (F6), not S2 (F8), not D7 moved to S2 today (F7), not B or the platform admin');
select is((select string_agg(split_part(p.last_name, '-', 2), ',' order by p.last_name) from public.notifications n join public.profiles p on p.id = n.recipient_id
           where n.resource_id = (select id from public.daily_entries where body = 'Danas smo bili vani.')), 'f1,f3', 'publishing notified exactly those guardians, content-free');
select is(pg_temp.readers('Jucer', array['f1', 'f7', 'f8']), 'f1,f7', 'yesterday''s overview: guardians of children in S1 on that day, incl. D7 moved away today (FR-10-3)');

-- Same-day edit after publishing ----------------------------------------------------------------------------------------
select pg_temp.login('e1');
select lives_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'Danas smo bili vani i pjevali.', array['outdoor', 'music'], false)$$, 'a same-day edit');
reset role;
select is((select status || '/' || (edited_at is not null)::text from public.daily_entries where body = 'Danas smo bili vani i pjevali.'), 'published/true',
  'an edit after publishing stays published and is marked edited (cannot be unpublished)');
select is((select count(*)::int from public.notifications n where n.resource_id = (select id from public.daily_entries where body = 'Danas smo bili vani i pjevali.')), 2,
  'an edit sends no new notifications');
select is((select details::text from audit.audit_events where target_table = 'daily_entries' and action = 'daily_entries.update'
           and target_id = (select id from public.daily_entries where body = 'Danas smo bili vani i pjevali.') order by id desc limit 1),
  '{"changed_columns": ["activity_tags", "body", "edited_at"]}', 'the audit records column names, never the text');

-- Who reads nothing / writes nothing --------------------------------------------------------------------------------------
select pg_temp.login('f1');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'X')$$, '42501', 'PERMISSION_DENIED', 'a guardian cannot write');
select is((select count(*)::int from public.daily_entries where group_id = 'd4e00000-0000-4000-8000-000000000052'), 0, 'nor read another group''s overview');
reset role;
select pg_temp.login('c1', 'aal2');
select is((select count(*)::int from public.daily_entries), 0, 'the platform admin reads nothing (NEG-10)');
reset role;
select pg_temp.login('b1');
select is((select count(*)::int from public.daily_entries), 0, 'another kindergarten reads nothing (NEG-01)');
reset role;
update public.memberships set status = 'suspended' where id = 'd4e00000-0000-4000-8000-0000000001e1';
select pg_temp.login('e1');
select throws_ok($$select api.save_daily_entry('d4e00000-0000-4000-8000-000000000051', 'Y')$$, '42501', 'PERMISSION_DENIED', 'a suspended educator cannot write (NEG-09)');
select is((select count(*)::int from public.daily_entries), 0, 'and reads nothing');
reset role;
update public.memberships set status = 'suspended' where id = 'd4e00000-0000-4000-8000-0000000001f1';
select is(pg_temp.readers('Danas smo bili vani i pjevali.', array['f1', 'f3']), 'f3', 'a suspended guardian reads nothing (NEG-09)');

select * from finish();
rollback;
