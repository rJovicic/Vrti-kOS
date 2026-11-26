# ADR-0019: Session lifetime and inactivity limits per role

- Status: **Accepted** for the pilot (owner, 2026-11-25: option B; guardian limits set 2026-11-26)
- Date: 2026-11-26
- Deciders: owner
- Related: SR-SESS-02/03/04, Q-S10, R-62, PP-S1; ADR-0008, ADR-0017; migration `20261126100000_session_limits.sql`;
  [pre-pilot-decisions.md §1 and §7](../security/pre-pilot-decisions.md)

## Context
Supabase refresh tokens never expire by default, and a replayed refresh token is refused without ending the session
(measured, finding PP-S1): a stolen refresh token kept a session alive indefinitely. Supabase's own session limits
(time-box, inactivity) are Pro-plan only and apply the same value to everyone. The pilot needs different limits for
managers (sensitive data, MFA), staff and guardians.

## Options considered
| Option | Summary |
|---|---|
| A — strict | per-role limits + check that the session still exists in every RLS policy (immediate revocation) |
| **B — balanced** | per-role limits enforced when Auth issues a token (custom_access_token hook); revocation effective at the next token |
| C — flexible | no limits (status quo) |

## Decision
Option B, with these pilot limits:

| Role | Maximum session age (from `auth.sessions.created_at`) | Inactivity (from the last refresh) |
|---|---|---|
| Management (`org_admin`, `director`, platform admin) | 7 days | 8 hours |
| Educators and staff (`educator`) | 30 days | 30 days |
| Parents / guardians (`guardian`) | 30 days | 14 days |

- Enforced in `auth_hooks.custom_access_token` every time Auth issues an access token (sign-in, MFA verification,
  every refresh). Age and inactivity come only from `auth.sessions` (written by Auth only).
- Several active roles: the strictest limit of each kind, separately (e.g. educator + guardian: 30 days / 14 days).
- Limits are frozen per session (`auth_hooks.session_limits`) and only tighten: no role change, ended role or
  membership in another kindergarten can lengthen a running session; a promotion shortens it at the next token. A
  person without an active role gets the strictest limits (7 days / 8 hours) without freezing them.
- Fail closed: missing, unknown or foreign session, malformed ids or any error → no token.
- Unchanged: access tokens live 15 minutes (`jwt_expiry` 900), password refusal (R-49), AAL2 claims.

## Consequences
- Positive: a stolen session ends at the latest at its role's limit; idle devices lose access (managers after 8 hours);
  no paid plan needed; limits are per role and tested at the exact boundaries.
- Negative: managers sign in (code + TOTP) at least weekly and after 8 idle hours; guardians at least monthly and
  after 14 idle days.
- Revocation is not immediate: an access token issued before a sign-out or a refused refresh stays valid until it
  expires — at most 15 minutes, plus PostgREST's built-in 30-second clock tolerance (measured: 29 s past `exp`
  accepted, 31 s refused). Option A would close this window at a per-request cost.
- Theft is not detected (PP-S1): whoever refreshes a stolen token first keeps the session until the limit (guardian:
  up to 30 days, while used at least every 14 days). R-62 stays open.

## Security & privacy implications
No new personal data: the frozen-limits table holds session id, account id, role class and two intervals; it is
readable by no API role and deleted with the session. Evidence: pgTAP `36_session_limits` (66 checks, one second
before and at every limit), `tests/integration/src/session-limits.test.ts` (14, real Auth), `sessions.test.ts` (5).

## Cost & complexity estimate
No cost. One migration (one table, two functions); no client change (mobile treats the 401 as an expired session).

## Open points / approval needed
- Applying the migration to staging, then production — **waits for the owner's explicit approval**; until then the
  hosted configuration check reports it as the one expected drift.
- Re-verify the GoTrue facts the hook relies on (hook inside the token transaction; `refreshed_at` updated after the
  token) when Supabase Auth is upgraded.
