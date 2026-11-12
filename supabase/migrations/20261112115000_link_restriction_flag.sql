-- VrtićOS — D-33 (owner, 2026-11-12): an educator sees a guardian–child link of a child in their group today marked
-- "Ograničeno" (restricted) when an access restriction is active on it — never the reason, the internal reference, any
-- documentation or who entered it, and never the ability to change the restriction or the link's rights.
-- A restriction is NOT a pickup ban: pickup authorizations are separate (D2-D) and handover rules come with D3.
--
-- Implementation: a read-only security_invoker view over child_guardians. Row visibility is exactly that of
-- child_guardians (RLS of the caller: managers; D-31 educators — children enrolled today in groups they are assigned to
-- today; guardians — own unrestricted links only). The view adds one boolean computed by a definer helper that answers
-- only for links the caller can already see; access_restrictions itself stays readable by managers only.

-- True if the link has a restriction active today. The caller must be able to see the link (same rule as the
-- child_guardians select policy); otherwise the answer is false, so the helper cannot be used to probe other links.
create function private.link_is_restricted(p_link uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.child_guardians cg
    join public.access_restrictions ar on ar.child_guardian_id = cg.id and ar.organization_id = cg.organization_id
    where cg.id = p_link
      and ar.valid_during @> private.org_today(ar.organization_id)
      and (
        private.is_org_manager(cg.organization_id)
        or cg.id in (select private.educator_child_guardian_ids())
      )
  )
$$;
revoke execute on function private.link_is_restricted(uuid) from public, anon;
grant execute on function private.link_is_restricted(uuid) to authenticated;

create view public.child_guardian_overview with (security_invoker = true) as
  select cg.id, cg.organization_id, cg.child_id, cg.guardian_id,
         cg.can_view, cg.can_report_absence, cg.receives_messages, cg.valid_during,
         private.link_is_restricted(cg.id) as is_restricted
  from public.child_guardians cg;
comment on view public.child_guardian_overview is
  'D-33: veze skrbnik–dijete s oznakom ograničenja (bez razloga, reference i autora). Samo čitanje; RLS tablice child_guardians vrijedi.';

-- Read-only for every API role (an auto-updatable view must not become a write path).
revoke all on public.child_guardian_overview from public, anon, authenticated, service_role;
grant select on public.child_guardian_overview to authenticated, service_role;
