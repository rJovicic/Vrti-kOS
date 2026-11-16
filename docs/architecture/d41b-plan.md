# D-41b — historical correction of a child's relationships (final technical plan, NOT implemented)

**Status:** plan only (owner, 2026-11-16: "D-41b zasad ostaje na razini tehničkog plana"). No migration, RPC or UI
exists. Implementation needs a separate approval.

**Decisions this plan implements:** D-41 (corrections only through a separate, explicitly authorised, audited
operation), Q-T17 (director and org_admin of the own kindergarten, MFA/AAL2, never platform_admin), Q-T18 (mandatory
structured reason code **and** mandatory free-text note; no arbitrary limit on how far back; existing records only;
previous and new state, actor, time, kindergarten, reason and affected records recorded; never usable to hide or delete
history), Q-T21 (enrolments included, same rules). Regular operations stay as D-41a made them.

## 1. Scope

| Record | Correctable fields | Not correctable |
|---|---|---|
| `enrollments` | `valid_during` | child, group, organisation |
| `child_guardians` | `valid_during` | child, guardian, rights flags (rights apply from now — regular operation) |
| `access_restrictions` | `valid_during` | link, scope, reference (regular operation) |
| `pickup_authorizations` | `valid_during`, `first_name`, `last_name` (D-41a blocks renaming once valid) | child |

Never possible through this operation: creating a record in the past, deleting a record, emptying a period, moving a
record to another child, group, guardian or kindergarten. A correction that only touches today or the future is refused
(`CORRECTION_NOT_HISTORICAL`) — that is a regular operation, so the two paths stay separate.

## 2. Database and API

### 2.1 Table `public.history_corrections` (append-only)
`id`, `organization_id`, `child_id`, `record_type` (`enrollment` | `child_guardian` | `access_restriction` |
`pickup_authorization`), `record_id`, `old_values jsonb`, `new_values jsonb` (only the corrected fields:
`valid_during`, and for pickups the names), `reason_code public.history_correction_reason`, `note text` (trimmed,
10–1,000 characters), `corrected_by uuid`, `corrected_role public.org_role`, `aal text`, `corrected_at timestamptz`,
`correlation_id text`, `affected jsonb` (ids and counts of dependent records checked, §2.4), `supersedes uuid null`
(a later correction of the same record points to the earlier one).

- FK composite to `organizations`, `children`; `unique (organization_id, id)`.
- **No client privileges** except `SELECT` for managers; no `UPDATE`/`DELETE` for anyone (also blocked by a trigger, so
  even the owner role cannot change a row without dropping it — tested in the catalog).
- RLS select: `private.is_org_manager(organization_id)` (org_admin or director with AAL2). Educators, guardians, platform
  admin, other kindergartens: nothing.
- Sensitivity **R4**: the note may name people or circumstances. The admin form warns not to enter health or
  court-document content; the note is never copied to `audit_events`, logs or notifications. Retention follows R-53 /
  Q-P09 (to be decided); data inventory and DPIA get a row before the migration ships.

### 2.2 Reason codes (`public.history_correction_reason`)
`entered_in_error`, `wrong_date_recorded`, `authority_document` (court/social services document received later),
`late_information`, `other`. The note is mandatory for every code (Q-T18).

### 2.3 RPC
`api.correct_relationship_history(p_record_type text, p_record_id uuid, p_new_valid_during daterange,
p_reason_code public.history_correction_reason, p_note text, p_new_first_name text default null,
p_new_last_name text default null) returns uuid` — SECURITY INVOKER wrapper around
`private.correct_relationship_history(...)` (SECURITY DEFINER, `search_path = ''`), not executable by `anon`.

Order inside one transaction:
1. **Authorise first:** caller has an active `org_admin` or `director` membership in the record's kindergarten and AAL2
   (`private.is_org_manager`). Platform admins have no membership → refused. Unknown id, record of another kindergarten
   and missing rights all answer `PERMISSION_DENIED` (42501), so existence is not revealed.
2. Lock the child (`select … for update`, as `private.lock_child_for_manager`) and the target row.
3. Validate input: reason code present; note 10–1,000 characters after trim; new period non-empty; at least one field
   changes; the change touches a day before today (else `CORRECTION_NOT_HISTORICAL`).
