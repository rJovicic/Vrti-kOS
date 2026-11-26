# Staging environment (Railway + Supabase) — synthetic data only

> **This is not production and not decision D-3.** Staging exists so the owner can test the admin app and the
> mobile app against a hosted backend (realtime checks, iPhone). It holds **only synthetic data** from
> `supabase/seed.sql` (`@demo.vrtic.test` accounts, fictional kindergartens). No production project, URL, key,
> user, token or personal data exists or may be copied here. ADR-0003 (Supabase EU as the primary platform) and the
> choice of a production host are still open; Railway is used for staging only.

Approved by the owner on 2026-11-19 ("Railway staging i zasebni Supabase testni projekt"). Set up the same day.

## 1. Components

| Part | Name / value | Region | Notes |
|---|---|---|---|
| Supabase project | `vrticos-staging`, ref `hfwlfdgzgulbutnjttnq` | eu-central-1 (Frankfurt) | Free plan, org "rJovicic's Org". The paused project "rJovicic's Project" made room (2 active free projects per owner). |
| Supabase API | `https://hfwlfdgzgulbutnjttnq.supabase.co` | | |
| Railway project | `vrticos-staging`, environment `staging` | | workspace "Robert Jovicic's Projects"; private project, PR deploys off |
| Railway service | `admin` (Next.js, `apps/admin`) | europe-west4 (Amsterdam) | source: this repo, branch `claude/vrtricos-master-init-zv9c14`; auto-deploy on push for `apps/admin/**`, `packages/**`, lockfile |
| Admin URL | `https://admin-staging-7d208881.up.railway.app` | | health: `/api/health` |
| Mobile | Expo Go on iPhone, Metro on the operator's laptop | | no EAS build, no push (§6) |
| Mobile web preview | Railway service `mobile-web` (static Expo web export) | https://mobile-web-staging-ba0c5e13.up.railway.app | health: `/health`; staging and synthetic data only — [mobile-web-staging.md](mobile-web-staging.md) |

There is **no** production environment. Nothing here is linked to `main`.

## 2. Environment variables

Only public values reach an app. The secret key is never set on Railway, in an app, in CI or in the repository.

