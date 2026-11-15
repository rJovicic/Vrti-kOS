# D3 — Attendance and absences: specification and implementation plan

- Version: 0.1 · Date: 2026-11-15 · Status: **in progress** (owner instruction 2026-11-15: start D3 right after D2-I).
- Scope source: FS-05 (FR-05-1…10), FS-06 (FR-06-1…8), AC-05-1…8, AC-06-1…6, SR-AUTHZ-12, SR-API-08, SR-MOB-02,
  ADR-0012 (offline queue, accepted for the local demo, D-20), database-schema §5.14–5.15, mobile-app.md §4–5.
- Builds on D2: `educator_child_ids()`, `guardian_child_ids(flag)` (restriction-aware), `pickup_authorizations`,
  `child_guardians`, `org_today()`, audit with actor role, catalogued error codes.

## 1. Non-negotiables (same as D2)
1. Every new table: `organization_id`, RLS, grants, guard trigger, audit, negative pgTAP in the same change.
2. Exposed RPCs are SECURITY INVOKER (SR-API-01); a write that clients may not do directly goes through a `private`
   definer function that authorizes first.
3. No reason field and no free text for absences (FR-06-2, Q-P16). No staff name shown to guardians (FR-05-9).
4. Offline queue holds IDs, kind, time and keys only; encrypted at rest; wiped on sign-out after a warning (SR-MOB-02).
5. Synthetic data only; no push sending in D3 (FS-08 is a later layer — see §6).

## 2. What the existing documents already decide (implemented as written)
| Topic | Rule | Source |
|---|---|---|
| Event model | Append-only `attendance_records` (`check_in`, `check_out`, `void`); corrections are new rows referencing the original | schema §5.14 |
| Undo | Same recorder, within 10 s, no reason → `void` | FR-05-5, AC-05-4 |
| Later correction | Reason category (`entry_error`, `forgot`, `other`), original stays, audited | FR-05-5, SR-AUTHZ-12, AC-05-4 |
| Educator scope | Insert only for children in `educator_child_ids()` and `local_date = org_today` → educators correct only today | schema §5.14 RLS, AC-05-8 |
| Past days | Read-only for educators; managers correct with reason | FR-05-10, AC-05-8 |
| Idempotency | `unique (organization_id, idempotency_key)`; a replay returns the stored event | SR-API-08, AC-05-2 |
| Double entry | Check-in only from *expected/absent*, check-out only from *present*; concurrent writers serialized per child | FR-05-2, FR-05-8 |
| Conflict | Resolved by `occurred_at`; the second writer gets a warning, not silent loss. Implemented as one sequence rule (events ordered by `occurred_at` must alternate arrival → departure); a write that would break it is refused with `ATTENDANCE_STATE_CONFLICT` and the app shows the current state | FR-05-8 |
| Reported absence | Visible in the list; check-in of a child with an absence asks for confirmation | FR-05-7, AC-05-7 |
| No "all present" | Not offered | FR-05-6 |
| Guardian view | "U vrtiću od 7:42" / "Otišlo u 15:10", no staff identity; only children with `can_view` and no restriction | FR-05-9, AC-05-6 |
| Absence report | Guardian with `can_report_absence`; inclusive dates; summary, then "Prijava je poslana vrtiću" | FR-06-1…3, AC-06-1 |
| Absence limits | Start at most 30 days ahead; length at most 30 days (`[pretpostavka, Q-T14]`, schema check) | FR-06-1, schema §5.15 |
| Cancel | Future days only; history stays (split: the past part remains active) | FR-06-4, AC-06-4 |
| Who sees absences | Educators assigned to the child's group in that period, managers, other guardians with `can_view` | FR-06-5, FR-06-6 |
| On behalf | Managers (`source = staff_on_behalf`); educators **not** (open N-10/H-04 → denied) | FR-06-7, AC-06-5 |
| Late report | Organization setting `absence_cutoff_local` (exists, nullable); null = never late | FR-06-8, AC-06-6 |

