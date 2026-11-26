# VrtićOS — Project handoff (2026-11-26)

Repo `rJovicic/Vrti-kOS`, branch `claude/vrtricos-master-init-zv9c14` (not merged to `main`; no production). Latest
commit `c45ca65`, CI #88 running at handoff (last confirmed green: #86). Rules: `CLAUDE.md`; current phase:
`docs/phase-status.md`.

## Current architecture
- **Monorepo:** pnpm 12 + Turborepo, TypeScript strict, Zod at boundaries. `apps/admin` (Next.js, managers),
  `apps/mobile` (Expo SDK 58, educators/parents), `packages/*` (domain, validation, i18n, tokens, db-types),
  `tests/*` (integration, e2e, hosted-config), `supabase/` (migrations, pgTAP, Edge Functions, `hosted/staging.json`).
- **Supabase staging** `hfwlfdgzgulbutnjttnq` (eu-central-1, free plan): 38 migrations, 27 tables all with RLS;
  authorization only in the database. Sign-in: 6-digit e-mail code (passwords disabled, R-49); managers need TOTP
  (AAL2). Realtime: private Broadcast to personal topics `user:<id>` (D-43). `custom_access_token` hook enforces the
  password ban and session limits.
- **Railway** `vrticos-staging` (europe-west4), two separate services, 1 replica each:
  - `admin` → https://admin-staging-7d208881.up.railway.app
  - `mobile-web` → https://mobile-web-staging-ba0c5e13.up.railway.app (Expo web export, dependency-free Node static
    server; staging only)
- **Mobile session storage:** Keychain/Keystore on iOS/Android; the browser tab's `sessionStorage` in the web build
  (which refuses to run outside staging/demo/local).
- **CI (4 jobs):** lint/typecheck/unit; database (pgTAP, integration, admin e2e, mobile-web e2e, concurrency,
  demo reset); admin build + native and web exports + bundle secret scan; gitleaks + dependency audit.
- **Local:** `pnpm demo` runs the whole system (Mailpit catches codes). Native Windows unsupported for this — use WSL2.

## Completed work (recent)
- **Session policy** (ADR-0019, applied to staging 2026-11-26 08:09 UTC):

  | Role | Max session age | Inactivity |
  |---|---|---|
  | Management | 7 days | 8 hours |
  | Staff | 30 days | 30 days |
  | Guardians | 30 days | 14 days |

  Strictest limit of each kind across roles; limits frozen per session and only tighten; fail-closed. An issued token
  stays valid up to 15 min 30 s after revocation (15-min JWT + PostgREST 30 s clock tolerance). Evidence: pgTAP 36
  (66), `session-limits.test.ts` (14), boundary checks on staging (`docs/architecture/staging.md` §3a).
- **Sign out on all devices** (SR-SESS-03) in admin and mobile.
- **Admin sign-in rate limiter** (PP-S2): per IP / e-mail / IP+e-mail / total, before Auth is called; client IP only
  from Railway's `X-Real-IP` (verified to overwrite spoofed values); in-memory counters (one instance only).
  `docs/architecture/admin-rate-limit.md`.
- **Account-enumeration fix** (R-42): admin and mobile code requests continue identically for known and unknown
  addresses, including on Auth 429.
- **Mobile web preview:** Expo web export, static server (SPA fallback, `/health`, CSP, HSTS, noindex, caching),
  "STAGING (web)" banner; tests: server 8, web e2e 7; verified live. `docs/architecture/mobile-web-staging.md`.
- **Hosted configuration as code** (ADR-0018): `tests/hosted-config check` → 44 ok, 0 drift on staging.
- **Retention inventory:** pgTAP 35 proves nothing can delete records; `realtime.messages` retention documented
  (`docs/security/data-retention.md`).
- **Pre-pilot decisions:** `docs/security/pre-pilot-decisions.md` (sessions, e-mail provider, DB network, retention,
  security review).
- **Testing guide PDF** (iPhone, Windows, macOS, incl. section 1a — web link); kept outside the repo.
- Earlier phases D0–D5, D-37…D-43 and Q-T22 are complete (`docs/phase-status.md`).

## Pending tasks
1. Confirm CI #88 green on all four jobs.
2. Run the 10 manual iPhone scenarios on the native app (Expo Go) and in real Safari on the web link (R-44, R-55) —
   nothing has been tested on a physical device yet.
3. E-mail provider (ADR-0010; recommended Scaleway TEM, alternative Brevo); then the invitation adapter,
   `rate_limit_email_sent`, and the sending domain with SPF/DKIM/DMARC.
4. Staging DB hardening (PP-S3, R-64): enable SSL enforcement, remove `0.0.0.0/0` from allowed networks — needs owner
   approval (short restart).
5. Retention and deletion (Q-P09/Q-P10): periods per data category and an anonymisation function — needs the
   kindergarten (controller), DPO and a lawyer; never automatic deletion.
6. Optional: allow the web origin in the `accept-invitations` CORS list (otherwise a brand-new invitee signing in
   first through the web link is not linked to the invitation).
7. Owner revokes the Supabase personal access token after the device tests.
8. Native Windows support for `pnpm demo` (scripts spawn `.cmd` files without a shell).
9. Production setup (Phase 14): DPA, legal review, external penetration test, restore test — each needs approval.

## Open risks
- **R-62** (open): a stolen refresh token is not detected; it works until the session limit (guardian up to 30 days).
- **R-63** (accepted for the pilot): a distributed attack can delay admin sign-in by up to 5 min; condition — the admin
  stays on one instance.
- **R-64** (open): staging DB without SSL enforcement and open to all networks; nothing uses a direct connection.
- **R-65** (accepted for staging): web preview tokens are readable by scripts of its origin; staging and synthetic
  data only.

## Important decisions
- Authorization only in the database (RLS + grants); hidden UI is never authorization.
- The Supabase service-role/secret key never reaches clients, logs or the repo; the admin server holds public keys only.
- Passwords disabled for everyone; e-mail code, plus TOTP for managers.
- Session limits (option B) enforced in the Auth hook rather than Supabase Pro-plan settings; option A (database check
  on every request) rejected because of its per-request cost.
- PP-S2 option (b), the admin-side limiter, chosen over `Sb-Forwarded-For`, which would put a secret key on the admin
  server.
- Push notifications (Expo Push, APNs, FCM) stay off; only a mock adapter exists.
- Synthetic data only (`@demo.vrtic.test`); staging and production isolated; schema changes only through migrations,
  each new table with RLS and negative pgTAP tests in the same change.
- The web preview is a staging test channel, never a pilot channel; the pilot app is native.
- Approval gates: production, deployments, destructive commands, data deletion, security policy changes, paid
  services, major architecture changes, legal/privacy decisions, moving to the next phase.
