# ADR-0017: Invitation and sign-in flow (code-only e-mail, invitation bound to a verified address)

- Status: Proposed (implemented for the local demo in D1; owner acceptance needed — D-26)
- Date: 2026-11-11
- Deciders: owner
- Related: ADR-0008, ADR-0010, ADR-0014 · SR-AUTHN-01…07, SR-AUTHZ-07, SR-EF-01…03 · risks R-42, R-43 · FS-01

## Context
ADR-0008 fixes the *methods* (invitation only, e-mail one-time code, mandatory TOTP for managers). Phase 3
(`database-schema.md` §5.23, backlog D1-1/D1-2) sketched a token-based invitation (`token_hash`, accepted through a
link, profile created by an `on_auth_user_created` trigger). Local probes in D1 (see `architecture/d1-implementation.md` §1)
showed that Supabase Auth's built-in invite e-mails a **self-authenticating link** (violates SR-AUTHN-01) and that an
invited-but-unconfirmed user **cannot request a sign-in code** while sign-up is disabled.

## Options considered
1. **Auth `inviteUserByEmail` + link** — simplest; e-mails a bearer link (forwardable, previewable by mail scanners). Rejected.
2. **Own token in the e-mail (`token_hash`), accepted in the app** — single-use secret in the mailbox, but a second secret next
   to the sign-in code, extra UI (paste token), and the mailbox already proves possession at sign-in.
3. **Invitation bound to the e-mail address; possession proven by the sign-in code** — the notice contains no secret; the
   account is pre-provisioned; after the first code sign-in a server function links the verified address to pending
   invitations once.

## Decision (recommended: option 3)
- A manager (active `org_admin`/`director` membership, **AAL2**) creates an invitation through the `invite-member` Edge
  Function. The function inserts the row **as the caller** (user JWT, RLS decides); only then does it use the service key
  for `auth.admin.createUser(email, email_confirm: true)` and to send a notice **without link, token or child data**.
  On failure it revokes the invitation (compensation).
- Sign-in everywhere is a **6-digit code** (templates contain `{{ .Token }}` only, 10-minute validity, single use,
  `shouldCreateUser: false`).
- After verification the client calls `accept-invitations`; it reads the user id and e-mail **from Auth for that JWT**
  (never `user_metadata` or the body) and calls `api.accept_invitations` (SECURITY INVOKER, executable by `service_role`
  only): pending + unexpired + same address (case-insensitive) + confirmed address → profile, membership, `accepted`,
  audit — in one transaction. Re-running accepts nothing (single use).
- Table rules: managers may `INSERT` (column grant: org, e-mail, role, names) and `UPDATE status` pending → revoked only
  (guard trigger sets `revoked_by/at`); `created_by`, `status`, `expires_at` are set by the database; one pending invitation
  per (kindergarten, e-mail, role); expiry 7 days (max 30); `expired` is derived from `expires_at`, not stored.
- **Only an `org_admin` may invite an `org_admin`, or suspend/end an `org_admin` membership** (directors cannot escalate
  or lock out administrators). This narrows the roles matrix entry "Ogr." for directors — owner confirmation needed.
- Guardian invitations are created from the child record in D2 (FR-01-1); the admin UI does not offer them in D1.
- Local transport is Mailpit's HTTP API from the Edge Function; there is deliberately no other transport until ADR-0010.
- Admin sessions live in **httpOnly** cookies; the admin app never creates a browser Supabase client.

## Consequences
- Positive: no bearer secrets in e-mail; one proof of possession (the code); authorization stays in Postgres; acceptance
  is idempotent and auditable; works identically on mobile and web.
- Negative: an Auth account exists (confirmed) before the person ever signs in (R-43); GoTrue answers differently for
  unknown addresses (R-42); a person invited twice to different kindergartens gets one notice per invitation.

## Security & privacy implications
- Data minimised in e-mail: kindergarten name, role, first name, expiry date; no child data, no link.
- `email_confirm: true` means "address entered by the kindergarten", not "verified by the person"; access still requires
  the code from that mailbox. Invitations to a mistyped address can be revoked; the pre-provisioned account has no
  memberships and therefore no data access.
- Edge Functions hold the service key; it never reaches clients (CI checks bundles).

## Cost & complexity estimate
Two small Edge Functions, one RPC, two tables' worth of RLS — implemented and tested in D1 (pgTAP 105, integration 20, e2e 8).

## Open points / approval needed
- D-26: accept this ADR, including the org_admin-only rule for administrator rights.
- Production e-mail provider and rate limits (ADR-0010); GoTrue enumeration mitigation (R-42) before any pilot.
- Re-sending a notice for an existing pending invitation (FR-01-2 "ponovno poslati") is not implemented yet.