## 3. Decisions needed from the owner (work continues around them)
| ID | Question | Why it is open | Effect until decided |
|---|---|---|---|
| **D-38** | Is a guardian whose link has an active access restriction offered as the handover person? AC-05-3 says no ("ako nisu ograničeni"); D-33 says a restriction is not an automatic pickup ban and handover rules are decided in D3. Options: (a) not offered (AC-05-3); (b) offered with the "Ograničeno" mark, the educator decides by the kindergarten procedure; (c) offered like any guardian | The two owner-facing sources conflict | Handover selection (D3-H) is built last; everything else proceeds |
| D-39 (existing open, matrix §9) | Educator correction deadline beyond "same day" | Matrix footnote "opseg treba potvrditi" | Implemented as documented: educators same day only (schema RLS), managers any day |
| Q-T14 (existing) | Same-day cut-off value and the 30-day horizon | Kindergarten input | Setting stays per organization (null by default); 30/30 limits as documented assumption |
| N-10/H-04 (existing) | May educators record absences on behalf? | Validation | Denied |

## 4. Data model (one migration per package)
- `attendance_records` exactly as schema §5.14, plus `void` only through the undo/correction RPCs. Read model
  (implemented as `api.child_day_status`, D3-C) — per child and local date: status (`expected|absent|present|departed`),
  arrival and departure time, and for staff the source; `recorded_by` never exposed to guardians.
- `absence_records` exactly as schema §5.15; cancel = set `status = cancelled` for a not-yet-started record, or shorten
  `ends_on` to yesterday and keep the past part (split), via RPC.

## 5. Work packages (order, acceptance)
| Package | Content | Acceptance |
|---|---|---|
| D3-A | `attendance_records` + RPCs `record_attendance`, `undo_attendance`, `correct_attendance` + state machine, idempotency, per-child lock, `local_date` | pgTAP: RLS matrix, NEG-01/03/05/07/08/10, idempotency, double entry, undo window, correction rules; integration through the API | **Done 2026-11-15:** `20261115100000_attendance_records.sql`, pgTAP 19 (53), integration `attendance.test.ts` (6, incl. two educators at once). Also `api.record_missed_attendance` (FS-05 edge case: forgotten departure, manager next day). |
| D3-B | `absence_records` + RPCs `report_absence`, `cancel_absence`, `record_absence_on_behalf`; late flag | pgTAP: NEG-04 (missing flag), NEG-05, AC-06-3, split cancel; integration | **Done 2026-11-15:** `20261115110000_absence_records.sql`, pgTAP 20 (44), integration `absences.test.ts` (6). Technical: start today or later; no overlapping active reports; educators read via today's group scope. |
| D3-C | Read model `attendance_day` for staff and guardians (status, times; no recorder for guardians) | pgTAP: guardian sees status without `recorded_by`; restricted guardian nothing | **Done 2026-11-15:** implemented as `api.child_day_status(day, group)` (a function, not a view: guardians must not read event rows), `20261115120000_child_day_status.sql`, pgTAP 21 (24), integration case in `attendance.test.ts`. Statuses: expected, absent, present, departed, not_enrolled. |
| D3-D | Mobile educator attendance screen (online): list per group, one tap, undo 10 s, absence confirmation, conflict warning, states | render tests; Expo export | **Done 2026-11-15:** render tests 10 + unit 3, Expo export iOS + Android. See mobile-app.md §4. |
| D3-E | Offline queue (ADR-0012): encrypted, IDs only, replay with server re-authorization, wipe on sign-out with warning | unit + render tests; AC-05-5 | **Done 2026-11-15:** domain queue (7 unit), mobile adapter (`lib/attendanceQueue.ts`), screen integration, sign-out warning; render tests 6 offline cases. Storage: chunked SecureStore instead of expo-sqlite (ADR-0012 note). |
| D3-F | Guardian mobile: status on Parent Home and child view; absence report and cancel flow | render tests |
| D3-G | Admin: attendance by group and day, corrections with reason, absence on behalf | e2e |
| D3-H | Handover person selection (after D-38) | pgTAP + render |
| D3-I | Docs, NEG coverage, privacy (DI-14…16), risks | CI green |

## 6. Out of scope for D3 (recorded, not built)
Push notifications for absences (FS-08, FR-06-5 second half) — no notification table or push provider exists yet;
reports and exports (FS-14); QR/NFC, geolocation, billing (FS-05 out of scope).
