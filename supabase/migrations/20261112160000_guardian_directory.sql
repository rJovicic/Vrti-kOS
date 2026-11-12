-- VrtićOS D2-G — account state of guardian records for the admin screens (prototype "Djeca i skrbnici": column Račun).
-- guardians.profile_id stays unreadable for every client role (D-31). Managers only need to know WHETHER a record is
-- attached to an account (to offer or not offer an invitation), never which account. A read-only security_invoker view
-- exposes that as a boolean computed by a definer helper that answers only for managers of the kindergarten; for
-- everyone else the value is null. Row visibility is exactly that of public.guardians (caller's RLS).

create function private.guardian_has_account(p_guardian uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when private.is_org_manager(g.organization_id) then g.profile_id is not null end
  from public.guardians g where g.id = p_guardian
$$;
revoke execute on function private.guardian_has_account(uuid) from public, anon;
grant execute on function private.guardian_has_account(uuid) to authenticated;

create view public.guardian_directory with (security_invoker = true) as
  select g.id, g.organization_id, g.first_name, g.last_name, g.status, private.guardian_has_account(g.id) as has_account
  from public.guardians g;
comment on view public.guardian_directory is
  'D2-G: zapisi skrbnika s oznakom ima li račun (samo za upravu; inače null). Samo čitanje; RLS tablice guardians vrijedi.';

revoke all on public.guardian_directory from public, anon, authenticated, service_role;
grant select on public.guardian_directory to authenticated, service_role;
