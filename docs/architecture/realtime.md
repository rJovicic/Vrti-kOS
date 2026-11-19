# Realtime (D-43) — private Broadcast hints

Approved by the owner on 2026-11-19 (D-43); implemented the same day. Migration
`supabase/migrations/20261119150000_realtime_broadcast.sql`. SR-API-05 is amended accordingly (security-requirements).

## 1. What it does (and does not)

- Live **refresh hints** for four existing features: attendance (admin and educator), private messages
  (conversation participants), in-app notifications (their recipient) and announcements (their audience and the
  managers). No new business function.
- A hint carries **ids and a kind only** (`kind`, `organization_id`, plus e.g. `child_id`, `record_id`,
  `conversation_id`, `message_id`, `notification_id`, `announcement_id`, `local_date`). Never names, message text,
  announcement text or child data. The client **refetches through the normal API**, where RLS (and MFA for managers)
  decides again.
- **Not** used: `postgres_changes` (publication `supabase_realtime` stays empty), Presence, client-to-client
  Broadcast, public channels.

## 2. Authorization model

```
writer transaction (e.g. api.record_attendance)
  └─ AFTER trigger  →  recipients = the read rules at THIS moment
                        (child_educator_participants, conversation_participant_ids,
                         notification recipient, announcement_recipients, active managers)
                    →  realtime.send(payload ids-only, event, 'user:<recipient>', private => true)
Realtime  ── delivers committed messages only ──►  channel 'user:<id>' (private)
           join/receive allowed only if  realtime.topic() = 'user:' || auth.uid()  and extension = 'broadcast'
```

- **Why personal topics.** Supabase Realtime evaluates the RLS policies on `realtime.messages` when a client joins a
  channel and **caches the result for the connection**; it re-evaluates only on a new join or when the client sends a
  new access token (Supabase docs, "Realtime Authorization → Updating RLS policies"). A topic per group or kindergarten
  would therefore keep a revoked person subscribed until their next token refresh. With personal topics the channel rule
  never changes for a person, and **who receives an event is decided in the database at send time** — a revoked right
  takes effect on the very next event while the subscription stays open (proved in pgTAP 34 and `realtime.test.ts`).
- **No sending by clients.** There is no insert/update/delete policy on `realtime.messages`; a client cannot broadcast,
  not even to its own topic (pgTAP), and a REST broadcast with a user token to another user's topic delivers nothing
  (integration).
- **Public channels.** Hosted projects: Realtime setting `private_only = true` (refused at join; staging smoke). The
  database only sends private messages, so a public channel with the same name receives nothing (integration, local
  stack where `private_only` cannot be configured).
- **Archive / edit of announcements** also tells the previous audience (BEFORE trigger) so their list refreshes.
- **Remaining metadata exposure (accepted):** a recipient learns that *something* of a kind happened and its ids at
  the moment they are entitled to read it. A person who loses a right keeps the hints already received (ids only).

## 3. Clients

| Client | How | Token |
|---|---|---|
| Mobile (`apps/mobile/src/lib/live.tsx`) | `LiveEventsProvider` subscribes to `user:<id>` after `realtime.setAuth()`; screens call `useLiveRefresh(kinds, load)` (attendance, conversations, conversation view, notifications, home) | session token from the keychain; supabase-js sends refreshed tokens to Realtime |
| Admin (`/api/live` + `LiveRefresh`) | the browser opens an `EventSource('/api/live')`; the **server** subscribes with the caller's token from the httpOnly cookie and forwards validated hints; the page calls `router.refresh()` | never in the browser (SR-WEB-03); stream ends ≤ 10 min / before token expiry, then reconnects through the proxy that refreshes the session |
| Shared (`packages/domain/src/live-events.ts`) | strict payload parser (unknown kinds, non-uuid ids and extra fields dropped), de-duplication by message id, `onResync` after a drop or a failed first join, coalescing of bursts (400 ms) | — |

**Reconnect.** Realtime does not replay messages sent while a client was disconnected. Every client refetches what it
shows when the channel is joined again (and after a failed first join), so the state converges.
**Duplicates.** Idempotent writes (replayed key) insert no row → no trigger → no event (pgTAP, integration, staging).
A hint delivered twice only causes a second refetch of the same rows.

## 4. Evidence

| Scenario | Local (pgTAP 34 / integration / e2e) | CI | Staging (smoke 2026-11-19) |
|---|---|---|---|
| Attendance visible to the manager without refresh | ✅ integration (event + refetch), ✅ admin e2e (open page updates, no reload) | ✅ #71 | ✅ director receives the event; ✅ Railway `/api/live` streams it to an MFA manager |
| Message to the right participant only | ✅ pgTAP, integration (second guardian gets nothing) | ✅ | ✅ (second guardian of the same child: 0 events) |
| Notification and announcement to the right audience | ✅ pgTAP (audience, draft → managers only, archive → previous audience), integration | ✅ | notification via message ✅; announcement local only |
| Alfa does not receive Beta | ✅ pgTAP, integration | ✅ | ✅ (Beta manager: 0 events) |
| Second guardian gets no private messages | ✅ | ✅ | ✅ |
| Former educator, **subscription kept open** | ✅ integration (channel still `joined`, 0 events), pgTAP | ✅ | — (local proof) |
| Group change moves the scope | ✅ pgTAP, integration | ✅ | — |
| Guardian restricted while subscribed | ✅ pgTAP, integration | ✅ | — |
| Public channel refused | public copy receives nothing (local) | ✅ | ✅ join refused (`private_only`) |
| Reconnect after a network drop | ✅ integration (disconnect → resync → new events), unit | ✅ | — |
| Duplicates do not duplicate data | ✅ pgTAP, integration, unit, mobile render | ✅ | ✅ replay sends nothing |
| Direct Realtime API without rights | ✅ integration (foreign private topic `CHANNEL_ERROR`, REST broadcast forges nothing), pgTAP (policy, no insert) | ✅ | ✅ foreign topic refused |
| Negative control | weakening the channel policy makes the intruder test fail | — | — |

**Not proven:** live behaviour on a physical iPhone (R-44, R-55); delivery under load; Realtime availability SLAs.

## 5. Limits

- Revocation of the **channel** itself is not instantaneous on Supabase (cached per connection); this design does not
  depend on it, because the channel only ever authorizes the person's own topic. A suspended account keeps a joined
  channel until its token expires (≤ 15 min, SR-SESS-02) but receives no events, because the database no longer lists it
  as a recipient.
- Hints after the fact cannot be recalled. They contain no content.
- Local Realtime cannot be set to `private_only`; the public-channel refusal is proved on staging.
