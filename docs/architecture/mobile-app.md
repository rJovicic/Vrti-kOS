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
  (app)/_layout.tsx    ShellProvider → gate (fail closed) → Tabs; the other mode's tabs are not offered (href: null)
  (app)/index.tsx      `/` — guardian "Početna": Parent Home (GuardianHomeScreen), empty state until D2 links children
  (app)/today.tsx      educator "Danas": groups assigned today (RLS; substitute end date)
  (app)/attendance.tsx educator "Dolasci": labelled placeholder until D3
  (app)/messages.tsx   guardian "Poruke": labelled placeholder until D4
  (app)/info.tsx       no mobile role (managers): pointer to the web admin
  (app)/profile.tsx    e-mail, kindergartens, mode switch (educator ↔ guardian), sign-out (FR-01-10)
  dev/parent-home.tsx  DEVELOPMENT-ONLY Parent Home design preview (below)
```

### App shell gates (D1-10, `src/shell/`)
Order of precedence, all fail closed: session (root guard) → memberships loaded (`loading`/`error`; a 401 or JWT error
signs out with reason `expired`) → at least one active membership (`noMembership`) → privacy notice acknowledged for every
kindergarten that published one (`noticeRequired`, FR-01-5) → tabs. The notice gate shows the kindergarten's text
(`public.privacy_notices`, readable by its active members) in full, one kindergarten at a time. A demo text is labelled
"DEMO: ovo nije pravna obavijest". "Pročitao/la sam obavijest" records the published version on all the person's
memberships there (the database refuses any other version and sets the time). The acknowledgement is not consent. A
published version whose text cannot be read blocks the app (fail closed). In the demo seed only Vrtić Beta publishes a
synthetic notice. Each role screen wraps itself in `ModeGuard` (redirect to the current mode's landing tab).
Correlation ids: `src/lib/correlation.ts` creates one id per user action (`mob-<time>-<random>`) and the shell load, the
acknowledgement, the educator groups load and the invitation acceptance send it as `x-correlation-id` on every request
of that action.
Tabs per mode: educator `today, attendance, profile`; guardian `home` (route `index`), `messages, profile`; none `info, profile`.
Kindergarten switching is not needed: every list shows the kindergarten per item (multi-kindergarten views).

### Parent Home UI and development preview (implemented; visual check on a device pending)
- `src/features/guardian-home/` holds a presentational `GuardianHomeScreen` (props only, no data access), its components
  (`ChildSummaryCard`, `AttendanceStatus`, `ActivityRow`, `InlineBanner`, `Skeleton`, `StatusIcon`) and pure presentation
  rules in `model/present.ts` with Vitest tests.
- The guardian landing tab `(app)/index.tsx` renders it with the authorized children (D2-H, below).
- `src/app/dev/parent-home.tsx` loads `preview/ParentHomePreview` and its synthetic fixtures only when `__DEV__` is true;
  in production the route redirects to `/` and the preview module and fixtures are not in the bundle (verified with
  `expo export`). Open in development: `vrticos://dev/parent-home`.
- Absence actions in the preview are disabled until their destination screens exist. Visual check on a simulator or
  device has **not** been done (R-44).

### D2-H: real data for guardians and educators (2026-11-12)
- `src/lib/guardianHome.ts` reads, as the signed-in user, the children RLS returns (active link with `can_view`, no
  active restriction), their kindergarten, today's enrolment, group and facility, and the person's own links
  (`can_report_absence` for the card action). One correlation id per load; 401 ends the session. Attendance stays
  `unavailable` and "Danas" empty until D3 — never sample data. A linked child without a group (D-32) shows
  "Još nije raspoređeno u skupinu" and no facility (`placeLine`, `groupLine` in `model/present.ts`).
- Child detail (`features/guardian-home/ChildDetailView.tsx`): kindergarten, facility, today's group and the pickup
  persons valid today, read-only, with "Popis vodi vrtić". **Technical decision:** it is a view inside the Parent Home
  destination, not a route: in the render tests the tab navigator of this Expo Router version never mounted a hidden
  nested route (`href: null`), and deep links to a child are not part of the MVP. Back (button and Android hardware
  back) returns to the list; the view re-reads the child on open, so access withdrawn in between shows nothing.
- Educator "Danas" lists, per group assigned today, the first and last names of the children enrolled today
  (`lib/home.ts`; RLS returns only those, D2-A). No other child data.
- Tests: `features/guardian-home/home.render.test.tsx` (10, real router + in-memory client: children with/without
  group, exactly the returned children, one correlation id, empty, error + retry, session expiry, detail with pickup
  persons and Back, access withdrawn between list and detail, educator names per group); Vitest label test for the
  child without a group. Visual check on a device is still open (R-44).

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
- **Render and router tests (D-30 approved 2026-11-12):** Jest with `jest-expo ~58.0.14`, `@testing-library/react-native
  14.1.0` (+ peers `test-renderer 1.3.0`, `@react-native/jest-preset 0.88.1`, `@jest/globals 30.5.1`).
  - `src/shell/shell.render.test.tsx` (19 tests) renders the real `src/app` with `expo-router/testing-library` and an
    in-memory Supabase client (`src/test/fakeSupabase.ts`, records request headers; it does not model RLS).
  - It covers the signed-out and signed-in views, Parent Home, educator tabs, managers, no membership, session expiry,
    blocking the other role's destinations, the mode switch, the privacy notice and correlation ids.
  - Jest picks up `*.render.test.tsx`; Vitest the `*.test.ts` files (`vitest.config.ts`). `pnpm --filter
    @vrticos/mobile test` runs both, so CI runs them in the `quality` job.
  - RNTL 14 events are asynchronous: always `await fireEvent.press(...)`.
  - The `@parcel/watcher` build script is denied (`allowBuilds` in `pnpm-workspace.yaml`); Jest falls back to its own
    watcher.
- **Planned:** Maestro flows for sign-in, educator attendance, guardian absence report (needs an emulator).
- **Not done yet:** running the app on an iOS simulator / Android emulator / device (R-44).
- Accessibility: VoiceOver/TalkBack labels on every interactive element; dynamic type up to 200 % without loss of
  function (NFR-A11Y-02).
