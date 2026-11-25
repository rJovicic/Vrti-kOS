# Hosted Supabase configuration as code (staging)

Introduced 2026-11-25 to reduce R-60 (hosted settings drift from `supabase/config.toml`) and R-61 (hosted Realtime
defaults). Staging only: there is no production project and no production spec (D-3 open).

## 1. Parts

| Part | Path | Purpose |
|---|---|---|
| Spec (source of truth) | `supabase/hosted/staging.json` | project identity (ref, name, region, URLs) and 52 settings; each with class, how it is read, expected value, apply mode and the decision it comes from |
| Tool | `tests/hosted-config` (`@vrticos/hosted-config`) | `check`, `plan`, `apply`, `retention` |
| Unit tests | `tests/hosted-config/test/hosted-config.test.ts` (18, in `pnpm test` → CI) | negative cases without network |
| Smoke | `tests/integration/src/staging/smoke.ts` § config | evaluates the same spec (replaces the former `expected-config.json`) |
| Manual workflow | `.github/workflows/hosted-config.yml` | `workflow_dispatch`, token-free checks only |

### Classes and statuses
- **security** / **functional** — decided values (ADR, SR, `config.toml`). Must be `ok`; `drift` fails (exit 1), `unknown`
  or `skipped` fails (exit 2).
- **decision** — no decided value yet; the actual value is reported (`DECISION`), never shown as a pass.
- **informational** — reported only (`INFO`).
- **unsupported** — cannot be read or applied through any API; documented manual procedure (`MANUAL`).
- `unknown` = could not be read (HTTP error, network error, missing field, unexpected shape) — never a pass.
- Apply modes: **safe** (only top-level fields of `/config/auth`, `/postgrest`, `/config/realtime`, and only for decided
  settings — enforced by spec validation), **manual** (procedure in the spec), **none**.

## 2. Supported and unsupported settings (inventory 2026-11-25)

| Area | Checked automatically | Applied automatically | Manual / not possible |
|---|---|---|---|
| Auth | sign-up off, e-mail on, phone and anonymous off, manual linking off, code 6 digits / 600 s, token 900 s, refresh rotation and reuse interval, password min 12 + reauthentication, `custom_access_token` hook (R-49), TOTP on, phone MFA off, `site_url`, redirect allow-list | all of these (safe) | e-mail template (free plan refuses without SMTP; ADR-0010) |
| Auth — open decisions | session timebox and inactivity (SR-SESS-04/Q-S10), e-mail rate limit (ADR-0010) | no | owner decision |
| API (PostgREST) | exposed schemas `public,api`, `max_rows` 100, extra search path | yes (safe) | — |
| Realtime | `private_only`, presence off, not suspended | `private_only`, presence (safe) | message retention (platform managed, R-53) |
| Keys | legacy keys disabled; only ES256 signing key trusted (R-59) | **no** — changes who can call the API / can sign users out | Dashboard (documented in spec) |
| Edge Functions | `verify_jwt` per function; push activation secrets absent (D-40) | no — set by deployment / secrets UI | `supabase functions deploy` |
| Database (read-only SQL) | all migrations applied; 0 tables without RLS; 0 anon table grants in `public/api/private/audit`; empty Realtime publication; no Realtime write policy; receive policy present; 0 public buckets | no (schema changes only via migrations) | apply missing migrations in order |
| Storage | bucket count (0), public buckets (0) | no | — |
| Network | SSL enforcement (off), allowed CIDRs (all) | no | **open decision** (no requirement; no component connects directly) |
| Pooler | mode (transaction) | no | informational |
| Public probes (no token) | sign-up disabled, only the e-mail provider, schema exposure (public/api yes; graphql_public, private, audit, auth_hooks no), JWKS = ES256 only, Railway admin health points at staging | — | Realtime public-channel refusal needs a WebSocket client: covered by the staging smoke, not by the tool |

Secret-bearing fields (`*secret*`, `*_key`, `*password`, `*_pass`, `*auth_token`) are refused by spec validation and are
never requested or printed; Edge Function secrets are checked by **name** only.

## 3. Using it (operator, locally)

```bash
export SUPABASE_MANAGEMENT_TOKEN=…   # Supabase access token; only in the operator's shell, never in Git/CI/Railway/apps
export HOSTED_PUBLISHABLE_KEY=sb_publishable_…
pnpm --filter @vrticos/hosted-config run cli check --project hfwlfdgzgulbutnjttnq
pnpm --filter @vrticos/hosted-config run cli plan  --project hfwlfdgzgulbutnjttnq
pnpm --filter @vrticos/hosted-config run cli apply --project hfwlfdgzgulbutnjttnq --confirm-project=hfwlfdgzgulbutnjttnq
pnpm --filter @vrticos/hosted-config run cli retention --project hfwlfdgzgulbutnjttnq   # read-only, R-53 evidence
```

Exit codes: 0 ok · 1 drift · 2 not verifiable · 3 refused.

### Guards (why it cannot target production)
1. The spec must say `environment: "staging"` and its `apiUrl` must belong to its ref; any other spec is refused.
2. `--project` must equal the spec's ref, otherwise refused before any request.
3. `apply` requires `--confirm-project=<same ref>`, a fully verified state (no `unknown`/`skipped` required setting),
   and before **every** PATCH re-reads the live project and compares ref, name and region with the spec.
4. Only `safe` settings are patched (one PATCH per API path); the first failure stops everything; the state is re-read
   afterwards. Partial application across paths is therefore possible only up to the failed path and is reported.
5. No production project exists; adding one requires its own spec, which validation currently rejects.

### Authentication
The Management API only accepts a personal access token or an OAuth app token with access to the whole account; no
narrower project-scoped credential was found that works without creating new credentials or an OAuth app (not
done: needs owner approval). Therefore the token stays with the operator; CI runs the token-free subset.

### CI
`hosted-config.yml` is `workflow_dispatch` only, checks that `project_ref` equals the staging spec, accepts only
`check-public`, runs without any secret and prints management checks as `SKIPPED`. GitHub lists a manually triggered
workflow only once the file is on the default branch; until a merge (owner decision) it cannot be dispatched, and the
same command was run locally instead (§4).

## 4. Evidence (2026-11-25)

| What | How | Result |
|---|---|---|
| Real state matches the spec | `check` against staging | 42 ok, 0 drift, 0 unknown; 5 decision, 2 manual, 3 info; exit 0 |
| A wrong expectation fails | spec copy with `postgrest.max_rows` = 50 | `DRIFT … actual 100 · expected 50`, exit 1 |
| Real drift is detected, planned and repaired | `max_rows` set to 101 on staging, then `check` → `plan` → `apply` without/with wrong confirmation → `apply` | check exit 1; plan `SAFE postgrest.max_rows: 101 → 100`; both refused; apply restored 100 and re-checked; final check exit 0 |
| Token-free subset | `check --public-only` (as CI) | 5 ok, 45 skipped (stated as not verified), exit 0 |
| Negative cases | unit tests (18) | wrong/missing ref, production spec, missing token, `--public-only` plan/apply, HTTP 500, network error, partial response, open decision, unapproved (manual) change not applied, stop after first failed PATCH, live project not staging, no secret or token in output, read-only SQL only |
| Same spec in the smoke | `smoke.ts` | 81 pass, 0 fail |

Not proven: the `hosted-config.yml` run on GitHub (not dispatchable before a merge); continuous detection (nothing runs
the management check on a schedule — it needs the operator token).
