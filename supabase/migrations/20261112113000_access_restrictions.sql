-- VrtićOS D2-C — access restrictions on guardian–child links (FR-04-5, FR-04-6, NEG-05; docs/architecture/d2-plan.md).
-- An ACTIVE restriction is a row whose validity contains the kindergarten's date today. It applies to one link (one
-- guardian for one child), wins over every right of that link (can_view, can_report_absence, receives_messages) and
-- takes effect on the next request. Only scope `full` exists in D2 (d2-plan §2); partial scopes are a later decision.
-- No reason or court text is stored: only an internal reference (≤100 characters). Managers only (AAL2) — no guardian
-- (not even the restricted one), no educator and no platform admin can read a restriction. Sensitivity R4.
-- Model of guardians and links is unchanged; only private.guardian_child_ids() and the guardian's own-link visibility
-- gain the restriction check.

create type public.restriction_scope as enum ('full');

create table public.access_restrictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_guardian_id uuid not null,
  scope public.restriction_scope not null default 'full',
  valid_during daterange not null,
  reference text check (char_length(reference) between 1 and 100),
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, child_guardian_id) references public.child_guardians (organization_id, id) on delete restrict,
  constraint access_restrictions_not_empty check (not isempty(valid_during))
);
create index access_restrictions_link_idx on public.access_restrictions (child_guardian_id);
comment on table public.access_restrictions is
  'Ograničenje pristupa na vezi skrbnik–dijete (FR-04-5). Bez razloga i sadržaja odluke; samo interna referenca. Sensitivity R4.';

create function private.guard_access_restrictions() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not private.is_org_manager(new.organization_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  elsif new.child_guardian_id is distinct from old.child_guardian_id or new.scope is distinct from old.scope
        or new.created_by is distinct from old.created_by then
    -- A restriction is ended (valid_during) and, if needed, a new one is entered; its link never changes.
    raise exception 'RESTRICTION_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_access_restrictions() from public, anon, authenticated;
create trigger access_restrictions_guard before insert or update on public.access_restrictions
  for each row execute function private.guard_access_restrictions();
create trigger access_restrictions_tenant_guard before update on public.access_restrictions
  for each row execute function private.guard_tenant_columns();
create trigger access_restrictions_touch before update on public.access_restrictions
  for each row execute function private.touch_updated_at();
create trigger access_restrictions_audit after insert or update on public.access_restrictions
  for each row execute function private.audit_row();

-- Links with a restriction active today. Definer: access_restrictions is unreadable for everyone but managers.
create function private.restricted_link_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select ar.child_guardian_id
  from public.access_restrictions ar
  where ar.valid_during @> private.org_today(ar.organization_id)
$$;
revoke execute on function private.restricted_link_ids() from public, anon;
grant execute on function private.restricted_link_ids() to authenticated;

-- The single source of a guardian's access to a child (children, enrolments, groups and — in D3/D4 — absences and
-- messages all go through it): link valid today, right granted, and NO active restriction on that link.
create or replace function private.guardian_child_ids(p_flag text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select cg.child_id
  from public.child_guardians cg
  where cg.guardian_id in (select private.own_guardian_ids())
    and cg.valid_during @> private.org_today(cg.organization_id)
    and cg.id not in (select private.restricted_link_ids())
    and case p_flag
          when 'can_view' then cg.can_view
          when 'can_report_absence' then cg.can_report_absence
          when 'receives_messages' then cg.receives_messages
          else false
        end
$$;

-- A restricted guardian does not see the restricted link either (it would reveal the child and the restriction).
-- Managers and the D-31 educator branch are unchanged.
drop policy child_guardians_select on public.child_guardians;
create policy child_guardians_select on public.child_guardians for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (guardian_id in (select private.own_guardian_ids())
        and valid_during @> private.org_today(organization_id)
        and id not in (select private.restricted_link_ids()))
    or id in (select private.educator_child_guardian_ids())
  );

alter table public.access_restrictions enable row level security;
create policy access_restrictions_select on public.access_restrictions for select to authenticated
  using ((select private.is_org_manager(organization_id)));
create policy access_restrictions_insert on public.access_restrictions for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy access_restrictions_update on public.access_restrictions for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

revoke all on public.access_restrictions from anon, authenticated;
grant select on public.access_restrictions to authenticated;
grant insert (organization_id, child_guardian_id, valid_during, reference) on public.access_restrictions to authenticated;
grant update (valid_during, reference) on public.access_restrictions to authenticated;
