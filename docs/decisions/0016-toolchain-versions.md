# ADR-0016: Toolchain versions for the demo build (TypeScript 6, pnpm 12, Expo SDK 58)

- Status: Proposed — **non-blocking for the demo** (no cost, reversible); taken autonomously under the owner's
  2026-11-11 instruction "if a tool version is incompatible, choose a stable alternative and record an ADR"
- Date: 2026-11-11
- Related: R-39, technical-architecture.md §3, ADR-0002, ADR-0015

## Context
Phase 3 listed the npm `latest` versions (Expo SDK 58, pnpm 12, TypeScript 7) and flagged their combination as
unverified (R-39). D0 verified them empirically in the repository's cloud container.

## Evidence (2026-11-11)
| Check | Result |
|---|---|
| Official Expo SDK 58 template (`expo-template-blank-typescript@58.0.32`) | pins `typescript ~6.0.3` |
| TypeScript 7.0.2 package entry point | `main` exports only `./lib/version.cjs`; the classic compiler API is under `unstable/*` |
| `typescript-eslint` 8.72.2 peer range | `typescript >=4.8.4 <6.1.0`; with TS 7 installed ESLint aborts: "typescript-eslint does not support TS 7.0" |
| Next.js 16.4.6 `next build` with TS 7.0.2 | succeeded (type-check ran) |
| `tsc` 7.0.2 on the Expo app | succeeded |
| pnpm 12.18.0 via Corepack | works; `pnpm install` 9 s; Supabase CLI binary installs without blocked scripts |
| pnpm 12 `node-linker=hoisted` in `.npmrc` | **ignored** (pnpm 12 reads settings from `pnpm-workspace.yaml`); install is isolated with symlinks |
| Expo SDK 58 + isolated pnpm layout | `expo export` (Android + iOS Hermes bundles) and Metro dev server both work |
| Turborepo 2.11.10 parallel tasks via a globally installed pnpm 10 that self-switches to pnpm 12 | intermittent `Exec format error`; with Corepack shims (`corepack enable`) 14/14 parallel tasks pass |
| `expo install` in a network-restricted environment | fails (api.expo.dev blocked); `EXPO_OFFLINE=1 expo install` uses the SDK's bundled compatibility table |

## Decision (proposed)
1. **TypeScript 6.0.3** everywhere (root, apps, packages). Reason: the lint toolchain does not support TS 7 and the
   Expo SDK 58 template targets 6.0. Revisit when `typescript-eslint` supports TS ≥ 7.1 (its tracking issue #10940).
2. **pnpm 12.18.0** pinned in `packageManager`, always run through **Corepack** (`corepack enable`), locally and in CI.
3. **Isolated node_modules** (pnpm default). No `node-linker=hoisted`: Expo SDK 58 works without it.
4. Expo native module versions are chosen with `expo install` (offline mode where the network blocks Expo's API).
5. Shared packages ship TypeScript source with explicit `.ts` import extensions (`allowImportingTsExtensions`) so the
   same files run in Node 22 type-stripping scripts, Vitest, Metro and Next.js without a build step.

## Consequences
+ All D0 checks pass with one TypeScript version; lint stays type-aware-capable.
− Not on the newest compiler; performance benefits of TS 7 deferred.
− Developers must use Corepack; documented in local-development.md §8.
