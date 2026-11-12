# D2 — Children, enrolments and guardians: specification and implementation plan

- Version: 0.1 · Date: 2026-11-12 · Status: **ready to implement after D-27 is confirmed** (D-28 approved by the owner on
  2026-11-12 on that condition). Nothing in this document is implemented yet.
- Scope source: FS-04 (FR-04-1…10), FR-01-1 (guardian invitations), AC-04-*, NEG-03…08, NEG-10, NEG-11, NEG-14.
- Builds on: [database-schema.md](database-schema.md) §5.7–5.12 (Phase 3 sketch), ADR-0004/0005/0014/0017, D1 code
  (invitations, guard triggers, audit schema, error catalog, mobile shell).

## 1. Non-negotiable rules for every D2 change
1. **Security ships with each table.** Every new tenant table arrives in one migration with:
   - `organization_id` NOT NULL and composite FKs `(organization_id, …)`;
   - RLS enabled and its policies;
   - explicit grants (anon: none; authenticated: only what the policies need; no DELETE);
   - `guard_tenant_columns`, `touch_updated_at` and `audit_row` triggers;
   - its pgTAP file, including the negative tests listed in §7.

   No "harden later" follow-ups.
2. Authorization is decided in Postgres (RLS + definer helpers with pinned `search_path`). The apps only choose what to
   show.
3. No new personal data beyond §3. No date of birth, OIB, address, photo or health data (D-9, Q-P03 ⚖️).
4. Every new database exception name goes into `dbErrorCatalog` and every new public code into `errorCatalog` with a
   Croatian message. `catalog.test.ts` enforces this.
5. Synthetic data only. The seed generator gets children and guardians with fictional names.

## 2. Decisions that shape the model — status
| Topic | Effect on D2 | Status / proposal |
|---|---|---|
| Q-P03 minimum child data | `children` holds first name, last name and optional `internal_ref` only | **Assumed** (FR-04-1). Any extra field needs owner + legal decision |
| Q-P05 identity check before inviting a guardian | The system cannot verify identity; the kindergarten checks it before entering the e-mail | **Open ⚖️**. D2 records who invited (`created_by`) and requires AAL2; no eID |
| FR-04-8 / Q-T13 pickup persons | Name + validity only; no phone or relationship; edited by managers only | **Assumed**; guardian editing stays out of D2 |
| FR-04-5 restriction scopes | Only `full` scope in D2 (blocks the guardian link completely) | **Assumed**; partial scopes later |
| Educator view of guardians (handover, FR-05-3) | Educators see guardian **names and flags** of children in their groups today; no contact data | **Proposed**. Needed by D3; confirm with kindergartens |
| Q-T04 CSV import | Out of D2 | Should; later |
| Guardian across kindergartens | One `guardians` row per kindergarten, linked to the same `profile_id`; no cross-tenant join | **Decided by model** (tenant isolation) |
| Withdrawn children, retention | `status = withdrawn`, no deletion; retention job is R-53 / Q-P09 | **Open** (R-53 stays open) |
| Guardian invitation timing | Manager creates guardian + link first, then invites; acceptance attaches `profile_id` | **Proposed** (§5) |
| Suspension rule | Unchanged: suspension is per membership (kindergarten + person + role), ADR-0017 | **Accepted** (D-26) |

Owner decisions still needed before or during D2 (none blocks starting with D2-A):
- **D-31:** educator visibility of guardian names and flags (proposal above).
- **D-32:** whether a guardian invitation may be sent before the child is enrolled in a group (proposal: yes; the
  guardian then sees the child without a group).