| Where | Variable | Value |
|---|---|---|
| Railway `admin` | `NEXT_PUBLIC_SUPABASE_URL` | `https://hfwlfdgzgulbutnjttnq.supabase.co` |
| Railway `admin` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging publishable key (`sb_publishable_…`; public by design, also in the browser bundle) |
| Railway `admin` | `NEXT_PUBLIC_APP_ENV` | `staging` — shows the "DEMO: izmišljeni podaci" bar (R-37) |
| Railway `admin` | `PORT`, `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`, `RAILPACK_NODE_VERSION` | `3000`, `production`, `1`, `22` |
| Mobile (`apps/mobile/.env.local`, not committed) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_APP_ENV=staging` | same public values |
| Supabase Edge secrets | `ALLOWED_ORIGINS` | the admin URL above (CORS) |
| Supabase Edge secrets | `EMAIL_TRANSPORT` | `none` — no e-mail provider on staging; invitation mail is not sent (ADR-0010 open) |
| Supabase Edge secrets | `PUSH_ADAPTER` | `disabled`; `PUSH_ACTIVATION_APPROVED` and `EXPO_ACCESS_TOKEN` are **not set** (D-40, R-56) |
| Operator shell only | `STAGING_PUBLISHABLE_KEY`, `STAGING_SECRET_KEY` | for `tests/integration/src/staging/*` — read from the dashboard for one command, never stored |

Railway build: Railpack, `pnpm --filter @vrticos/admin build`, start `pnpm --filter @vrticos/admin start`,
healthcheck `/api/health` (120 s), restart on failure (3). The health route makes no database call and returns only
`{status, appEnv, supabaseHost}`, so an operator can see which project a deployment points at.

## 3. Supabase setup (what was applied, and how it differs from `config.toml`)

`supabase/config.toml` configures only the **local** stack; a hosted project starts with Supabase defaults. Every
setting below was applied through the Management API on 2026-11-19 and verified by the smoke run (§5).

| Area | Applied on staging | Hosted default that was wrong for us |
|---|---|---|
| Migrations | all 38 files in `supabase/migrations` (36 on 2026-11-19 morning, `20261119150000_realtime_broadcast` added the same day, `20261126100000_session_limits` on 2026-11-26 — §3a), in order, each in one transaction, recorded in `supabase_migrations.schema_migrations` | — |
| Catalog check | 27 tables in `public`/`audit`, **all with RLS**, 52 policies, 32 `api` and 108 `private` functions, 77 triggers; `btree_gist`, `citext` | — |
| Seed | `supabase/seed.sql` (synthetic): 2 kindergartens (Alfa, Beta), 29 accounts, 31 children, 6 groups | — |
| API (PostgREST) | exposed schemas `public, api`; `max_rows = 100` (SR-API-06) | `public, graphql_public`, 1000 rows — **`api` was not exposed, so no app call would have worked** |
| Auth | sign-up off (ADR-0008); anonymous off; e-mail code 6 digits, 600 s (SR-AUTHN-02); access token 900 s (SR-SESS-02); refresh rotation; `custom_access_token` hook = `pg-functions://postgres/auth_hooks/custom_access_token` (R-49); TOTP MFA on, phone MFA off; password min 12 + all classes; reauthentication for password change; `site_url` and redirect allow-list = admin URL | sign-up **on**, 8-digit code valid 60 min, token 3600 s, hook off |
| Auth e-mail template | **not applied**: the free plan refuses template changes without a custom SMTP provider. The default template sends a link, not a code. Codes are minted by the operator script (§4). | — |
| Realtime | `private_only = true` (only authorized private channels), presence off; publication `supabase_realtime` empty; D-43: policy `vrticos_receive_own_topic` (SELECT only) and 5 triggers from the migration ([realtime.md](realtime.md)) | public channels open (measured: an Alfa user could relay a message to a Beta user) |
| API keys and JWT signing (R-59) | Edge Functions use the new keys (`SUPABASE_SECRET_KEYS`); legacy `anon`/`service_role` keys **disabled**; JWT signing key ES256 `in_use`, legacy HS256 secret **revoked** | legacy keys enabled; legacy HS256 secret still trusted (`previously_used`) |
| Edge Functions | `invite-member`, `accept-invitations` (`verify_jwt` on), `push-dispatch` (`verify_jwt` off, internal secret; without it HTTP 403) | — |
| Storage | no buckets (no feature uses storage yet) | — |

Region of the database: eu-central-1. Region of the admin server: europe-west4. Both EU.

### 3a. Session limits migration (SR-SESS-04, ADR-0019) — applied 2026-11-26

**Applied to staging** (`hfwlfdgzgulbutnjttnq`, owner approval 2026-11-26) at **2026-11-26 08:09:53 UTC** from commit
`6ff7eba` (file sha256 `770b5768…46ec3`, unchanged since `d357d4d`), through the Management API in one transaction with
its `schema_migrations` row and a guard that aborts if the version is already recorded.

| Check (all read-only, or rolled back) | Result |
|---|---|
| Project before applying | `ref = id = hfwlfdgzgulbutnjttnq`, name `vrticos-staging`, `eu-central-1`, `ACTIVE_HEALTHY`, Postgres 17.12 |
| State before applying | 37 migrations, newest `20261119150000`; `20261126100000` absent; no `auth_hooks.session_limits`, no `session_role_limits`; hook = R-49 version (stable, invoker); `postgres` may read and reference `auth.sessions` |
| Content | identical to commit `6ff7eba`; limits 7 days / 8 hours, 30 / 30 days, 30 / 14 days; no role → 7 days / 8 hours |
| State after applying | 38 migrations incl. `20261126100000 session_limits`; table with RLS, FK `ON DELETE CASCADE` → `auth.sessions`, readable by no API role and not by `supabase_auth_admin`; hook volatile + security definer, keeps the password refusal, contains the session check; `supabase_auth_admin` may execute it, `authenticated` may not execute the hook or `session_role_limits` |
| Limits of real synthetic accounts | `uprava.alfa`, `ravnateljica.alfa`, `platforma` → manager 7 days / 8 hours; `odgojitelj.alfa.1` → staff 30 / 30 days; `roditelj.alfa.1`, `roditelj.oba` → guardian 30 / 14 days |
| Boundaries through the real hook (inside a `DO` block that ends with an exception, so the whole transaction — test sessions included — is rolled back) | manager: age 7 d − 1 s token / 7 d refused 401; idle 8 h − 1 s token / 8 h refused · staff: age 30 d − 1 s token / 30 d refused; idle 30 d − 1 s token · guardian: age 30 d − 1 s token / 30 d refused; idle 14 d − 1 s token / 14 d refused · no session id → 401 · unknown session → 401 |
| Nothing kept by the check | sessions 53 and `session_limits` rows 0 before and after |
| Effect on existing sessions | of 53 staging sessions, 13 are already past their new limits (refused at their next refresh — sign in again), 40 within |
| Hosted configuration check (`tests/hosted-config check`, read-only) | **44 ok, 0 drift**, 0 unknown, 3 decision, 2 manual, 3 info (before: 43 ok + the expected drift "missing 20261126100000") |

No account was created or deleted, no other migration or data changed, the smoke run (which deletes a temporary account)
was not run, and Railway was not touched.

### Reproducing / resetting staging

The Management API calls need a Supabase personal access token (`sbp_…`), provided as a network secret of the
cloud environment, never in the repository. To rebuild the database from zero: pause/restore is not a reset; delete and
recreate the project (owner decision), then apply migrations, seed, the settings in the table above and the Edge
Functions (`supabase functions deploy <name> --remote=<ref> --use-api`). The seed is not idempotent; it is loaded once.

## 4. Signing in without e-mail (operator)

`.test` addresses cannot receive mail and staging has no SMTP provider. Both apps continue to the code screen whatever
the code request returns (SR-AUTHN-03), so the operator mints a real one-time code:

```bash
cd tests/integration
STAGING_PUBLISHABLE_KEY=sb_publishable_… STAGING_SECRET_KEY=sb_secret_… \
  node --experimental-strip-types src/staging/code.ts odgojitelj.alfa.1@demo.vrtic.test
```

`target.ts` refuses any URL other than the staging project and any address outside `@demo.vrtic.test`. The code is
valid 10 minutes, once. The secret key is copied from the dashboard (Project Settings → API Keys) into that one command;
it is not saved, logged or committed, and it never reaches an app. Managers and the platform admin enrol TOTP on first
admin sign-in (SR-AUTHN-07).

## 5. Verification (`tests/integration/src/staging/smoke.ts`)

```bash
cd tests/integration
NODE_USE_ENV_PROXY=1 STAGING_PUBLISHABLE_KEY=… STAGING_SECRET_KEY=… node --experimental-strip-types src/staging/smoke.ts
```

(`NODE_USE_ENV_PROXY=1` only behind an HTTP proxy; add `STAGING_MANAGEMENT_TOKEN=<Supabase access token>` for the
configuration comparison, otherwise that section prints SKIPPED.) Result on 2026-11-19 after R-59 and D-43: **46 PASS,
0 FAIL** — health (4); Auth (7: sign-up refused, no account for an unknown address, code sign-in, 900 s token, AAL1,
password session refused by the R-49 hook, TOTP → AAL2); RLS and isolation (11, including writes: an Alfa educator
records attendance for an own child and gets `PERMISSION_DENIED` for a Beta child); configuration (9: compared with
`tests/integration/src/staging/expected-config.json` — exposed schemas and row limit, 18 Auth settings, Realtime,
legacy keys disabled, only ES256 trusted, `verify_jwt` per function, no push activation secrets; plus `graphql_public`
not exposed and 6-digit codes); Realtime D-43 (11: own topic, public and foreign topics refused, live attendance with
ids only, no duplicate on replay, nothing to Beta or to the second guardian, live message to the educator, no text in
events); admin `/api/live` on Railway (4: 401 without session, stream for an MFA manager, the educator's arrival
arrives live, no token or names in the stream). A network failure can never count as an expected refusal.

**Since 2026-11-25** the configuration section evaluates the shared spec `supabase/hosted/staging.json` (52 settings;
the former `expected-config.json` was removed) — see [hosted-config.md](hosted-config.md). Result 2026-11-25:
**81 PASS, 0 FAIL, 10 INFO** (open decisions, manual settings and informational values are INFO, never PASS). Joins
now wait up to 15 s for `SUBSCRIBED`: after the project's Realtime had been idle for six days the first private join
failed once and supabase-js retried it successfully (the clients already refetch after such a failed first join).

The first runs found the two configuration gaps above (`api` schema not exposed; public Realtime channels open); both
are fixed and now asserted. The smoke run writes a few synthetic attendance events and creates and deletes one
temporary `smoke.lozinka.*@demo.vrtic.test` account.

## 6. Mobile on iPhone (Expo Go)

**Expo Go is enough.** Every native module of `apps/mobile` ships in Expo Go (expo-secure-store, expo-router,
expo-localization, expo-constants, expo-linking, react-native-screens, safe-area-context); Realtime is plain WebSocket in
supabase-js. Push registration has no provider (D-40): no Expo Push, APNs or FCM credentials exist or are needed.
Checked on 2026-11-19: every native dependency matches the version that `expo/bundledNativeModules.json` of SDK 58
expects (the set Expo Go ships); the rest is plain JavaScript (supabase-js, i18next, react-i18next). SDK 58 is the
current stable release (`npm view expo dist-tags`: `latest` = 58.0.26), and the App Store Expo Go tracks the latest SDK.
The Expo version API could not be reached from the cloud session (network policy), so the App Store build itself was
not inspected: if Expo Go shows "incompatible SDK", update Expo Go; only if that fails is a development build needed
(Expo account, not part of this approval).
A staging iOS bundle was exported (`expo export --platform ios`) and passed the CI secret scan. **Not yet verified on a
device** (R-44, R-55).

1. Install **Expo Go** from the App Store.
2. On the laptop (same Wi-Fi as the phone): create `apps/mobile/.env.local` with
   `EXPO_PUBLIC_SUPABASE_URL=https://hfwlfdgzgulbutnjttnq.supabase.co`, the staging publishable key
   (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`, public by design) and `EXPO_PUBLIC_APP_ENV=staging`.
   `pnpm demo` rewrites this file with local values; set it again afterwards. The app has no built-in host: without the
   file it targets `127.0.0.1` (local stack), never a hosted project.
3. `pnpm install`, then `pnpm --filter @vrticos/mobile start` (if the phone cannot reach the laptop:
   `pnpm --filter @vrticos/mobile start -- --tunnel`).
4. Scan the QR code with the iPhone camera → it opens in Expo Go. The "DEMO: izmišljeni podaci" bar must be visible.
5. Sign in with a synthetic address (e.g. `odgojitelj.alfa.1@demo.vrtic.test`); on the code screen type the code from
   the operator script (§4).
6. Live check (D-43): keep the educator's "Danas" screen open on the phone; in the admin (§7) or a second phone record
   an arrival or send a message — the list updates within a few seconds without pulling to refresh. Put the phone in
   flight mode, record another arrival, switch the network back on: the screen refetches on reconnect.

The full manual protocol (10 scenarios with expected results, failure meaning and technical traces):
[product/iphone-test-protocol.md](../product/iphone-test-protocol.md).

**Smoke account.** The smoke run uses its own synthetic manager `smoke.uprava@demo.vrtic.test` (org_admin of Vrtić
Alfa, created on first use; its MFA factors are reset before each run), so accounts used for manual testing — whose
TOTP the tester enrols — are never touched.

## 7. Admin on staging

1. Open https://admin-staging-7d208881.up.railway.app — the DEMO bar is visible; `/api/health` shows `appEnv: staging`.
2. Sign in as `uprava.alfa@demo.vrtic.test` (or `ravnateljica.alfa@…`); type the operator code (§4).
3. First sign-in: enrol TOTP with an authenticator app (SR-AUTHN-07); keep it — the smoke run creates and removes only
   its own factor.
4. "Dolasci" → group Galebovi: when the educator records an arrival on the phone, the row changes without reloading.

## 8. Cost and limits

- Supabase: free plan, $0. Free projects pause after about a week without activity; restore from the dashboard.
- Railway: existing account plan (not visible to the tools; region selection worked, which the free plan does not
  offer, so the account is on Hobby: $5/month including $5 usage). One small Next.js service is expected to stay
  within the included usage; no new subscription was created.

## 9. R-59 remediation (2026-11-19) and the Supabase access token

**What happened.** A Management API response printed the staging legacy JWT secret into a session transcript (never
into the repository, logs, CI or a bundle). A baseline check confirmed it was usable: a forged user token for the
synthetic Alfa manager and a forged `service_role` token were both accepted (HTTP 200).

**What was done (Management API, staging only):**
1. Edge Functions read the new keys first (`288ebe1`) and were redeployed; with an ES256 user token
   `accept-invitations` answers 200 and `invite-member` reaches its input validation.
2. Legacy `anon` and `service_role` API keys disabled (`PUT /api-keys/legacy?enabled=false`).
3. The legacy HS256 signing key revoked (`PATCH /config/auth/signing-keys/<id> {"status":"revoked"}`); the ES256 key
   (already `in_use` on this new project) signs all tokens. No signed-in user lost a session: all live tokens were
   already ES256.
4. Verification (script that reads the secrets into memory only and prints statuses): forged user token → **401**,
   forged `service_role` token → **401**, legacy `service_role` and `anon` keys → **401**; signing keys
   `ES256:in_use, HS256:revoked`. The smoke `config` section asserts this permanently.
5. Search for the legacy secret, the legacy keys and the new secret key in the whole Git history, the working tree,
   the admin and mobile builds and the scratchpad: **0 hits** each. CI never receives staging values.

If the owner prefers to repeat it by hand: Dashboard → Project Settings → **JWT Keys** (rotate to a standby ES256 key,
then revoke the legacy secret) and **API Keys** → Legacy → disable. Both are reversible there.

**Supabase personal access token (PAT).** It was used for the migrations, settings, function deploys and the
configuration comparison. It is account-wide (all projects of the account), so keep it only while staging work is
active. It was not exposed. **Still needed** until the physical iPhone test is done: the operator uses it to read the
staging secret key for sign-in codes, to run the configuration comparison and to apply migrations. Not needed by any
app, CI or Railway. Revocation is an owner action (no API for it), after the device test:
Dashboard → avatar → **Account preferences → Access Tokens → Revoke**, then remove the `api.supabase.com` network
secret from this cloud environment (environment settings → Network secrets). Afterwards the smoke prints
`config: SKIPPED` until a new token is provided for a run; no new token is created by Claude.

