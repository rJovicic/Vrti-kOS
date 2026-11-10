# ADR-0001: Record architecture decisions

- Status: Accepted (process decision, within Phase 0 scope)
- Date: 2026-11-10

## Context
VrtićOS will be built over many sessions, partly by AI agents. Decisions must survive context loss and be
auditable — also for GDPR accountability (Art. 5(2)): "why did we choose this processor/region/control?"

## Decision
Every significant technical, security or privacy decision is recorded as an ADR in `docs/decisions/`.
Decisions that affect personal data must reference the relevant `docs/privacy/` document.
Agents propose ADRs; only the owner accepts them.

## Consequences
Small overhead per decision; much cheaper onboarding, reviews, and DPIA evidence.
