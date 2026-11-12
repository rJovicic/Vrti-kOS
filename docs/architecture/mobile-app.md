# Mobile app architecture — VrtićOS (Expo / React Native)

- Version: 0.3 · Date: 2026-11-12 · Phase: 3, **aligned with the code after the D1 app shell (backlog D1-10)**
- One app, two experiences: **roditelj** (guardian) and **odgojitelj** (educator) — ADR-0006. A person with both roles
  switches mode in Profil. Mode is UI context, never authorization (SR-AUTHZ-02).
- Visual design: DESIGN.md and docs/design/parent-home-spec.md. This document fixes structure, data and security behaviour.

## 1. Implemented (after D1)
| Concern | Implementation |
|---|---|
| Framework | Expo SDK 58, React Native 0.88, Expo Router with typed routes (`apps/mobile/src/app/`) |
| Navigation | root `Stack` with `Stack.Protected` by session; `(app)` group with `Tabs` and `Tabs.Protected` by mode; bottom bar on phones, side bar from 600 dp (Material rail on Android) — `src/shell/navigation.ts` |
| Providers | `SafeAreaProvider` → `SessionProvider` (`src/lib/session.tsx`) → `SafeAreaView` (top edge) → `DemoBanner` → root `Stack`; inside `(app)`: `ShellProvider` (memberships, mode; keyed by user id). No QueryClient and no error boundary yet |
| Session | `@supabase/supabase-js` with a chunked `expo-secure-store` adapter (`createChunkedStorage` from `packages/domain`), `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, storage key `vrticos.session`; auto-refresh only in the foreground |
| Server state | component state + `useEffect` loaders (`src/lib/home.ts`); TanStack Query is planned (ADR-0015), not installed |
| i18n | i18next + react-i18next over `@vrticos/i18n` (`hr`) |
| Styling | RN `StyleSheet` with `@vrticos/tokens`; `useColors()` picks the light/dark role set |
| Shared UI | `src/ui/`: `Button`, `TextField`, `Notice`, `DemoBanner`, `theme` |

### Routes that exist
```
src/app/
  _layout.tsx          providers; root Stack: signed out → only sign-in, signed in → only (app) (Stack.Protected)
  sign-in.tsx          e-mail → 6-digit code (no magic link, SR-AUTHN-01); after verification calls the
                       accept-invitations Edge Function, then returns to `/`; shows AUTH_SESSION_EXPIRED after an expiry
  (app)/_layout.tsx    ShellProvider → gate (fail closed) → Tabs per mode
  (app)/index.tsx      redirects to the landing tab of the current mode
  (app)/today.tsx      educator "Danas": groups assigned today (RLS; substitute end date)
  (app)/attendance.tsx educator "Dolasci": labelled placeholder until D3
  (app)/home.tsx       guardian "Početna": Parent Home (GuardianHomeScreen), empty state until D2 links children
  (app)/messages.tsx   guardian "Poruke": labelled placeholder until D4
  (app)/info.tsx       no mobile role (managers): pointer to the web admin
  (app)/profile.tsx    e-mail, kindergartens, mode switch (educator ↔ guardian), sign-out (FR-01-10)
  dev/parent-home.tsx  DEVELOPMENT-ONLY Parent Home design preview (below)
```

### App shell gates (D1-10, `src/shell/`)
Order of precedence, all fail closed: session (root guard) → memberships loaded (`loading`/`error`; a 401 or JWT error
signs out with reason `expired`) → at least one active membership (`noMembership`) → privacy notice acknowledged for every
kindergarten that published one (`noticeRequired`, FR-01-5) → tabs. The notice text itself cannot be shown yet, so a
published notice blocks with a message to contact the kindergarten (no kindergarten has published one in the demo).
Tabs per mode: educator `today, attendance, profile`; guardian `home, messages, profile`; none `info, profile`.
Kindergarten switching is not needed: every list shows the kindergarten per item (multi-kindergarten views).

### Parent Home UI and development preview (implemented; visual check on a device pending)
- `src/features/guardian-home/` holds a presentational `GuardianHomeScreen` (props only, no data access), its components
  (`ChildSummaryCard`, `AttendanceStatus`, `ActivityRow`, `InlineBanner`, `Skeleton`, `StatusIcon`) and pure presentation
  rules in `model/present.ts` with Vitest tests.
- The guardian landing tab `(app)/home.tsx` renders it with `state="empty"` until D2 provides the authorized children query.
- `src/app/dev/parent-home.tsx` loads `preview/ParentHomePreview` and its synthetic fixtures only when `__DEV__` is true;
  in production the route redirects to `/` and the preview module and fixtures are not in the bundle (verified with
  `expo export`). Open in development: `vrticos://dev/parent-home`.
- Absence actions in the preview are disabled until their destination screens exist. Visual check on a simulator or
  device has **not** been done (R-44).

## 2. Planned (not implemented)
- Showing and acknowledging the privacy notice text in the app (the gate exists; the content and the write of
  `notice_ack_version` follow with the privacy work).
- Tab icons (no icon set is installed; labels only).
- Guardian screens: child overview, attendance/absence history, report absence (FS-06), announcements, messages, daily
  report, profile and settings (sessions/devices, notification preferences, language, account deletion request).
