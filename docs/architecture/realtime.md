# Realtime — current state, staging evidence and a minimal design (not implemented)

## 1. Current state (2026-11-19)

- **No feature uses Realtime.** Neither app subscribes to a channel; the only listener is Supabase Auth
  `onAuthStateChange` (`apps/mobile/src/lib/session.tsx`). Lists refresh on focus and on pull-to-refresh
  (technical-architecture §Realtime, mobile-app §query keys).
- SR-API-05: Realtime is off in the MVP unless a module explicitly needs it; if enabled, only authorized channels with RLS.
- Local stack: `[realtime] enabled = false` (`supabase/config.toml`).
- Hosted staging (`vrticos-staging`): the Realtime service cannot be removed from a hosted project, so it is locked down
  instead: `private_only = true` (public channels refused), presence off, publication `supabase_realtime` empty, no
  policies on `realtime.messages` (so every private channel is refused too).

## 2. The eight requested scenarios — results on staging

Measured with `tests/integration/src/staging/smoke.ts` (§Realtime) against staging on 2026-11-19.
"Not supported" means the product has no such behaviour; it is **not** claimed as working.

| # | Scenario | Result |
|---|---|---|
| 1 | Educator records attendance → admin sees it without reload | **Not supported.** Attendance write succeeded; a `postgres_changes` subscription of the Alfa director received **0 events** (publication empty; with `private_only` the join itself is refused). The admin shows it after reload. |
| 2 | Parent sends a message → educator sees it live | **Not supported.** Same mechanism; the educator sees it on focus/refresh. |
| 3 | New notification appears live | **Not supported.** Notifications are rows read on focus/refresh (push is not active, D-40). |
| 4 | Announcement change appears live | **Not supported.** Re-read on focus/refresh. |
| 5 | User who lost access receives no further events | **Holds, trivially:** nobody receives any Realtime event. Access loss for the API itself is enforced by RLS on every read (pgTAP, integration). |
| 6 | Other kindergarten receives nothing | **Holds at protocol level:** a Beta guardian's join to the private channel `org:<Alfa id>` → `CHANNEL_ERROR`; public topics refused. Before `private_only` was set, a public topic **did** relay a message from an Alfa user to a Beta user (no database data, but an open relay) — fixed and now asserted. |
| 7 | Reconnect keeps a consistent state | **Not applicable** without subscriptions; after reconnect the apps refetch on focus. |
| 8 | No duplicates | **Not applicable** for Realtime. Writes are idempotent by key (attendance, absences — D3) independent of Realtime. |

## 3. Minimal design if the owner wants live updates (proposal — needs a security decision)

Goal: live refresh hints for scenarios 1–4 without sending any personal data over Realtime and without a second
authorization model.

1. **Broadcast from the database, never `postgres_changes`.** An `AFTER INSERT/UPDATE` trigger on
   `attendance_records`, `absence_records`, `messages`, `notifications`, `announcements` calls
   `realtime.send(payload, event, topic, private => true)` with a payload of **IDs only**
   (`{kind, organization_id, group_id|conversation_id, id}`), no names, no text.
2. **Topics per authorization scope:** `group:<id>` (staff of the group), `conversation:<id>` (its participants),
   `user:<profile id>` (own notifications), `org:<id>:managers` (managers with AAL2).
3. **Authorization in Postgres:** RLS policies on `realtime.messages` for `select` (receive) that reuse the existing
   private functions (`private.is_org_manager`, group assignment, `private.conversation_participant_ids`, guardian
   links), and **no** `insert` policy (clients never send). Topic parsing in one `private` function.
4. **Clients treat an event as a hint:** on event → refetch the affected query through the normal API (RLS decides
   again). Missed events after reconnect → full refetch, so scenario 7 and 8 reduce to existing behaviour.
5. **Tests in the same change:** pgTAP for the `realtime.messages` policies (own group / other group / other org /
   ended assignment / restricted guardian), and the staging smoke extended so scenarios 1–6 become real assertions.

Cost: no new subprocessor (Supabase already processes the data); Realtime is included in the plan. Risk: policy
mistakes leak metadata (IDs, timing) — mitigated by IDs-only payloads and negative tests.

**Decision needed (owner):** change SR-API-05 from "off" to "authorized private broadcast with IDs only" and approve
the implementation as a new work package. Until then Realtime stays locked down as in §1.
