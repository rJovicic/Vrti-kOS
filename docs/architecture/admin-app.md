# Admin app architecture — VrtićOS (Next.js)

- Version: 0.1 · Date: 2026-11-10 · Phase: 3
- Users: `org_admin`, `director` (same permissions in MVP, A-03) and `platform_admin` (organization setup only).
  Desktop-first, responsive down to tablet.
- Hosting: **local only** for the demo; production hosting stays open in ADR-0006 (Phase 3 addendum).

## 1. Stack and principles
Next.js App Router (16.x) · React Server Components for reads · Server Actions for mutations (Zod-validated) ·
`@supabase/ssr` with the **user's session in cookies** · TanStack Query only for interactive client widgets ·
`packages/tokens` CSS variables · i18next (`hr`).

Non-negotiable:
1. The server never holds the service/secret key; every query runs as the signed-in user under RLS (ADR-0006, SR-EF-01).
2. Pages with personal data: `dynamic = 'force-dynamic'`, `Cache-Control: no-store`, no static generation (SR-WEB-04).
3. All user-provided text rendered as text; no `dangerouslySetInnerHTML` (SR-WEB-01). Strict CSP with nonces,
   `frame-ancestors 'none'` (SR-WEB-02). Server Actions keep Next.js origin checks; cookies `Secure`, `SameSite=Lax` (SR-WEB-03).
4. MFA: after sign-in, managers must enroll/verify TOTP before any data route (AAL2 enforced in the DB as well, SR-AUTHN-07).

## 2. Route map

```
app/
  (auth)/sign-in · verify · mfa/enroll · mfa/verify
  (platform)/platform/organizations            platform admin: list/create organization, invite first admin
  (org)/[orgSlug]/
    page.tsx                    Pregled vrtića — today: attendance per group, reported absences, pending invitations
    facilities/                 Objekti — list, create, archive
    academic-years/             Pedagoške godine — create, activate, close, copy group structure (FR-02-5)
    groups/ · groups/[id]       Skupine — list, detail (children, staff)
    staff/ · staff/[membershipId]   Djelatnici — invite, roles, assignments, substitutes (FS-03)
    children/ · children/new · children/[id]    Djeca — minimal record, enrollment, transfer, withdraw (FS-04)
    children/[id]/guardians     Skrbnici djeteta — links, flags, access restrictions (manager only), invitations
    guardians/                  Skrbnici — directory of guardian records, invitation status
    children/[id]/pickup        Ovlaštene osobe za preuzimanje
    attendance/                 Dolasci — by day/group, corrections with reason (FS-05)
    absences/                   Izostanci — by period, record on behalf (FS-06)
    announcements/ · new · [id] Obavijesti — draft, publish, archive (FS-07)
    reports/attendance          Osnovni izvještaji — daily and monthly on-screen (FS-14, no export)
    settings/                   Postavke vrtića — quiet hours, absence cut-off, privacy notice version
    settings/access             Upravljanje pristupom — memberships, suspend, sessions info
    audit/                      Revizijski zapis (FS-09)
```

Organization context comes from the URL slug; every server call still filters by `organization_id` and RLS decides.
A manager of two kindergartens sees an org switcher; caches are keyed by org.

## 3. Feature → spec → permission
| Area | Spec | Permission keys |
|---|---|---|
| Pregled vrtića | FS-14 (Should) | `report.read` |
| Objekti, pedagoške godine, skupine | FS-02 | `location.manage`, `school_year.manage`, `group.manage` |
| Djelatnici | FS-03 | `membership.manage`, `staff_assignment.manage` |
| Djeca, skrbnici, preuzimanje | FS-04 | `child.manage`, `enrollment.manage`, `guardianship.manage`, `pickup_person.manage` |
| Dolasci, izostanci | FS-05, FS-06 | `attendance.read`, `attendance.correct`, `absence.manage` |
| Obavijesti | FS-07 | `announcement.publish` |
| Izvještaji | FS-14 | `report.read` |
| Postavke, pristup, audit | FS-01, FS-09 | `organization.manage`, `membership.manage`, `audit.read` |

Not in admin (by design): reading conversations (Q-T16), exports (FS-14), DSR tooling (Phase 12), menus/calendar (deferred).

## 4. Data patterns
- Reads in Server Components via `createServerClient` (user cookies) → typed queries from `packages/supabase-client`.
- Mutations: Server Action → Zod parse → PostgREST/RPC as user → `revalidatePath` → typed error envelope to the form.
- Privileged operations (invitations) → Edge Function with the user's JWT forwarded.
- Tables: server-side keyset pagination; filters in URL search params (allow-listed).

## 5. UX states
Every page: loading (streaming skeleton), empty (with next action), error (code → i18n message + correlation ID),
success toasts. Destructive or sensitive actions (withdraw child, access restriction, suspend membership) require a
confirmation dialog stating the effect ("Skrbnik odmah gubi pristup").

## 6. Testing
Vitest for actions/helpers; Playwright e2e against local stack + seed: manager flows (create child → link guardian →
invite → verify invitation email in Mailpit), negative checks (U1 cannot open Beta URLs), CSP header presence (ST-WEB-01).
