-- VrtićOS D2-D — persons authorized to pick up a child (FR-04-7, FR-04-8, SR-AUTHZ-09; docs/architecture/d2-plan.md).
-- An authorized person is named per child with a validity; they need no account. Only first and last name are stored:
-- phone and relationship are open (Q-T13) and therefore NOT stored. In the MVP only managers (AAL2) maintain the list
-- (FR-04-8); guardians who may view the child read it; educators read it for children enrolled today in groups they are
-- assigned to today (handover, FR-05-3). Nothing here decides a handover: whether guardians themselves may pick up, and
-- how access restrictions relate to pickup, are D3 rules (owner, 2026-11-12: a restriction is not a pickup ban).

create table public.pickup_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  valid_during daterange not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict,
  constraint pickup_authorizations_not_empty check (not isempty(valid_during))
);
create index pickup_authorizations_child_idx on public.pickup_authorizations (child_id);
comment on table public.pickup_authorizations is
  'Ovlaštena osoba za preuzimanje djeteta (ime, prezime, valjanost). Bez kontakata i odnosa (Q-T13). Sensitivity R3.';

create function private.guard_pickup_authorizations() returns trigger
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
  elsif new.child_id is distinct from old.child_id or new.created_by is distinct from old.created_by then
    -- An authorization belongs to one child; for another child a new authorization is entered.
    raise exception 'PICKUP_IMMUTABLE_COLUMNS' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_pickup_authorizations() from public, anon, authenticated;
create trigger pickup_authorizations_guard before insert or update on public.pickup_authorizations
  for each row execute function private.guard_pickup_authorizations();
create trigger pickup_authorizations_tenant_guard before update on public.pickup_authorizations
  for each row execute function private.guard_tenant_columns();
create trigger pickup_authorizations_touch before update on public.pickup_authorizations
  for each row execute function private.touch_updated_at();
create trigger pickup_authorizations_audit after insert or update on public.pickup_authorizations
  for each row execute function private.audit_row();

-- Reads: managers; guardians through private.guardian_child_ids('can_view') (so an active restriction on their link
-- hides the list, like everything else about that child); educators through private.educator_child_ids() (D-31 scope).
-- Only authorizations valid today are visible to guardians and educators; managers also see past and future ones.
alter table public.pickup_authorizations enable row level security;
create policy pickup_authorizations_select on public.pickup_authorizations for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (valid_during @> private.org_today(organization_id)
        and (child_id in (select private.guardian_child_ids('can_view')) or child_id in (select private.educator_child_ids())))
  );
create policy pickup_authorizations_insert on public.pickup_authorizations for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));
create policy pickup_authorizations_update on public.pickup_authorizations for update to authenticated
  using ((select private.is_org_manager(organization_id))) with check ((select private.is_org_manager(organization_id)));

-- Grants: the creator is server-side for everyone; no DELETE (an authorization is ended by its validity).
revoke all on public.pickup_authorizations from anon, authenticated;
grant select (id, organization_id, child_id, first_name, last_name, valid_during, created_at, updated_at)
  on public.pickup_authorizations to authenticated;
grant insert (organization_id, child_id, first_name, last_name, valid_during) on public.pickup_authorizations to authenticated;
grant update (first_name, last_name, valid_during) on public.pickup_authorizations to authenticated;