- Educator screens: group attendance (core screen), group absences, daily report compose, conversations.
- QueryClient (TanStack Query), an error boundary, an in-app notification centre.
These follow the module table below and arrive with D2–D4.
- Design brief for the educator attendance screen (the „zid garderobe” direction, D-24):
  `apps/mobile/.impeccable/surfaces/src-app-app-educator-groups-groupid-attendance-tsx.md`. It is an **active design
  specification**; its `primary_target` (`src/app/(app)/(educator)/groups/[groupId]/attendance.tsx`) is the **planned** route
  and does not exist yet. The final path follows the app shell decided in backlog D1-10.

## 3. Module responsibilities (target)

| Module | Guardian | Educator | Spec |
|---|---|---|---|
| Početna / Moje skupine | today summary per child | list of today's groups with counts | FS-05, FS-06, FS-07 |
| Djeca | own children only; pickup list read-only | — (children visible inside group screens) | FS-04 |
| Dolasci | status + history of own child | one-tap check-in/out, handover from list, undo 10 s, offline queue | FS-05 |
| Izostanci | report (dates only), cancel future | list for group, by day | FS-06 |
| Obavijesti | read | read | FS-07 |
| Poruke / Razgovori | per child, participants shown | per child of my groups | FS-11 |
| Dnevni pregled | read published entries of child's group | write/publish today's entry for own group | FS-10 |
| Profil / postavke | sessions, notifications, language, account deletion request | same | FS-01, FS-08 |

## 4. Core screen: educator attendance (planned for D3)
- List of children enrolled today (FlashList), status chip per row: očekuje se / prijavljen izostanak / u vrtiću / otišlo.
- One tap toggles state; optional handover sheet (guardians + pickup authorizations; "osoba nije na popisu"
  shows the kindergarten procedure — FR-05-4); snackbar "Poništi" for 10 s.
- No "all present" action (FR-05-6). Sync indicator per row (queued / synced / failed).
- Target: 20 children < 30 s (NFR-PERF-02) — measured in Phase 4 prototype test.

## 5. Data and offline (target; today only memory state, no offline queue)
- Queries keyed by `organizationId` + resource; pull-to-refresh and refetch on focus (no Realtime in demo).
- Offline: only attendance mutations are queued (ADR-0012); other screens show cached data read-only with an
  "offline" banner; caches are memory-only (no persisted query cache with child data).
- Logout / org switch / account deactivated (401/403 on refresh): clear query cache, secure store, offline queue
  (with warning if unsynced items exist — AC-05-5).

## 6. Security behaviour (SR-MOB, SR-SESS, SR-PUSH) — implemented rows are marked
| Requirement | Implementation |
|---|---|
| Tokens only in Keychain/Keystore | **implemented:** chunked Supabase auth `storage` adapter over `expo-secure-store` (SR-SESS-01, SR-MOB-01) |
| No child data at rest unencrypted | no child data is stored on the device today; **planned (D3):** offline queue rows hold IDs + timestamps only, payload encrypted with a key in secure store (SR-MOB-02) |
| App switcher privacy | **planned:** hide content on background (`expo-screen-capture`/native snapshot overlay) (SR-MOB-03) |
| Deep links | Expo Router links contain only IDs; every screen fetches under RLS; unknown/forbidden → generic "nije dostupno" (SR-MOB-04) |
| Push (later, D-7) | content-free; tap opens notification centre (SR-PUSH-01) |
| Optional app lock for staff | behind Q-S12; uses OS authentication (`expo-local-authentication`) — no biometric data handled by the app |
| Shared tablet mode | only if Q-T03 decides; not in the demo |

## 7. Demo-specific notes
- Runs in **Expo Go** or a development build against the local Supabase stack over LAN (local-development.md §5).
- Push notifications are not available in the demo (needs Expo account + D-7); a planned in-app notification centre
  will show the same events.
- iOS native builds need macOS + Apple Developer account (paid) — **not required** for the demo (Expo Go on iOS works).

## 8. Testing
- **Implemented:** `pnpm --filter @vrticos/mobile test` (Vitest, also part of `pnpm test`) for pure presentation
  rules (`src/features/**/model/*.test.ts`); shared logic is tested in its package (e.g. the chunked session storage in
  `packages/domain`). Typecheck and `expo export` run in CI. RLS behaviour the app relies on is covered by pgTAP and
  `tests/integration`.
- **App shell (D1-10):** `src/shell/shell.test.ts` (18 tests) covers the gates, role access, tabs per mode, layout per
  width, session end handling and that the route files match the shell definition (protected groups, no fixtures).
- **Not set up:** component render and router tests. They need `@testing-library/react-native` + `jest-expo` (for
  `expo-router/testing-library`). Installing them was refused by the session's permission policy on 2026-11-12;
  owner approval required (D-30). Until then components are checked by typecheck, `expo export` and manual review.
- **Planned:** Maestro flows for sign-in, educator attendance, guardian absence report (needs an emulator).
- **Not done yet:** running the app on an iOS simulator / Android emulator / device (R-44).
- Accessibility: VoiceOver/TalkBack labels on every interactive element; dynamic type up to 200 % without loss of
  function (NFR-A11Y-02).
