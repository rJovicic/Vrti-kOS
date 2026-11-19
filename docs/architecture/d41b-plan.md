# D-41b — historical correction of a child's relationships (final technical plan, NOT implemented)

_Revised 2026-11-19 after the D-41a review: pickup names (§1.1), locking (§2.6), RLS (§2.7), same-day errors (§7)._

**Status:** **implemented 2026-11-19** (owner approval of the same day): migration `20261119120000_history_corrections.sql`,
locks in `20261119100000_child_event_lock.sql`, admin panel „Ispravak povijesti”, tests in pgTAP 33, `pnpm db:concurrency`,
`tests/integration/src/history-corrections.test.ts` and admin e2e. §7 (same-day errors) is implemented separately as Q-T22.

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
| `pickup_authorizations` | `valid_during`; `first_name`, `last_name` **only under §1.1** | child |

### 1.1 Pickup person names — history of events must not change
Attendance records store only the id of the handover person (`handover_pickup_id`, `handover_child_guardian_id`); every
screen reads the **current** name from `pickup_authorizations` / `guardians` (`apps/admin/src/lib/attendanceDay.ts`,
`private.handover_list`). A rename therefore rewrites who is shown as having picked a child up in the past. Rule:

- a name correction is allowed **only if no attendance record references the authorization** (any day, also voided
  ones) — then nothing recorded changes its meaning; otherwise refused with `CORRECTION_NAME_IN_USE`;
- if the person was recorded under a wrong name, history stays as recorded: the manager ends the authorization as of
  today (regular operation) and enters the correct person from today; the correction row may document the error
  (`reason_code`, `note`) without changing any name (`new_values` = old values is refused, so this is done with a
  period-only correction if needed, otherwise only by the regular end + new entry);
- rejected alternative: storing a name snapshot on each attendance event — it changes the attendance model (D3) and
  needs its own decision; it would make renames safe later.

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
- **No client privileges** except `SELECT` for managers; no `UPDATE`/`DELETE`/`TRUNCATE` privilege for any application
  role. A trigger additionally refuses them in every normal session, the table owner's included (tested). **Trust
  boundary:** the table owner can disable or drop the trigger and a superuser can bypass triggers — this protects
  against the application, not against a privileged database operator (see §2.8).
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

### 2.6 Transactions and locking
- One function call = one transaction (default READ COMMITTED). Lock order, the same as transfer/withdrawal to avoid
  deadlocks: child row `FOR UPDATE` → target row `FOR UPDATE` → for a restriction its link `FOR SHARE`.
- **Companion change (part of D-41b):** the writers of dependent records do not lock the child row today. Attendance
  writers (`private.record_attendance`, `undo_attendance`, `correct_attendance`, `record_missed_attendance`) only take a
  per-child-per-day advisory lock (`private.attendance_lock`); absence writers (`private.absence_insert`,
  `cancel_absence`) take none. Each gets `select 1 from public.children where id = … for share` before writing, so a
  dependency check (§2.3 step 5) cannot pass while a dependent row for a removed day is inserted concurrently. Taking
  the advisory lock for every removed day instead was rejected (a correction can span years). Cost: one shared row lock
  per write; transfer and withdrawal already lock the child `FOR UPDATE`, so the order stays child-first.
- Checks run after the locks; the correction row, the update and the audit event commit together or not at all.

### 2.7 RLS and grants
- `history_corrections`: RLS on; one policy `select … using (private.is_org_manager(organization_id))`; no insert,
  update or delete policy; `revoke all` from `anon`, `authenticated`; `grant select` to `authenticated`. Rows are
  written only by the definer function (owner role).
- Append-only triggers `before update or delete` and `before truncate` → `HISTORY_CORRECTION_IMMUTABLE` in every normal
  session (application roles and the table owner); not effective against an owner/superuser who disables or drops them.

### 2.8 Trust boundary of the evidence
What is guaranteed: no application role (`anon`, `authenticated`, `service_role`) can change or delete a correction
(no privilege, plus the trigger), only managers of the kindergarten with MFA read it, and the note never leaves the table.
What is not: a privileged database operator (table owner `postgres`, superuser) can `ALTER TABLE … DISABLE TRIGGER`,
`DROP TRIGGER` or set `session_replication_role = replica` and then change rows. Detecting that would need an external,
append-only audit sink (e.g. write-once storage or a separate log service outside the operator's control) or another
separate architecture — not built; it needs the owner's approval, a processor decision and a DPIA update.
- `api.correct_relationship_history` executable by `authenticated` only; the definer is not executable by clients.
- The note never leaves this table: not in `audit_events.details`, logs, notifications or push payloads.

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
- immutability: `UPDATE`/`DELETE`/`TRUNCATE` on `history_corrections` refused for client roles (privilege) and in a normal
  owner session (trigger); the operator boundary of §2.8 is documented, not tested;
- access: corrected period applied on the next request (guardian sees / loses the child, educator sees / loses);
- atomicity: injected failure after the correction row → nothing written, row unchanged;
- regular path still closed: a direct `UPDATE` of a past day stays refused after the RPC exists;
- **mutation checks:** drop the role check, the AAL2 check, the dependency check, the note check → tests fail.

- pickup names: rename refused when any attendance record references the authorization (also voided), allowed
  otherwise; after a refused rename the handover still shows the recorded name;
- locking: the attendance and absence writers take the shared child lock (catalog/function-body check), plus an
  integration test with two connections — a correction removing day X and an attendance correction on day X — must end
  with exactly one of them succeeding;

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

## 7. Related gap found in the D-41a review (2026-11-19) — needs an owner decision, not part of D-41b
A record entered **today by mistake** (pickup person, guardian link, restriction, enrolment) cannot be withdrawn with
effect today: an empty period is refused by the table constraint, moving the start back is refused by D-41a, and D-37
cancels only records starting after today (`RECORD_ALREADY_EFFECTIVE`). The earliest end is "valid through today". For a
link, switching off `can_view` removes access immediately; for a **pickup person there is no same-day remedy** — the
person stays on today's handover list. D-41b does not solve it either (it only changes past days and never empties a
period). Options: (a) extend D-37 to records starting today **if no dependent record exists yet** (same audit, reason
codes and MFA); (b) accept and handle by kindergarten procedure. Recommendation: (a). Tracked as R-58 / Q-T22.

