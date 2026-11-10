# Architecture Decision Records

Format: lightweight MADR. Status lifecycle: `Proposed` → `Accepted` / `Rejected` → `Superseded by ADR-XXXX`.
Only the owner moves an ADR to **Accepted**. An accepted ADR is changed only by a new ADR that supersedes it.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-modular-monolith-monorepo.md) | Modular monolith in a pnpm + Turborepo monorepo | Proposed |
| [0003](0003-backend-platform-supabase-eu.md) | Supabase (EU region) as backend platform | Proposed |
| [0004](0004-multi-tenancy-rls.md) | Shared-schema multi-tenancy enforced by RLS | Proposed |
| [0005](0005-authorization-model.md) | Authorization: org-scoped roles + relationship checks in Postgres | Proposed |
| [0006](0006-client-applications.md) | Client apps: one Expo app + Next.js admin; hosting of admin | Proposed |
| [0007](0007-push-and-third-party-processors.md) | Push notifications, email and error monitoring providers | Proposed |
| [0008](0008-authentication-methods.md) | Authentication methods and account onboarding | Proposed |

Template: copy `template.md`.