4. Validate consistency with the rest of the model (each its own error code): D-35 (nothing valid after a withdrawn
   child's last day), enrolment exclusion constraint (no overlapping enrolments), restriction inside its link's period,
   pickup names follow the D-34 format.
5. **Dependency check — no hiding history (Q-T18):** the correction is refused (`CORRECTION_CONFLICTS`, with counts only)
   if it would remove days on which dependent records exist:
   - enrolment: attendance records of the child in that group on removed days;
   - guardian link: absence reports made by that guardian for the child, and handovers by that link, on removed days;
   - pickup authorization: handovers by that person on removed days.
   Restrictions have no dependent records (they decide access only). Extending a period is never blocked.
6. Write `history_corrections` (old and new values, actor, role, AAL, time, kindergarten, reason, note, correlation id,
   affected), then update the row. The D-41a trigger does not fire for the definer (owner role) — §2.5 shows why this is
   not a bypass.
7. One summary audit event `history.corrected` (record type and id, correction id, reason code, changed column names, old
   and new dates — **no note, no names**). The per-row audit trigger also records the update (column names only).
8. Any failure rolls back everything (tested with an injected failing trigger, as in D-37).

### 2.4 Effect on access rights
Access is always computed from the current rows for **today**, so a correction acts on the next request:
- a period corrected to include today grants or keeps access today; one corrected to exclude today removes it;
- corrections that only change past days do not change anyone's access today, but they change what the record says
  about the past (who was linked, enrolled, restricted or authorised on which day) — which is exactly why they need the
  audit, the note and the dependency check;
- nothing already recorded (attendance, absences, handovers, messages, notifications) is changed or deleted.

### 2.5 No bypass
- D-41a stays: every client write that changes a past day is refused, whatever the role.
- The only definer functions allowed to write these four tables are listed in a catalog test (transfer, withdrawal,
  D-37 cancellation, and the new correction function); a new definer function writing them fails the test until it is
  reviewed and added.
- `history_corrections` cannot be written by clients; the RPC is the only way in.

## 3. Admin UI (later approval)
On the child record, per record: a separate, clearly marked action **„Ispravak povijesti”** behind a disclosure (not in
the regular edit forms). It shows the current and the proposed period side by side, the reason code (select), the note
(textarea, with the warning about personal and health data), a confirmation checkbox stating that the change rewrites
the record of the past, and the result with the correction reference. Each record lists its corrections (date, actor
role, reason; the note visible to managers only). Server Action through the DAL (`getOrgContext`: claims, manager role,
AAL2); the database decides again.

## 4. Tests (all must pass before closing R-54)
**pgTAP (new file):**
- catalog: table RLS, no client write privileges, append-only trigger, RPC invoker / definer with fixed `search_path`,
  not executable by `anon`, the list of definer functions writing the four tables;
- authorisation: guardian, educator, manager without MFA, platform admin, manager of another kindergarten → refused; unknown
  and foreign id → same answer; org_admin with MFA and director with MFA → allowed;
- input: missing reason, note missing / too short / too long / whitespace, empty period, no change, change only today or
  future → refused;
- consistency: D-35, overlapping enrolments, restriction outside its link, invalid names → refused;
- dependencies: removing days with attendance / absence / handover rows → `CORRECTION_CONFLICTS`; extending → allowed;
- recording: one `history_corrections` row with old and new values, actor, role, AAL, reason, note, affected; one audit
  event without note or names; `supersedes` chain on a second correction;
- immutability: `UPDATE`/`DELETE` on `history_corrections` refused for every role (also as owner through the trigger);
- access: corrected period applied on the next request (guardian sees / loses the child, educator sees / loses);
- atomicity: injected failure after the correction row → nothing written, row unchanged;
- regular path still closed: a direct `UPDATE` of a past day stays refused after the RPC exists;
- **mutation checks:** drop the role check, the AAL2 check, the dependency check, the note check → tests fail.

**Integration (PostgREST):** the same refusals for guardian, educator, manager without MFA, other kindergarten; a correction
by a director with MFA; audit contents without the note.

**e2e (admin):** correction flow from the child record with reason and note; refusal shown for a conflicting correction;
corrections listed on the record.

## 5. Rollback strategy
- Data: corrections are never deleted. A wrong correction is undone by another correction that `supersedes` it, with
  its own reason and note — the history of corrections stays complete.
- Feature: the operation can be switched off without losing data by revoking `EXECUTE` on the API wrapper (one-line
  migration) and hiding the admin action; existing rows stay readable.
- Schema: forward-only migrations (no down migrations in this project); removing the feature later means a new migration
  that revokes the RPC and keeps the table for its retention period.

## 6. Order of work when approved
1. Migration: enum, table, append-only trigger, RLS, grants, function and wrapper, error codes and Croatian messages.
2. pgTAP file with mutation checks; integration test.
3. Admin UI with e2e; data inventory, DPIA note, security test plan, traceability.
4. CI green; then R-54 can be closed with evidence.
