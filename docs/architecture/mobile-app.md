# Mobile app architecture — VrtićOS (Expo / React Native)

- Version: 0.1 · Date: 2026-11-10 · Phase: 3
- One app, two experiences: **roditelj** (guardian) and **odgojitelj** (educator) — ADR-0006. A user with both roles
  switches mode explicitly; mode is UI context, never authorization (SR-AUTHZ-02).
- Visual design comes from Phase 4 (DESIGN.md, Impeccable + UI UX Pro Max as references). This document fixes
  structure, navigation, data and security behaviour only.

## 1. Stack
Expo SDK 58 · Expo Router (file-based, typed routes) · TanStack Query · `@supabase/supabase-js` with
`expo-secure-store` session storage · i18next (`hr`) · `packages/tokens` · FlashList · expo-sqlite (offline queue,
ADR-0012). No global state library; local UI state with React state/context (ADR-0015).

## 2. Navigation map

```
app/
  _layout.tsx                    providers: QueryClient, i18n, auth session, error boundary
  (auth)/
    sign-in.tsx                  email → OTP code (no magic link, SR-AUTHN-01)
    verify.tsx                   6-digit code
    accept-invitation.tsx        invitation code → privacy notice of the kindergarten (FR-01-5)
  (app)/
    _layout.tsx                  guards: session, active membership, notice acknowledged; org + mode switcher
    (guardian)/                  bottom tabs
      index.tsx                  Početna — today per child: status, absence, new announcements, daily entry
      children/index.tsx         Moja djeca
      children/[childId]/index.tsx          child overview (group, facility, pickup persons — read only)
      children/[childId]/attendance.tsx      dolasci i izostanci (history list)
      children/[childId]/report-absence.tsx  prijava izostanka (FS-06)
      announcements/index.tsx    Obavijesti
      announcements/[id].tsx
      messages/index.tsx         Poruke (one conversation per child, FS-11)
      messages/[childId].tsx
      daily/[groupId]/[date].tsx Dnevni pregled
      profile/index.tsx          Profil i postavke
    (educator)/                  bottom tabs
      index.tsx                  Moje skupine (groups with assignment today)
      groups/[groupId]/attendance.tsx   evidencija dolazaka (core screen)
      groups/[groupId]/absences.tsx     izostanci skupine
      groups/[groupId]/daily.tsx        dnevni pregled — compose / publish
      announcements/index.tsx    Obavijesti (read; publish only if matrix allows — currently no)
      conversations/index.tsx    Razgovori (children of my groups)
      conversations/[childId].tsx
      profile/index.tsx
    notifications.tsx            in-app notification centre (shared)
    settings/                    sessions & devices, notification preferences, language, delete account request
```

## 3. Module responsibilities

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

## 4. Core screen: educator attendance (design input for Phase 4)
- List of children enrolled today (FlashList), status chip per row: očekuje se / prijavljen izostanak / u vrtiću / otišlo.
- One tap toggles state; optional handover sheet (guardians + pickup authorizations; "osoba nije na popisu"
  shows the kindergarten procedure — FR-05-4); snackbar "Poništi" for 10 s.
- No "all present" action (FR-05-6). Sync indicator per row (queued / synced / failed).
- Target: 20 children < 30 s (NFR-PERF-02) — measured in Phase 4 prototype test.

## 5. Data and offline
- Queries keyed by `organizationId` + resource; pull-to-refresh and refetch on focus (no Realtime in demo).
- Offline: only attendance mutations are queued (ADR-0012); other screens show cached data read-only with an
  "offline" banner; caches are memory-only (no persisted query cache with child data).
- Logout / org switch / account deactivated (401/403 on refresh): clear query cache, secure store, offline queue
  (with warning if unsynced items exist — AC-05-5).

## 6. Security behaviour (SR-MOB, SR-SESS, SR-PUSH)
| Requirement | Implementation |
|---|---|
| Tokens only in Keychain/Keystore | Supabase auth `storage` adapter over `expo-secure-store` (SR-SESS-01, SR-MOB-01) |
| No child data at rest unencrypted | offline queue rows hold IDs + timestamps only; payload encrypted with a key in secure store (SR-MOB-02) |
| App switcher privacy | hide content on background (`expo-screen-capture`/native snapshot overlay) (SR-MOB-03) |
| Deep links | Expo Router links contain only IDs; every screen fetches under RLS; unknown/forbidden → generic "nije dostupno" (SR-MOB-04) |
| Push (later, D-7) | content-free; tap opens notification centre (SR-PUSH-01) |
| Optional app lock for staff | behind Q-S12; uses OS authentication (`expo-local-authentication`) — no biometric data handled by the app |
| Shared tablet mode | only if Q-T03 decides; not in the demo |

## 7. Demo-specific notes
- Runs in **Expo Go** or a development build against the local Supabase stack over LAN (local-development.md §5).
- Push notifications are not available in the demo (needs Expo account + D-7); the in-app notification centre
  shows the same events.
- iOS native builds need macOS + Apple Developer account (paid) — **not required** for the demo (Expo Go on iOS works).

## 8. Testing
- Unit: hooks and domain helpers (Vitest via `@testing-library/react-native` where needed).
- E2E: Maestro flows for sign-in, educator attendance, guardian absence report (Phase 8+, needs emulator).
- Accessibility: VoiceOver/TalkBack labels on every interactive element; dynamic type up to 200 % without loss of
  function (NFR-A11Y-02).
