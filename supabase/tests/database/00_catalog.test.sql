-- ST-RLS-00: static catalog checks (security-test-plan §3.1). Fails CI on any violation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'api') and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0, 'every table in exposed schemas has RLS enabled (SR-TEN-01)');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'api') and c.relkind in ('r', 'p', 'v', 'm')
     and has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')),
  0, 'anon has no privileges on any exposed table or view (NEG-15)');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and has_table_privilege('authenticated', c.oid, 'DELETE,TRUNCATE')),
  0, 'authenticated cannot DELETE/TRUNCATE any table (archive instead)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'api') and p.prosecdef),
  0, 'no SECURITY DEFINER function in exposed schemas (SR-API-01)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'private SECURITY DEFINER functions pin search_path');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0, 'anon cannot execute any private function');

select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon has no USAGE on schema private');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'api') and c.relkind = 'v'
     and not coalesce((select bool_or(o in ('security_invoker=true', 'security_invoker=on')) from unnest(c.reloptions) o), false)),
  0, 'every exposed view is security_invoker (SR-TEN-06)');

select is(
  (select count(*)::int from pg_policies
   where schemaname in ('public', 'api')
     and (coalesce(qual, '') ~* 'user_metadata|raw_user_meta' or coalesce(with_check, '') ~* 'user_metadata|raw_user_meta')),
  0, 'no policy reads user-editable metadata (SR-AUTHZ-08)');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and (qual = 'true' or with_check = 'true')),
  0, 'no unconditional (true) policies (SR-TEN-02)');

select is(
  (select count(*)::int from information_schema.columns c
   join pg_class t on t.relname = c.table_name join pg_namespace n on n.oid = t.relnamespace and n.nspname = c.table_schema
   where c.table_schema = 'public' and t.relkind in ('r', 'p') and c.column_name = 'organization_id' and c.is_nullable = 'YES'
     and c.table_name <> 'audit_events'),
  0, 'organization_id is NOT NULL on tenant tables');

select is((select count(*)::int from storage.buckets where public), 0, 'no public storage bucket (SR-STO-01)');

select * from finish();
rollback;
