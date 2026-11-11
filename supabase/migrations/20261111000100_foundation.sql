-- VrtićOS D0 — foundation: schemas, extensions, default privileges, shared types and helpers.
-- Design: docs/architecture/database-schema.md, ADR-0014. Synthetic data only.

create extension if not exists btree_gist with schema extensions;
create extension if not exists citext with schema extensions;

-- Schemas -----------------------------------------------------------------------------------------
-- public : tables exposed through PostgREST, RLS on every table
-- api    : exposed RPCs, SECURITY INVOKER only (SR-API-02)
-- private: helpers, trigger functions, platform_admins — never exposed (SR-API-01)
create schema if not exists api;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated; -- needed so RLS policies can call helpers
revoke all on schema api from public, anon;
grant usage on schema api to authenticated;

-- Supabase grants broad default privileges to anon/authenticated. VrtićOS grants per table instead.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
-- Per-schema default privileges can only ADD to the global defaults, so the PUBLIC execute default on
-- functions must be revoked globally (found by ST-RLS-00 on 2026-11-11). Grants are then explicit per function.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema private revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema api revoke execute on functions from public, anon;

-- Types ---------------------------------------------------------------------------------------------
create type public.org_role as enum ('org_admin', 'director', 'educator', 'guardian');
create type public.membership_status as enum ('active', 'suspended', 'ended');
create type public.academic_year_status as enum ('planned', 'active', 'closed');

-- Generic guards ----------------------------------------------------------------------------------
-- organization_id and id are immutable on every tenant table (database-schema.md §7).
create function private.guard_tenant_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id then
    raise exception 'TENANT_COLUMNS_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end $$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
