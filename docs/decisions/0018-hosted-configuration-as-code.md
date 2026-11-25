# ADR-0018: Hosted Supabase configuration as code (staging)

- Status: Accepted for staging (implemented 2026-11-25, owner's infrastructure package request); production pending D-3
- Date: 2026-11-25
- Deciders: owner
- Related: R-60, R-61, R-59, R-53; ADR-0003, ADR-0016; docs/architecture/hosted-config.md

## Context
A hosted Supabase project does not read `supabase/config.toml`. On staging the hosted defaults differed in security-relevant
ways (sign-up on, 8-digit/60-minute codes, hook off, `api` schema not exposed, public Realtime channels open). Settings were
applied by hand and compared by an ad-hoc JSON in the smoke test.

## Options considered
1. **Keep manual settings + smoke comparison** — cheap; no plan/apply, two sources of truth, no negative tests.
2. **`supabase config push` (CLI)** — applies `config.toml` to a linked project; mixes local-only values (demo e-mail rate
   limit, local URLs, CLI-only sections) with hosted ones, does not cover keys, signing keys, Realtime `private_only`,
   storage or database catalog checks, and needs the same account token.
3. **Terraform Supabase provider** — declarative, but a new tool and state, and still an account-wide token.
4. **Own spec + check/plan/apply over the Management API (chosen)** — one JSON spec with decision source per setting,
   read-only SQL catalog checks, strict staging guards, safe-only apply, unit-tested negative cases.

## Decision
Option 4: `supabase/hosted/staging.json` + `tests/hosted-config`. Only decided top-level settings of Auth, PostgREST and
Realtime are applied automatically; keys, signing keys, Edge Function settings and secrets stay manual with documented
procedures; open decisions and unsupported settings are reported, never passed. CI runs only the token-free subset on
manual dispatch; the operator's Supabase access token is never stored in GitHub, Railway or an app.

## Consequences
+ Drift is detectable on demand; a wrong value fails with exit 1; unreadable values never pass; staging-only guards.
− No continuous enforcement: the full check needs the operator token, so it runs when the operator runs it (R-60 stays
  mitigated, not closed). The manual workflow is dispatchable only after the file reaches the default branch.

## Security & privacy implications
Secret-bearing fields are refused by validation and never printed; secrets are checked by name only; SQL is a fixed set of
read-only SELECTs sent with `read_only`. No production project or spec exists.

## Cost & complexity estimate
No new service or cost. ~600 lines of TypeScript and tests.

## Open points / approval needed
Narrower credential for CI (OAuth app or a future project-scoped token) needs owner approval; a production spec follows D-3.
