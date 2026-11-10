# ADR-0002: Modular monolith in a pnpm + Turborepo monorepo

- Status: Proposed
- Date: 2026-11-10
- Related: R-12 (team capacity), R-17 (supply chain)

## Context
Three clients (iOS, Android, web admin) share one domain, one database and a lot of types/validation.
Scale target is ~10 orgs / ~3,000 accounts — tiny by infrastructure standards. The team is very small.

## Options considered
1. **Monorepo, modular monolith (pnpm workspaces + Turborepo)** — shared types/validation/tokens, atomic
   changes across DB + clients, one CI.
2. **Polyrepo** (mobile, admin, backend separate) — independent release cadence, but type drift and
   coordination cost; no benefit at this size.
3. **Microservices** — operational cost and distributed-authorization complexity with zero current benefit.
4. Monorepo with **Nx** instead of Turborepo — more powerful generators/graph; heavier and more opinionated.

## Decision (recommended)
Option 1. pnpm workspaces + Turborepo for task caching. Module boundaries enforced by package boundaries
and ESLint import rules, and in the DB by schema/table naming per module.

Note: Expo + pnpm works but needs care (Metro + symlinks; Expo SDK supports monorepos, but `node-linker`
settings and hoisting must be validated in Phase 5 with a spike, not assumed).

## Consequences
+ One PR can change migration, generated types, validation and both clients together.
+ Cheap CI with Turborepo caching.
− Mobile native builds (EAS) and web deploys must be scoped to changed packages.
− A monorepo makes supply-chain hygiene a single point of failure — pin versions, lockfile review, CI scanning.

## Security & privacy implications
Single dependency tree to scan (Dependabot/Renovate + `pnpm audit` + secret scanning in CI).

## Cost & complexity
No direct cost. Low complexity. Turborepo remote cache is optional (Vercel-hosted; not needed initially).

## Open points
Approve as part of decision batch D-2.
