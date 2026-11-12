# API and business-logic conventions — VrtićOS

- Version: 0.1 · Date: 2026-11-10 · Phase: 3
- Applies to: PostgREST table access, `api` schema RPCs, Edge Functions, client data hooks.
- Related: [technical-architecture.md](technical-architecture.md) §4 · [database-schema.md](database-schema.md) ·
  [../security/security-requirements.md](../security/security-requirements.md) (SR-API, SR-EF, SR-AUD, SR-LOG)

## 1. Choosing the access path
| Need | Path | Example |
|---|---|---|
| Read lists/details | PostgREST `select` with explicit columns | `children?select=id,first_name,last_name` |
| Single-table write the caller is allowed to do | PostgREST insert/update | educator inserts `attendance_records` |
| Multi-step write in one transaction, caller authorized for every step | RPC `api.<verb>_<noun>` (`SECURITY INVOKER`) | `api.transfer_child`, `api.publish_announcement` |
| Needs Auth admin, email, external I/O, or a service key | Edge Function `<verb>-<noun>` | `create-invitation`, `accept-invitation` |

Never: `SECURITY DEFINER` functions in an exposed schema (SR-API-01); business rules only in the client.

## 2. Naming
| Element | Convention | Examples |
|---|---|---|
| Tables | plural `snake_case` | `child_guardians`, `attendance_records` |
| Columns | `snake_case`; FKs `<entity>_id`; booleans `is_/can_/has_`; times `_at`, dates `_on`/`_date` | `valid_during`, `published_at`, `starts_on` |
| RPCs | `api.<verb>_<noun>` | `api.transfer_child`, `api.cancel_absence`, `api.open_conversation` |
| Edge Functions | `<verb>-<noun>` (kebab) | `create-invitation`, `accept-invitation`, `revoke-invitation`, `create-organization` |
| Zod schemas | `z<Verb><Noun>Input` / `z<Entity>` in `packages/validation` | `zTransferChildInput` |
| Query hooks | `use<Entity>[s]`, mutations `use<Verb><Noun>` | `useGroupChildren`, `useRecordCheckIn` |
| Permission keys | catalog in roles-and-permissions §7 | `attendance.record` |
| Error codes | `DOMAIN_REASON` upper snake | `AUTH_REQUIRED`, `ATTENDANCE_DUPLICATE` |
| Audit actions | trigger-generated: `<table>.<insert\|update>`; Edge Functions: `<entity>.<event>` | `memberships.update`, `invitation.accepted` |

## 3. Input validation
1. **Client:** Zod schema from `packages/validation` validates forms before sending (UX only).
2. **Edge Functions:** the same Zod schema validates the request body; unknown keys rejected (`.strict()`).
3. **Database:** constraints (`check`, FKs, exclusion, lengths) are the final authority; RPCs validate arguments
   in SQL and raise typed errors.
4. Server-owned fields (`organization_id` of derived rows, `recorded_by`, `recorded_at`, `status` transitions,
   `approved_by`) are never trusted from input (SR-API-03).
5. Text: trim, NFC-normalize, reject control characters; length limits identical in Zod and SQL.

## 4. Error format
All non-PostgREST endpoints (RPC raises, Edge Functions) map to one envelope:

```json
{ "error": { "code": "ABSENCE_RANGE_TOO_LONG", "message": "absence.errors.rangeTooLong", "correlationId": "01J…", "fields": { "endsOn": "max_30_days" } } }
```
- `code`: stable, from the catalog in `packages/validation/src/errors.ts`; `message`: i18n key, never server prose.
- RPC errors: `raise exception using errcode = 'P0001', message = '<CODE>', detail = '<json fields>'`; the
  client adapter maps them. PostgREST errors (e.g. RLS `42501`) map to `PERMISSION_DENIED` **or** `NOT_FOUND`
  with the same response for "not allowed" and "does not exist" (SR-API-04).
- Never return SQL text, constraint names, stack traces or other users' data.

