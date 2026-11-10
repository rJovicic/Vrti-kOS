# ADR-0005: Authorization — org-scoped roles plus relationship checks in Postgres

- Status: Proposed
- Date: 2026-11-10
- Related: R-01, R-02, R-04 (parent sees other child), R-05 (educator outside groups), R-10 (insider)

## Context
Access depends on **role** (director, educator, guardian…) *and* on **relationships that change over time**
(guardian↔child with possible court restrictions; educator↔group assignment with substitutes; child↔group
enrollment changes mid-year).

## Options considered
1. **RBAC via `membership(role)` + relationship helper functions used inside RLS policies.**
2. JWT custom claims carrying roles/org ids (via Supabase auth hook) — fast, but stale until token refresh;
   dangerous for revocation (educator removed from group still has access until token expires).
3. External policy engine (OpenFGA / Oso / Cerbos) — expressive ReBAC, but another service and the DB still
   needs RLS for PostgREST access.

## Decision (recommended)
Option 1, with claims only for *non-security-critical hints* (e.g. UI default org):
- `membership(user_id, organization_id, role, status, valid_from, valid_to)`.
- `SECURITY DEFINER` helper functions in a private schema, `STABLE`, with fixed `search_path`, e.g.
  `private.is_org_member(org)`, `private.has_org_role(org, roles[])`, `private.can_view_child(child)`,
  `private.is_assigned_to_group(group)`; evaluated against **current** time-bounded relationships.
- Policies call helpers wrapped as `(select private.fn(...))` so Postgres caches per statement (performance).
- Platform admins have **no** standing access to child data; break-glass via an Edge Function that requires
  a reason, time-limits the grant, and writes an audit record visible to the organization.
- A permission matrix (Phase 1) is the single source of truth; pgTAP tests are generated from it.

## Consequences
+ Revocation is immediate (no token staleness).
+ Same rules apply to PostgREST, RPC, Storage policies and Realtime.
− Policy complexity → needs disciplined tests and performance checks (indexes on relationship tables).

## Security & privacy implications
Directly implements least privilege (Art. 25, 32). Court-ordered parental restrictions modelled as
`guardianship.access_restricted` — exact legal handling is a question for the kindergarten's DPO/lawyer (Q-P11).
