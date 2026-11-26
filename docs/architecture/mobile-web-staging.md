# Mobile app as a staging web preview (Expo web on Railway)

- Status: **implemented on the branch; Railway service prepared as staged changes — not deployed** (deploying creates a
  new billed Railway service → owner approval). Date: 2026-11-26.
- Goal: test the whole mobile app on a phone through an ordinary HTTPS link — no Expo Go, no QR code, no computer.
- Scope: **staging only, synthetic data only.** Not a product channel: the pilot app remains the native app (Expo Go /
  development build), which keeps tokens in the OS keychain.

## 1. Analysis

| Question | Finding | Evidence |
|---|---|---|
| Does Expo SDK 58 support web export? | Yes: `expo export --platform web` with Expo Router, after adding the web peers in the SDK-58 versions (`react-dom` 19.3.0, `react-native-web` ~0.21.4, `@expo/metro-runtime` ~58.0.17, installed with `expo install`) | `expo/bundledNativeModules.json`; export succeeds locally and in CI |
| Output mode | `web.output: "single"` → one `index.html` + hashed bundles under `/_expo/static/js/web/`; routing happens in the browser, so the server must answer every app route with `index.html` | exported `dist-web/` |
| Inline scripts in `index.html`? | None (three `<script src>` tags); one inline reset `<style>` | `dist-web/index.html` → CSP can use `script-src 'self'` |
| Navigation (Expo Router, tabs) | Works; reloads and direct URLs (`/today`, `/attendance`, `/profile`) work with the server's fallback. Tab bar: the empty icon slot cut the labels off on the web → slot hidden on the web only | e2e, screenshots |
| Session storage | **`expo-secure-store` has no web implementation** (its web module is an empty object). Web build uses `deviceStore.web.ts` → the tab's `sessionStorage` (survives reload and direct URLs; not persistent; ends with the tab). iOS/Android unchanged (keychain) | `node_modules/expo-secure-store/src/ExpoSecureStore.web.ts`; `apps/mobile/src/lib/deviceStore*.ts` |
| Supabase (Auth, PostgREST, Realtime) | Works unchanged: browser → `https://hfwlfdgzgulbutnjttnq.supabase.co` (CORS open for REST/Auth); Realtime over WSS | e2e (live attendance update) |
| `accept-invitations` Edge Function | Called after sign-in; blocked by CORS from the web origin (allow-list = admin origin). Failure is caught → existing (already accepted) accounts are unaffected; a **brand-new invitee's first sign-in via the web does not link the invitation** (works via the native app or after the allow-list is extended — a staging security setting, not changed) | `apps/mobile/src/app/sign-in.tsx` |
| Push (D-40) | Not activated anywhere; the web has no push provider either | — |
| Other native APIs | `AppState` (web: page visibility), `KeyboardAvoidingView`, `expo-localization`, safe-area, screens: work on web. `RefreshControl` (pull-to-refresh) does nothing on the web — live updates and reload cover it | e2e |
| Admin service | Untouched: separate Railway service `mobile-web`; nothing shared but the repository | Railway staged changes list only `mobile-web` |

## 2. Architecture

```
iPhone Safari ──HTTPS──▶ Railway "mobile-web" (static files, Node http, no dependencies)
      │                        └─ serves dist-web (built at deploy from this branch)
      └──HTTPS/WSS──▶ Supabase staging hfwlfdgzgulbutnjttnq (Auth, PostgREST with RLS, Realtime)
```

- The server never sees tokens or personal data: it only serves static files; the browser talks to Supabase directly.
- Build-time configuration only (`EXPO_PUBLIC_*`, inlined by Metro): Supabase URL, **publishable** key, `APP_ENV=staging`.
  No secret or service-role key exists in the service; CI scans `dist-web` for key patterns (SR-SUP-04).
