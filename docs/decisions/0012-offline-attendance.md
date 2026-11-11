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