| HTTP | Codes (examples) |
|---|---|
| 400 | `VALIDATION_FAILED`, `ABSENCE_RANGE_TOO_LONG` |
| 401 | `AUTH_REQUIRED`, `AUTH_SESSION_EXPIRED` |
| 403 | `MFA_REQUIRED` (only when the caller already knows the resource exists, e.g. own org dashboard) |
| 404 | `NOT_FOUND` (also for forbidden resources) |
| 409 | `ATTENDANCE_DUPLICATE`, `ENROLLMENT_OVERLAP`, `INVITATION_ALREADY_USED` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL` (with correlation ID) |

**Implementation status after D1 (2026-11-11) — known deviations, to be corrected in a technical task (backlog D1-13):**
- The Edge Functions return codes that are **not in the `errorCodes` catalog**: `METHOD_NOT_ALLOWED` (405) and
  `INVITATION_PENDING_EXISTS` (409). `INVITATION_PENDING_EXISTS` has a Croatian message; `METHOD_NOT_ALLOWED` has none.
- `INVITATION_ALREADY_USED` is in the catalog but no code path returns it (accepting an already used invitation simply
  accepts nothing, ADR-0017).
- `invite-member` answers a denied insert with **403 `PERMISSION_DENIED`**, not `NOT_FOUND`. The answer is the
  same for an existing and a non-existing kindergarten, so no existence is revealed, but it differs from the wording above.
- §5: the compensation step **revokes** the invitation (no DELETE grant exists); idempotency by request key is not implemented.

## 5. Transactions
- One user command = one transaction: an RPC or a single PostgREST request. No client-side multi-request
  "transactions".
- Audit and notification rows are written **in the same transaction** by triggers, so they cannot diverge.
- Edge Functions that call Auth admin APIs and the DB use a compensation step (e.g. delete the pending invitation
  if the email send fails) and are idempotent by request key.

## 6. Idempotency
- Mutations that can be retried (attendance, absence report, message send, offline queue replays) carry an
  `idempotency_key uuid` generated on the client; unique constraint `(organization_id, idempotency_key)`.
- Duplicate submission returns the existing row (HTTP 200) — not an error.
- Edge Functions accept `Idempotency-Key` header; responses cached for 24 h in a small table (Phase 6).

## 7. Pagination, filtering, sorting
- Lists use **keyset pagination** on `(sort_column, id)`; page size default 30, max 100 (`db-max-rows` in
  PostgREST config, SR-API-06). Offset pagination only for admin tables under 1,000 rows.
- Filters are explicit allow-listed query params in hooks (`group_id`, `local_date`, `status`); no free-form
  PostgREST filter strings from UI state.
- Search: Postgres full-text with `unaccent` + simple config for Croatian names, within RLS.
- Every `select` names its columns (no `select=*`) to avoid accidentally pulling new sensitive columns.
- Counts: `count=exact` only where the caller may know the total (managers); never for guardian-facing lists.

## 8. Dates and time
- Store UTC; business days via `local_date` / `org_today()` in the org time zone; clients format with
  `Europe/Zagreb` via `packages/i18n`. Date ranges are half-open `[from, to)` in the DB; UI shows inclusive end dates
  and converts at the boundary (one helper in `packages/domain`, unit-tested).

## 9. Logging
- Edge Functions and the admin server log JSON lines: `level`, `msg`, `correlationId`, `fn`, `actorId` (UUID),
  `orgId`, `durationMs`, `outcome`. **Never** names, emails, message bodies, tokens, signed URLs, request bodies (SR-LOG-02).
- Correlation ID: generated by the client per user action (`x-correlation-id` header), propagated to RPC via
  `set_config('app.correlation_id', …)` and stored in `audit_events.correlation_id`.

## 10. Audit events
- Written by `private.write_audit(action, target_table, target_id, outcome, details)` — called from triggers and
  Edge Functions; `details` allow-lists keys (`changed_columns`, `reason_category`, `source`).
- Denied privileged attempts in Edge Functions are audited with `outcome = 'denied'` (ST-AUD-02). RLS denials on
  plain reads are **not** audited individually (volume); they are visible in API logs.
- Catalog of audited actions: [database-schema.md](database-schema.md) §7 and FR-09-1.

## 11. Client data layer rules
- All server state through TanStack Query hooks in each app's `data/` folder; query keys include
  `organizationId` so caches never mix kindergartens (T-TEN-07).
- On logout or organization switch: `queryClient.clear()` and wipe secure storage/offline queue (FR-01-10).
- Mutations invalidate precise keys; optimistic updates only for attendance (with rollback on error).
