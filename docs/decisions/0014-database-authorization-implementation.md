# ADR-0014: Database authorization implementation pattern

- Status: **Accepted for the local demo only** (owner decision D-20, 2026-11-11); production use remains Proposed
- Date: 2026-11-10
- Related: ADR-0004, ADR-0005, SR-TEN-01…06, SR-AUTHZ-01…12, SR-API-01…03, R-35, docs/architecture/database-schema.md, spikes/rls-spike.sql

## Context
ADR-0005 chose "roles + relationship checks in Postgres". Supabase specifics (exposed schemas, PostgREST, definer
functions, column privileges shared by all users in the `authenticated` role) need a concrete, uniform pattern.

## Decision (proposed)
1. **Schemas:** `public` (tables, RLS on all), `api` (exposed RPCs, `SECURITY INVOKER` only), `private` (helpers,
   trigger functions, `platform_admins`; not exposed; no EXECUTE for `PUBLIC`/`anon`).
2. **Helpers** in `private` are `SECURITY DEFINER`, `STABLE`, `search_path = ''`, and compute access from current
   rows (memberships, staff_assignments, enrollments, child_guardians, access_restrictions) evaluated against the
   org-local date. Policies call them as `(select …)` / `x in (select …)` for per-statement evaluation.
3. **Composite FKs** `(organization_id, id)` for every tenant reference; `EXCLUDE` constraints for time overlaps.
4. **Column-level rules** that RLS cannot express (e.g. a user may update only `notice_ack_*` on own membership;
   a sender may only withdraw a message within 5 min) are enforced by **BEFORE UPDATE guard triggers** in `private`,
   because column GRANTs apply to every user in `authenticated` equally. Column GRANTs are still used where the rule is
   uniform (e.g. `notifications.read_at`, hiding `invitations.token_hash`).
5. **Manager actions require AAL2** inside `is_org_manager()` (SR-AUTHN-07). MFA stays on in all environments,
   including the demo.
6. **No authorization from JWT claims** except `sub` and `aal`; never `user_metadata` (SR-AUTHZ-08).
7. **Privileged writes** that need Auth admin or cross-tenant bootstrap (invitations, organization creation) live in
   Edge Functions using the service key with explicit checks and audit; there are **no exposed definer RPCs**.
8. **Tests:** catalog checks (ST-RLS-00) and the generated permission matrix run in CI on every PR.

## Evidence
Spike on local Supabase (Postgres 17.6): 14/14 checks passed — admin sees only own org; educator only today's group;
expired substitute sees nothing; restricted guardian sees nothing; immediate revocation; composite FK blocks
cross-tenant enrollment; exclusion blocks overlapping enrollment; RLS blocks foreign-group attendance and
`recorded_by` spoofing; missing UPDATE grant blocks edits; private helper not executable by `anon`.

## Consequences
+ One pattern for all modules; revocation immediate; testable.
− Helper functions are a high-value target: every change needs review + tests (R-35).
− Performance must be measured with realistic volumes (P3-2 follow-up in Phase 5).
