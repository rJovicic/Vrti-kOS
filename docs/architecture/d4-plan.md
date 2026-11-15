# D4 — Communication: plan of work packages

Approved by the owner on 2026-11-15 (after D3-H). Scope from the roadmap: announcements, the in-app notification
centre, conversations between guardians and educators, the daily group overview. Sources: FS-06 FR-06-5, FS-07, FS-08,
FS-10, FS-11; AC-07, AC-08, AC-10, AC-11; schema §5.16–5.22; ADR-0004/0005/0007/0014; SR-AUTHZ-10/11, SR-PUSH-01…03;
data inventory DI-07, DI-17…19.

## 1. Non-negotiables (owner, 2026-11-15, plus the permanent rules)
- Push texts never contain children's personal data, names, group names, senders or content (FR-08-2, SR-PUSH-01).
- Access to announcements, notifications, conversations and daily overviews is computed **at read time** from current
  relationships and rights (FR-07-4, FR-11-1, FR-10-3) — no stored audience or participant lists.
- Managers do not read private conversations until explicitly approved (Q-T16, FR-11-6, SR-AUTHZ-11).
- Daily overviews contain no names of children, health or developmental information (FR-10-4): an authoring warning, no
  automatic text analysis (no AI), group-level only.
- No photos, media consents or health data (later phases).
- Every new table: `organization_id`, RLS, grants, audit where the spec requires it, positive and negative pgTAP from the
  first migration; integration tests through the API; render tests for the screens; admin e2e where the admin changes.

