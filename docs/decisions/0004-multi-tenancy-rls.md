# ADR-0004: Shared-schema multi-tenancy enforced by Row Level Security

- Status: Proposed
- Date: 2026-11-10
- Related: R-01 (cross-tenant access), R-02 (broken access control)

## Context
~10 organizations now, possibly hundreds later. Parents and staff can belong to several organizations.
Cross-tenant leakage of child data is the single most damaging failure mode.

## Options considered
1. **Shared database, shared schema, `organization_id` on every tenant-owned row, RLS.**
2. Schema-per-tenant — stronger isolation feel, but migrations × N, cross-org users (parent in 2 orgs) awkward,
   PostgREST/Supabase tooling assumes one schema.
3. Database/project-per-tenant — strongest isolation, highest cost and ops; cross-org users very hard.

## Decision (recommended)
Option 1, with mandatory guardrails:
- Every tenant-owned table: `organization_id uuid not null` + FK + index + `ENABLE ROW LEVEL SECURITY` +
  `FORCE ROW LEVEL SECURITY` where applicable.
- Composite foreign keys `(organization_id, id)` between tenant tables so a row can never reference another
  tenant's row, even via a bug.
- CI check that fails if any table in exposed schemas lacks RLS (query `pg_class.relrowsecurity`) — plus
  Supabase advisors.
- pgTAP test suite with **negative tests**: user of org A cannot read/write org B for every table.
- Tables not meant for clients live in a non-exposed schema (e.g. `private`).

## Consequences
+ Simple operations, one migration path, efficient for cross-org users.
− Isolation depends on policy correctness → mitigated by tests, composite FKs, and review checklist.
− Very large tenant later could need partitioning — not a concern at this scale.

## Security & privacy implications
This ADR is the core technical control for GDPR Art. 32 confidentiality. Policy changes require security
review and test updates in the same PR.

## Cost & complexity
No extra cost. Medium complexity in policy design; mitigated by helper functions (ADR-0005).
