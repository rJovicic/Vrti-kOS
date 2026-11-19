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
| Migrations | all 36 files in `supabase/migrations`, in order, each in one transaction, recorded in `supabase_migrations.schema_migrations` | — |
| Catalog check | 27 tables in `public`/`audit`, **all with RLS**, 52 policies, 32 `api` and 108 `private` functions, 77 triggers; `btree_gist`, `citext` | — |
| Seed | `supabase/seed.sql` (synthetic): 2 kindergartens (Alfa, Beta), 29 accounts, 31 children, 6 groups | — |
| API (PostgREST) | exposed schemas `public, api`; `max_rows = 100` (SR-API-06) | `public, graphql_public`, 1000 rows — **`api` was not exposed, so no app call would have worked** |
| Auth | sign-up off (ADR-0008); anonymous off; e-mail code 6 digits, 600 s (SR-AUTHN-02); access token 900 s (SR-SESS-02); refresh rotation; `custom_access_token` hook = `pg-functions://postgres/auth_hooks/custom_access_token` (R-49); TOTP MFA on, phone MFA off; password min 12 + all classes; reauthentication for password change; `site_url` and redirect allow-list = admin URL | sign-up **on**, 8-digit code valid 60 min, token 3600 s, hook off |
| Auth e-mail template | **not applied**: the free plan refuses template changes without a custom SMTP provider. The default template sends a link, not a code. Codes are minted by the operator script (§4). | — |
| Realtime | `private_only = true` (only authorized private channels), presence off; publication `supabase_realtime` empty | public channels open (measured: an Alfa user could relay a message to a Beta user) |
| Edge Functions | `invite-member`, `accept-invitations` (`verify_jwt` on), `push-dispatch` (`verify_jwt` off, internal secret; without it HTTP 403) | — |
| Storage | no buckets (no feature uses storage yet) | — |

Region of the database: eu-central-1. Region of the admin server: europe-west4. Both EU.

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

(`NODE_USE_ENV_PROXY=1` only behind an HTTP proxy.) Result on 2026-11-19 after all settings: **25 PASS, 0 FAIL,
2 INFO** — health (4), Auth (7: sign-up refused, no account for unknown address, code sign-in, 900 s token, AAL1,
password session refused by the R-49 hook, TOTP → AAL2), RLS and isolation (11, including writes: an Alfa educator
records attendance for an own child and gets `PERMISSION_DENIED` for a Beta child), Realtime (3, see
[realtime.md](realtime.md)). A network failure can never count as an expected refusal (preflight + message checks).

The first runs found the two configuration gaps above (`api` schema not exposed; public Realtime channels open); both
are fixed and now asserted. The smoke run writes a few synthetic attendance events and creates and deletes one
temporary `smoke.lozinka.*@demo.vrtic.test` account.

## 6. Mobile on iPhone (Expo Go)

All native modules of `apps/mobile` are part of Expo Go (secure store, router, localization); push registration has no
provider (D-40), so no Expo Push, APNs or FCM credentials exist. A staging bundle was exported (`expo export
--platform ios`) and passed the CI secret scan. **Not yet verified on a device** (R-44, R-55).

1. Install **Expo Go** from the App Store on the iPhone.
2. On the laptop: `apps/mobile/.env.local` with the three `EXPO_PUBLIC_*` staging values (§2).
3. `pnpm install`, then `pnpm --filter @vrticos/mobile start` (same Wi-Fi as the phone; otherwise `-- --tunnel`).
4. Scan the QR code with the iPhone camera → opens in Expo Go. The DEMO bar must be visible.
5. Sign in with a synthetic address (e.g. `odgojitelj.alfa.1@demo.vrtic.test`), then type the operator code (§4).

A development build (EAS) is only needed if a module outside Expo Go is added; that requires an Expo account and is
not part of this approval.

## 7. Cost and limits

- Supabase: free plan, $0. Free projects pause after about a week without activity; restore from the dashboard.
- Railway: existing account plan (not visible to the tools; region selection worked, which the free plan does not
  offer, so the account is on Hobby: $5/month including $5 usage). One small Next.js service is expected to stay
  within the included usage; no new subscription was created.