## 2. What the documents already decide (implemented as written)
| Topic | Rule | Source |
|---|---|---|
| Announcement content | Title ≤ 120, text ≤ 4,000, no attachments, no "urgent" flag; warning about names and health before publishing | FR-07-2, FR-07-6, AC-07-5 |
| Announcement audience | Whole kindergarten, facility or group(s) × guardians, staff or both; computed when read; guardians see a group announcement only while their child is in that group; announcements published before the link started are not visible `[pretpostavka]` | FR-07-1, FR-07-4, AC-07-1/2 |
| Announcement lifecycle | draft → published → archived; edit after publishing shows "uređeno"; previous versions kept as revisions (visible to managers), audit records only the fact | FR-07-3, AC-07-3 |
| Who publishes | Managers. Educators: open in the matrix → **denied** (SR-AUTHZ-10) | FS-07, schema §5.16 |
| Notifications | In-app centre lists events; no title or body stored — the client loads the resource under its own RLS | FR-08-3, schema §5.21, SR-PUSH-01 |
| Events | New announcement; new absence report (educators of the child's group); new message; new daily overview (optional for guardians) | FR-08-1, FR-06-5, FR-10-5, FR-11-7 |
| Preferences | Push off per type; e-mail for invitations and security cannot be turned off | FR-08-4, AC-08-1 |
| Push text | Generic per type ("Nova obavijest vrtića", "Nova poruka", …) — automated test over all templates | FR-08-2, AC-07-4, SR-PUSH-01 |
| Daily overview | One per group per day; text ≤ 1,000 + optional activity tags; draft → published; same-day edit marked "uređeno"; written by an educator assigned to the group today; read by guardians (with `can_view`) of children enrolled in the group on that day, and managers | FR-10-1…5, AC-10-1/2, schema §5.19 |
| Conversations | One per child; participants derived: guardians with `receives_messages` (no active restriction) and educators assigned to the child's group today; text ≤ 2,000; withdraw within 5 minutes ("poruka uklonjena"); each view says who can see it; former educator loses the whole conversation | FR-11-1…7, AC-11-1/2, schema §5.17/5.18 |
| Managers and conversations | No access to content until Q-T16 | FR-11-6, AC-11-3, SR-AUTHZ-11 |

## 3. Decisions needed (work continues around them)
| ID | Question | Why it is open | Effect until decided |
|---|---|---|---|
| **D-40** | Approve a push provider (ADR-0007: e.g. Expo Push → APNs/FCM; subprocessors, account, possible cost) | ADR-0007 is *Proposed*; a third-party service and an account need the owner (CLAUDE.md approval gates) | Everything up to delivery is built: outbox state per recipient respecting preferences, generic texts with tests, the notification centre. **Device-token registration and sending are not built.** |
| Q-T05 (existing) | Quiet period for staff (proposal 18:00–6:30) and conversation model details | Kindergarten input | Quiet period belongs to push delivery (D-40) — not built; conversation model implemented as FR-11-1 documents (per child, team of the group) |
| Q-T15 (existing) | Read receipts for announcements | Kindergarten input | None (FS-07 out of scope); `notifications.read_at` is the recipient's own state, never shown to authors |
| Q-T16 (existing) | Manager access to conversations | Legal/privacy | Denied |
| Matrix *** (existing) | Educators publishing announcements to their group | Validation | Denied |

## 4. Data model
As schema §5.16–5.22 with these technical choices:
- `announcements` + `announcement_revisions` (AC-07-3 requires the history; the schema's "deferred" note is superseded by
  the acceptance criterion). Audience: `audience_scope` + `audience_ids` + `audience_roles`, validated by a guard trigger.
- `notifications`: content-free rows `(recipient, type, resource)`, `read_at`, `push_status` (`pending` when the
  recipient wants push for the type, else `not_applicable`) — the delivery worker comes with D-40.
- `notification_preferences (profile_id, type, push_enabled)`.
- `daily_entries` with `activity_tags` limited to a fixed code list (no free-text tags).
- `conversations` (one per child) and `messages`; participants derived by `private.can_access_conversation`.

## 5. Work packages (order, acceptance)
| Package | Content | Acceptance |
|---|---|---|
| D4-A | Notification core: `notifications`, `notification_preferences`, fan-out helper, absence-report notifications to educators (FR-06-5), mark read, generic push texts | pgTAP (own rows only, no content columns, preferences respected, fan-out recipients), unit test over all push templates, integration | **Done 2026-11-15:** `20261116110000_notifications.sql`; pgTAP 24 (26; mutation → 3 fail); integration `notifications.test.ts` (3); `@vrticos/i18n` `pushPayload` + tests (3). Push texts live in i18n (shared, UI-free), not domain. |
| D4-B | Announcements: tables, audience at read time, publish/edit/archive RPCs with revisions and audit, fan-out | pgTAP AC-07-1/2/3, NEG (educator publish, other kindergarten, guardian of another group, after transfer), integration | **Done 2026-11-15:** `20261116120000_announcements.sql`; pgTAP 25 (43; mutation → 4 fail); integration `announcements.test.ts` (3). |
| D4-C | Admin: announcements list, editor with warning, publish, edit, archive, revisions | e2e | **Done 2026-11-15:** `/[org]/announcements`, server actions over the D4-B RPCs, Zod schemas (3 tests), e2e flow (11/11). |
| D4-D | Mobile: notification centre (list, unread, open resource under RLS, "no longer available"), announcements, push preferences per type | render tests, Expo export | **Done 2026-11-15:** destination "Obavijesti" (guardian and educator), announcement view, absence reports for educators, push preferences in the profile; render tests 6; Expo export iOS + Android. |
| D4-E | Daily overview: table, RPCs (draft, publish, same-day edit), RLS; mobile educator editor and guardian view; fan-out | pgTAP AC-10-1/2 + NEG, integration, render | **Done 2026-11-15:** `20261116130000_daily_entries.sql` (one RPC `save_daily_entry`), pgTAP 26 (28; mutation → 1 fail), integration `daily-entries.test.ts` (1), render 5; Parent Home "Danas" now shows real activities. Technical: fixed tag list (the prototype's four) until an organization list exists. |
| D4-F | Conversations: tables, `can_access_conversation`, open/send/withdraw RPCs, participants view; mobile for guardians and educators; managers denied | pgTAP AC-11-1/2/3 + NEG, integration, render | **Done 2026-11-15:** `20261116140000_conversations.sql`, pgTAP 27 (36; mutation → 4 fail), integration `conversations.test.ts` (2), render 5. Response hours not shown (Q-T05). |
| D4-G | Docs, NEG coverage, privacy (DI-07, DI-17…19), subprocessor register unchanged (no push provider), risks, closure | CI green |

## 6. Out of scope for D4 (recorded, not built)
Push delivery and device tokens (D-40); quiet period (Q-T05 with D-40); read receipts (Q-T15); attachments, photos,
comments, polls, scheduled announcements (FS-07 out of scope); menu and calendar (FS-12/13).
