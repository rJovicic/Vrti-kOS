# CLAUDE.md — VrtićOS permanent project rules

VrtićOS is a multi-tenant SaaS for kindergartens (initially public kindergartens in Istria, Croatia):
native iOS/Android app (parents, educators) + web admin (directors, org admins, platform admins).
It processes **children's personal data**. Privacy and security are first-class requirements, not features.

Start every session by reading [docs/phase-status.md](docs/phase-status.md). It states the current approved
phase, what is in progress, and what is awaiting approval.

## Language
- Product UI, user-facing copy and project/product/privacy docs: **Croatian** (i18n-ready; Italian later).
- Code, identifiers, commit messages, ADRs and technical docs: **English**.

## Working rules (execution loop)
1. Inspect current state → 2. confirm the approved phase in `docs/phase-status.md` → 3. read relevant docs/skills →
4. pick the next smallest useful task → 5. check dependencies and risks → 6. explain the change →
7. implement only within approved scope → 8. run tests/checks → 9. review security/privacy impact →
10. update docs → 11. summarize → 12. list open issues → 13. stop at the approval checkpoint.
- Never claim done without satisfying the task's acceptance criteria. Never silently skip tests.
- No placeholder functionality presented as production-ready.
- Keep changes small. No large single-pass implementations.

## Approval gates — ask the owner first
Production infrastructure, deployments, destructive commands, data deletion, live auth/security policy changes,
paid services, major architecture changes, legal/privacy decisions, moving to the next phase.
Never commit secrets. Never connect production accounts. Never use real child data (synthetic seed data only).

## Non-negotiable privacy & security rules
- Every tenant-owned table: `organization_id` + **RLS enabled** + policies + negative tests (cross-tenant,
  parent→other child, educator→unassigned group). See [docs/decisions/](docs/decisions/).
- Authorization is enforced in the database/server. Hidden UI is never authorization.
- `service_role` key never reaches any client, log, or repository.
- Storage buckets are private; media served via short-lived signed URLs; strip EXIF.
- No personal data in logs, analytics, crash reports, or push notification previews.
- No child data in AI training, no facial recognition, biometrics, profiling, or AI image analysis.
- No medical/medication data in MVP without an approved assessment (see `docs/privacy/`).
- Schema changes only via migrations. Staging and production are isolated.
- Every new processing purpose or third-party service must be reflected in `docs/privacy/` (data inventory,
  subprocessor register) before it ships.

## Design rules
- Design skills: `impeccable` (primary: product context, critique, audit, detector) and `ui-ux-pro-max`
  (reference data: stack guidelines, UX rules). Evaluate their output against PRODUCT.md and tokens; do not
  follow generated recommendations blindly (e.g. it suggested claymorphism/pink/Fredoka — rejected as too childish).
- Direction: warm, calm, trustworthy, professional; soft green primary; warm neutral surfaces; WCAG 2.2 AA.
- Product context lives in [PRODUCT.md](PRODUCT.md). Visual system: [DESIGN.md](DESIGN.md) (frontmatter generated from
  `packages/tokens` via `pnpm design:sync` — never edit token values in DESIGN.md by hand). Prototype: `design/prototype/`.

## Engineering conventions
TypeScript 6 strict, pnpm 12 via Corepack + Turborepo monorepo (ADR-0016), Zod validation at every boundary,
centralized design tokens, documented env vars (`.env.example` only), small focused modules, conventional commits.
No React DOM code in `apps/mobile`; shared packages are UI-free (ESLint enforces it).

## Commands
`pnpm demo` (whole local system) · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm db:reset` · `pnpm db:test` (pgTAP)
· `pnpm db:spike` · `pnpm db:types` · `pnpm seed:generate` · `pnpm design:sync`. Every new table needs RLS, grants and
negative pgTAP tests in the same change; run `pnpm db:test` before committing.

## Documentation map
- [docs/README.md](docs/README.md) — index
- [docs/roadmap.md](docs/roadmap.md) · [docs/phase-status.md](docs/phase-status.md) · [docs/backlog.md](docs/backlog.md)
- [docs/architecture.md](docs/architecture.md) · [docs/architecture/](docs/architecture/) (implementation: schema, API, apps, local dev) · [docs/decisions/](docs/decisions/) · [docs/risks.md](docs/risks.md)
- [docs/security/](docs/security/) (threat model, SR requirements, test plan, incident response)
- [docs/open-questions.md](docs/open-questions.md) · [docs/privacy/](docs/privacy/) · [docs/tooling/skills.md](docs/tooling/skills.md)
