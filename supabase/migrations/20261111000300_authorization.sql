-- VrtićOS D0 — authorization: helpers, RLS policies, grants, guard and audit triggers.
-- Pattern: ADR-0014. Validated by supabase/tests/database/*.test.sql (ST-RLS-00, NEG-01, NEG-09…11, NEG-13, NEG-15).

-- Helpers (private, SECURITY DEFINER, STABLE, empty search_path) -------------------------------
-- They read relationship tables bypassing RLS and return only facts about the *caller*.

create function private.org_today(org uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select o.timezone from public.organizations o where o.id = org), 'Europe/Zagreb'))::date
$$;

create function private.is_aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.platform_admins pa where pa.profile_id = (select auth.uid()))
     and private.is_aal2()
$$;

create function private.has_org_role(org uuid, roles public.org_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.profile_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (roles)
      and m.valid_during @> private.org_today(org)
  )
$$;

-- A-03: org_admin and director share the manager permission set in the MVP; AAL2 is mandatory (SR-AUTHN-07).
create function private.is_org_manager(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_org_role(org, array['org_admin', 'director']::public.org_role[]) and private.is_aal2()
$$;

create function private.member_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m.organization_id from public.memberships m
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
    and m.valid_during @> private.org_today(m.organization_id)
$$;

create function private.managed_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m.organization_id from public.memberships m
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
    and m.role in ('org_admin', 'director')
    and m.valid_during @> private.org_today(m.organization_id)
    and private.is_aal2()
$$;

-- D0 scope: managers see the profiles of members of the kindergartens they manage.
-- Educator/guardian visibility (database-schema.md §5.5) is added with staff assignments and guardianship (D1/D2).
create function private.visible_profile_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m.profile_id from public.memberships m
  where m.organization_id in (select private.managed_org_ids())
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.org_today(uuid),
  private.is_aal2(),
  private.is_platform_admin(),
  private.has_org_role(uuid, public.org_role[]),
  private.is_org_manager(uuid),
  private.member_org_ids(),
  private.managed_org_ids(),
  private.visible_profile_ids()
to authenticated;

-- Membership guard: column rules RLS cannot express (ADR-0014 §4) --------------------------------
-- Self: may only acknowledge the privacy notice. Manager: may only change status/validity of *other* members.
-- Nobody changes role or person through UPDATE (end the membership and create a new one instead).
create function private.guard_memberships() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new; -- service/migration context
  end if;
  if new.role is distinct from old.role or new.profile_id is distinct from old.profile_id
     or new.created_by is distinct from old.created_by then
    raise exception 'MEMBERSHIP_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  if old.profile_id = (select auth.uid()) then
    if new.status is distinct from old.status or new.valid_during is distinct from old.valid_during then
      raise exception 'MEMBERSHIP_SELF_CHANGE_FORBIDDEN' using errcode = '42501'; -- SR-AUTHZ-07
    end if;
  else
    if new.notice_ack_version is distinct from old.notice_ack_version or new.notice_ack_at is distinct from old.notice_ack_at then
      raise exception 'MEMBERSHIP_ACK_IS_PERSONAL' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger memberships_guard before update on public.memberships for each row execute function private.guard_memberships();

-- Audit (append-only, no personal values — only changed column names) ---------------------------
create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_changed text[];
begin
  v_org := case when tg_table_name = 'organizations' then new.id else (to_jsonb(new) ->> 'organization_id')::uuid end;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at') and n.value is distinct from (to_jsonb(old) -> n.key);
  end if;
  insert into public.audit_events (organization_id, actor_id, action, target_table, target_id, correlation_id, details)
  values (
    v_org,
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    new.id,
    nullif(current_setting('app.correlation_id', true), ''),
    case when v_changed is null then '{}'::jsonb else jsonb_build_object('changed_columns', to_jsonb(v_changed)) end
  );
  return new;
end $$;
revoke execute on function private.audit_row() from public, anon, authenticated;

create trigger organizations_audit after update on public.organizations for each row execute function private.audit_row();
do $$
declare t text;
begin
  foreach t in array array['facilities', 'academic_years', 'groups', 'memberships'] loop
    execute format('create trigger %I_audit after insert or update on public.%I for each row execute function private.audit_row()', t, t);
  end loop;
end $$;

-- RLS ---------------------------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.facilities enable row level security;
alter table public.academic_years enable row level security;
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_events enable row level security;
alter table private.platform_admins enable row level security; -- no policies: unreadable by clients

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.member_org_ids()) or (select private.is_platform_admin()));
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.is_org_manager(id))) with check ((select private.is_org_manager(id)));

-- facilities / academic_years: readable by every active member of the kindergarten
create policy facilities_select on public.facilities for select to authenticated
  using (organization_id in (select private.member_org_ids()));
create policy facilities_insert on public.facilities for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy facilities_update on public.facilities for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

create policy academic_years_select on public.academic_years for select to authenticated
  using (organization_id in (select private.member_org_ids()));
create policy academic_years_insert on public.academic_years for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy academic_years_update on public.academic_years for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

-- groups: managers in D0; educators (assignments) and guardians (enrollments) are added in D1/D2
create policy groups_select on public.groups for select to authenticated
  using ((select private.is_org_manager(organization_id)));
create policy groups_insert on public.groups for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy groups_update on public.groups for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.visible_profile_ids()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_org_manager(organization_id)));
create policy memberships_update on public.memberships for update to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_org_manager(organization_id)))
  with check (profile_id = (select auth.uid()) or (select private.is_org_manager(organization_id)));

-- audit_events: read-only for managers of the kindergarten; platform admins only organization config events
create policy audit_events_select on public.audit_events for select to authenticated
  using (
    (organization_id is not null and (select private.is_org_manager(organization_id)))
    or ((select private.is_platform_admin()) and target_table = 'organizations')
  );

-- Grants (anon gets nothing; authenticated gets only what the policies need) -------------------
revoke all on public.organizations, public.facilities, public.academic_years, public.groups,
  public.profiles, public.memberships, public.audit_events from anon, authenticated;
revoke all on private.platform_admins from anon, authenticated;
revoke all on sequence public.audit_events_id_seq from anon, authenticated;

grant select on public.organizations, public.facilities, public.academic_years, public.groups,
  public.profiles, public.memberships, public.audit_events to authenticated;

grant update (name, locale, absence_cutoff_local, quiet_hours_start, quiet_hours_end, privacy_notice_version)
  on public.organizations to authenticated;
grant insert (organization_id, name, address) on public.facilities to authenticated;
grant update (name, address, archived_at) on public.facilities to authenticated;
grant insert (organization_id, name, starts_on, ends_on, status) on public.academic_years to authenticated;
grant update (name, starts_on, ends_on, status) on public.academic_years to authenticated;
grant insert (organization_id, facility_id, academic_year_id, name, capacity) on public.groups to authenticated;
grant update (name, capacity, archived_at) on public.groups to authenticated;
grant update (first_name, last_name, display_name, locale) on public.profiles to authenticated;
grant update (status, valid_during, notice_ack_version, notice_ack_at) on public.memberships to authenticated;
-- No INSERT on memberships/profiles/organizations from clients: created by Edge Functions (D1) and seed.
-- No DELETE anywhere: archive/end instead; deletion only via retention jobs (Phase 12).

-- Final lock-down: no private function is executable except the helpers granted above (ST-RLS-00).
revoke execute on all functions in schema private from public, anon;
revoke execute on function private.guard_memberships(), private.audit_row(), private.guard_tenant_columns(),
  private.touch_updated_at() from authenticated;
