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

## Implementation notes (D1, 2026-11-11) — where the code differs from the text above
The decision is unchanged; these notes record verified differences so the ADR is not read as a description of the code.
- Point 4 names `invitations.token_hash` as an example of a hidden column. The implemented `invitations` table has
  **no `token_hash`** (ADR-0017, Proposed, owner decision D-26 pending). Until D-26 is decided this ADR and ADR-0017
  disagree on that detail; nothing has been decided here.
- Point 7: `invite-member` inserts the invitation **with the caller's JWT** (RLS and AAL2 decide) and uses the service key
  only afterwards for the Auth admin API and the notice; acceptance runs `api.accept_invitations`, a `SECURITY INVOKER`
  function executable only by `service_role` (no exposed definer RPC). Organization creation by a platform admin is not
  implemented yet.
- Point 8: catalog checks (ST-RLS-00) and hand-written negative pgTAP tests run in CI (105 tests); the **generated
  permission matrix (ST-RLS-01) does not exist yet**.
- Audit lives in `public.audit_events` with manager-only RLS and append-only grants — see risk R-51 for the deviation
  from SR-AUD-02.

## Implementation note (2026-11-11) — schema `auth_hooks` (R-49, ADR-0008 amendment)
A fourth schema exists besides `public`, `api` and `private`: **`auth_hooks`**, for functions called by Supabase Auth.
It is **not exposed** through the Data API (`[api] schemas = public, api`).
- Grants: `revoke all on schema auth_hooks from public, anon, authenticated`; `grant usage on schema auth_hooks to
  supabase_auth_admin`.
- `auth_hooks.custom_access_token(event jsonb) returns jsonb` — `plpgsql`, `stable`, `search_path = ''`, **SECURITY
  INVOKER** (Supabase recommends no definer for hooks); EXECUTE revoked from `public`, `anon`, `authenticated` and
  granted only to `supabase_auth_admin`. Configured as `[auth.hook.custom_access_token]` with
  `uri = "pg-functions://postgres/auth_hooks/custom_access_token"`. It returns an error (HTTP 403) when the token would
  belong to a password-based session (`authentication_method = 'password'` or `password` in the session's `amr`) and
  the event unchanged otherwise. It reads no tables and adds no claims, so point 6 (no authorization from JWT claims
  except `sub`/`aal`) is unchanged.
- `auth_hooks.reject_password_write()` — trigger function for `vrticos_reject_password_write` (BEFORE INSERT OR UPDATE OF
  `encrypted_password` ON `auth.users`); EXECUTE revoked from API roles.
- pgTAP `03_auth_password_policy.test.sql` checks the trigger, the grants and the hook's decisions.

## Evidence
Spike on local Supabase (Postgres 17.6): 14/14 checks passed — admin sees only own org; educator only today's group;
expired substitute sees nothing; restricted guardian sees nothing; immediate revocation; composite FK blocks
cross-tenant enrollment; exclusion blocks overlapping enrollment; RLS blocks foreign-group attendance and
`recorded_by` spoofing; missing UPDATE grant blocks edits; private helper not executable by `anon`.

## Consequences
+ One pattern for all modules; revocation immediate; testable.
− Helper functions are a high-value target: every change needs review + tests (R-35).
− Performance must be measured with realistic volumes (P3-2 follow-up in Phase 5).
