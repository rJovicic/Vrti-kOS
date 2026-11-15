# ADR-0012: Offline-tolerant attendance recording

- Status: **Accepted for the local demo only** (owner decision D-20, 2026-11-11); production use remains Proposed
- Date: 2026-11-10
- Related: FR-05-8, AC-05-5, NFR-REL-03/04, SR-MOB-02, SR-API-08, T-DEV-06

## Context
Kindergarten Wi-Fi may be unreliable (assumption, Q-T03 area). Morning check-in must not stall. Full offline sync
is explicitly out of the MVP.

## Options considered
1. **Queue only attendance mutations locally; everything else online-only with cached read view.**
2. Full offline-first sync (WatermelonDB/PowerSync/ElectricSQL) — large complexity, more child data at rest on devices,
   extra processor for hosted sync services.
3. No offline support — risk of lost or duplicated records and frustrated educators.

## Decision (proposed)
Option 1:
- Attendance actions are written to an encrypted local queue (expo-sqlite; payload encrypted with a key held in
  expo-secure-store) containing only IDs, kind, `occurred_at`, handover reference ID and `idempotency_key`.
- Optimistic UI with per-row sync state; replay in order on reconnect; server idempotency by unique key.
- Authorization is re-evaluated at replay time on the server: a replay after the educator's assignment ended is
  rejected and shown as "nije poslano — obratite se upravi" (no silent drop).
- Queue wiped on logout/deactivation after warning (AC-05-5); max age 24 h, then manual resolution.
- The group list for today is cached in memory only for the session.

## Consequences
+ Small, testable feature; no third-party sync service.
− If the device is lost before sync, the unsent events are lost → kindergarten's manual fallback (NFR-REL-02).

## Implementation note (D3-E, 2026-11-15)
- **Storage:** the queue is stored with the app's existing chunked SecureStore storage (iOS Keychain / Android
  Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) instead of `expo-sqlite` + a separate key: the platform store is already
  encrypted at rest, the queue is small (ids only), and no new dependency is needed. Same guarantees as the decision:
  encrypted, ids only (`childId`, `kind`, `occurredAt`, idempotency key, attempts, sync state, refusal code), wiped on
  every sign-out.
- **Flow:** every tap is queued and sent at once; a delivery failure keeps it ("Čeka slanje"); replays are in tap order
  with the original `occurred_at`, the same idempotency key and source `offline_sync`; the server re-authorizes each
  replay (D3-A). A refusal on replay is shown as "Nije poslano" with its reason until the educator dismisses it — no
  silent drop. Retries: when the app returns to the foreground, every 30 s while items wait, and on "Pošalji ponovno".
- **Max age:** not enforced on the device; the server refuses taps of a past day for educators
  (`ATTENDANCE_TIME_INVALID`), which then show as "Nije poslano".
- **Sign-out:** a sign-out by choice warns when unsent taps exist (AC-05-5); every sign-out, including a forced one
  after session expiry, wipes the queue (SR-MOB-02). A queue of another account is discarded on load, never replayed.
- **Tests:** `packages/domain/src/attendance-queue.test.ts` (7), `apps/mobile/src/lib/attendance.test.ts` (classify),
  `apps/mobile/src/features/attendance/attendance.render.test.tsx` (6 offline cases).