- Server (`apps/mobile/web-server/server.mjs`): GET/HEAD only; `/health` (JSON, `no-store`); hashed bundles and assets
  `Cache-Control: public, max-age=31536000, immutable`; `index.html` and every app route `no-store`; missing files with an
  extension → 404; path traversal refused; headers on every response: CSP (`default-src 'self'`, `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'` (react-native-web runtime styles), `connect-src` = self + the Supabase origin and its
  WSS, `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy: no-referrer`, HSTS, `X-Robots-Tag: noindex`, robots.txt
  disallow. It **refuses to start** unless `EXPO_PUBLIC_APP_ENV` is `staging`, `demo` or `local`; the web build itself
  refuses to start in any other environment.
- Visible marker: the DEMO bar reads **"STAGING (web): izmišljeni podaci, samo za testiranje"**; page title
  "VrtićOS (staging web)".
- Session policy (SR-SESS-04, ADR-0019) is enforced by Auth, so it applies to the web unchanged (management 7 days /
  8 hours, staff 30 / 30 days, guardians 30 / 14 days). In addition the web session ends when the tab is closed.

## 3. Security trade-off (accepted for staging only)

On the web the session tokens are readable by scripts of the origin (sessionStorage), unlike the native keychain.
Mitigations: strict CSP (no inline or third-party scripts), no third-party code, tab-scoped storage, short JWT (15 min),
session limits, synthetic data only, `noindex`, the environment guard in both server and build. This is why the web
preview is **not** a pilot channel (risk R-65).

## 4. Railway service (prepared, not deployed)

Project `vrticos-staging`, environment `staging`, service **`mobile-web`** (`3ef8b1a7-0aeb-4b0e-a3e5-17717c52010d`),
created as **staged changes only** on 2026-11-26 (no instance, no deployment, no cost until committed):

| Setting | Value |
|---|---|
| Source | `rJovicic/Vrti-kOS`, branch `claude/vrtricos-master-init-zv9c14` |
| Builder / build | Railpack · `pnpm --filter @vrticos/mobile export:web` |
| Start | `pnpm --filter @vrticos/mobile serve:web` (listens on `PORT`) |
| Health check | `/health`, 120 s; restart on failure (3) |
| Replicas / region | 1 · `europe-west4-drams3a` (same as admin) |
| Watch patterns | `apps/mobile/**`, `packages/**`, `pnpm-lock.yaml`, `package.json` |
| Variables (public only) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_…), `EXPO_PUBLIC_APP_ENV=staging`, `EXPO_NO_TELEMETRY=1`, `RAILPACK_NODE_VERSION=22` |

**To go live (owner):** approve the cost of one more small service on the existing Railway plan, then either commit the
staged changes in the Railway dashboard (project → staging → "Deploy"/review changes) or let the operator run
`accept-deploy` for the staging environment; then generate a `*.up.railway.app` domain for `mobile-web` and check
`https://<domain>/health` → `{"status":"ok","app":"mobile-web","appEnv":"staging",…}`. The staged change list contains
only `mobile-web` (checked); the admin service is not part of it. To abandon: discard the staged changes.

## 5. What works on the web vs. the native app

| Works on the web preview | Needs the native app |
|---|---|
| Sign-in with the 6-digit e-mail code, sign-out, sign-out on all devices | Keychain-protected session that survives closing the app (web: ends with the tab) |
| Educator: groups today, attendance, live updates, daily overview, conversations, notices | Pull-to-refresh gesture (use reload) |
| Guardian: own children, absence report, messages, notices | Push notifications (not activated in any build) |
| Manager: shown that management works in the admin (MFA there) | Linking a brand-new invitation on first sign-in (CORS allow-list) |
| Reload and direct URLs; session policy limits | Offline attendance queue across app restarts (web: only while the tab lives) |

## 6. Tests
- `apps/mobile/web-server/server.test.ts` (8): SPA fallback, cache headers, 404s, health, security headers, traversal,
  methods, environment guard.
- `tests/integration/src/mobile-web.e2e.test.ts` (7, Chromium with the iPhone 13 viewport/touch/user agent, local stack):
  server headers and direct URLs; educator code sign-in, staging banner, own data only and not another kindergarten's
  child (RLS), reload and direct URLs keep the session; live attendance update without reload; guardian sees own
  children only; manager redirected to the admin; sign-out clears tab storage (and nothing in localStorage); a staff
  session past 30 days is refused at its next refresh and the tab returns to sign-in (SR-SESS-04). Runs in CI.
- Not tested: real Safari/WebKit (not installed in CI or the cloud sandbox) — to be checked by hand on an iPhone once
  deployed (testing guide).