## 3. Data model (one migration per work package)
| Table | Columns (beyond `id`, `organization_id`, `created_by`, `created_at`, `updated_at`) | Key constraints |
|---|---|---|
| `children` | `first_name` (1–60), `last_name` (1–60), `internal_ref` (≤40, null), `status` (`active|withdrawn`), `withdrawn_on` | UQ `(organization_id, id)`; UQ `(organization_id, internal_ref)` where not null; check `withdrawn_on` iff `withdrawn` |
| `enrollments` | `child_id`, `group_id`, `valid_during daterange` | composite FKs to `children`, `groups`; EXCLUDE `(child_id =, valid_during &&)` (one group at a time) |
| `guardians` | `profile_id` (null until accepted), `first_name`, `last_name`, `status` (`active|ended`) | UQ `(organization_id, profile_id)` where not null; **no e-mail or phone** |
| `child_guardians` | `child_id`, `guardian_id`, `can_view`, `can_report_absence`, `receives_messages`, `valid_during` | composite FKs; EXCLUDE `(child_id =, guardian_id =, valid_during &&)` |
| `access_restrictions` | `child_guardian_id`, `scope` (`full`), `valid_during`, `reference` (≤100, no reasons, no court text) | composite FK to `child_guardians`; sensitivity R4 |
| `pickup_authorizations` | `child_id`, `first_name`, `last_name`, `valid_during` | composite FK to `children` |
| `invitations` (change) | + `guardian_id` null | composite FK; check `role = 'guardian'` iff `guardian_id` not null |

Helpers (SECURITY DEFINER, `search_path = ''`, EXECUTE only for `authenticated`, STABLE):
- `private.educator_child_ids()`: children with an enrolment valid today in a group the caller is assigned to today
  (regular or substitute, `staff_assignments`), active educator membership.
- `private.guardian_child_ids(p_flag text)`: children linked to the caller's guardian rows (active guardian, active
  guardian membership, link valid today, flag true, **no active restriction**). The restriction always wins (FR-04-5).
- `private.guardian_ids_for_educator()`: guardians linked to `educator_child_ids()` (handover, if D-31 is accepted).

## 4. Access matrix (RLS) — what the pgTAP tests prove
| Table | Manager (AAL2) | Educator | Guardian | Platform admin | anon |
|---|---|---|---|---|---|
| children | S/I/U own org | S `educator_child_ids()` | S `guardian_child_ids('can_view')` | — | — |
| enrollments | S/I/U (transfer via RPC) | S for own groups today | S for own children | — | — |
| guardians | S/I/U | S names of handover guardians (D-31) | S own row | — | — |
| child_guardians | S/I/U | S flags for own children (D-31) | S own rows only | — | — |
| access_restrictions | S/I/U **only** | — | — (never, not even own) | — | — |
| pickup_authorizations | S/I/U | S for own children | S for own children (`can_view`) | — | — |

D (delete) is never granted: end with `valid_during` or `status`. A guardian never learns about other guardians, other
children or group size (FR-04-9).

## 5. Write paths
- **Simple writes** go through PostgREST as the manager (RLS + column grants + guard triggers): create child, guardian,
  pickup authorization, restriction, and flag changes.
- **RPCs** (`api` schema, SECURITY INVOKER, one transaction each):
  - `api.transfer_child(child, new_group, on_date)` closes the old enrolment and opens the new one (FR-04-2);
  - `api.withdraw_child(child, on_date)` closes the enrolment, links and pickup authorizations and sets `withdrawn` (FR-04-3).
- **Guardian invitation** (FR-01-1): `invite-member` gets an optional `guardianId`. The guard checks:
  - the guardian belongs to the same kindergarten;
  - the role is `guardian`;
  - the R-50 limit and the R-48 suspension rule apply unchanged.

  `api.accept_invitations` additionally sets `guardians.profile_id` for a guardian invitation. If that guardian is
  already linked to a different profile, nothing is linked and the attempt is audited as denied.
- **Audit:** `audit_row` triggers on all six tables (role and correlation id come from R-51). Restriction changes are
  also covered by the per-row audit. No content values are written, only column names.
- **New error codes** (catalogued when implemented): `ENROLLMENT_OVERLAP` (409), `CHILD_WITHDRAWN` (409),
  `GUARDIAN_ALREADY_LINKED` (409). Each gets a Croatian message.

## 6. App flows
**Admin (web, managers, AAL2):**
- children list and form: create, edit name, internal reference;
- enrol, transfer, withdraw;
- guardians: create, link to a child with flags and validity, send the invitation;
- restrictions: managers only, with a confirmation step, no free-text reasons;
- pickup persons.

Each screen follows `admin-app.md`, using flash codes from the catalog.

**Mobile, guardian:**
- Parent Home reads the authorized children (`children` + current enrolment + group + facility) and fills the
  existing `GuardianHomeScreen` model. States: `loading`, `empty`, `error`, `success`; attendance stays
  `unavailable` until D3.
- Child detail: group, facility, pickup persons (read-only).

**Mobile, educator:** "Danas" gets the children list of each group (names only). Attendance follows in D3.

All loaders send one correlation id per user action (as in D1) and treat 401 as session expiry.

## 7. Tests that must exist before a work package is done
- **pgTAP, per table:**
  - RLS on; grants; anon nothing;
  - cross-tenant reads and writes (NEG-01);
  - NEG-03 guardian without a link, NEG-04 missing flag, NEG-05 active restriction (and the other guardian does not
    see it), NEG-06 expired link;
  - NEG-07/08 educator outside their group, after the end of the schedule and after a transfer;
  - NEG-10 platform admin reads no child;
  - NEG-11 a guardian cannot change their own flags;
  - exclusion constraints;
  - audit rows with `actor_role`.
- **Integration:**
  - the full guardian flow: manager creates child + guardian + link → invite → sign in → accept → the guardian sees
    exactly that child; after a restriction, nothing;
  - transfer and withdraw RPCs;
  - limit and suspension rules still hold for guardian invitations.
- **Admin e2e:** child, enrolment, guardian, invitation, restriction.
- **Mobile render tests:** Parent Home with children, empty and error states; the guardian sees no other child;
  the educator group list.

## 8. Work packages (order, acceptance)
| ID | Package | Done when |
|---|---|---|
| D2-A | `children` + `enrollments` + helpers `educator_child_ids()` | migrations from zero; pgTAP NEG-01/07/08/10 green; seed has synthetic children |
| D2-B | `guardians` + `child_guardians` + `guardian_child_ids()` | pgTAP NEG-03/04/06/11 green |
| D2-C | `access_restrictions` (manager only) | pgTAP NEG-05 green; restriction wins over flags immediately |
| D2-D | `pickup_authorizations` | pgTAP read matrix green |
| D2-E | RPCs `transfer_child`, `withdraw_child` + error codes | pgTAP + integration green; catalog test green |
| D2-F | Guardian invitation and acceptance link | integration flow in §7 green; R-48/R-50 tests still green |
| D2-G | Admin screens | e2e green; build green |
| D2-H | Mobile Parent Home with real data, child detail, educator group list | render tests green; Expo export green; R-44 check on a device still required |
| D2-I | Docs, risks (NEG coverage), privacy inventory (DI rows for children, guardians, restrictions, pickup) | docs updated; CI green |

Order: A → B → C → D → E → F → G/H in parallel → I. Each package is one or more small commits with CI green before
the next one starts. Estimate: about 2–3 working days of implementation and review for A–F, and 2 for G–H.

## 9. Risks specific to D2
- **Wrong guardian invited (Q-P05).** Mitigations: AAL2, audit, revocation; the guardian sees nothing until the link
  exists.
- **Restriction precedence regressions.** Every helper and RPC is covered by NEG-05 tests.
- **Performance of helpers on lists.** Indexes on `(child_id)` and `(guardian_id)`; `EXPLAIN` checked in pgTAP for
  the guardian home query (target p95 < 50 ms at DB level, database-schema §8).
- **R-53 (retention)** stays open: withdrawn children and ended links are kept until Q-P09 is decided.
