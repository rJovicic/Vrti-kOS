# ADR-0009: Local demo and development environment

- Status: **Accepted for the local demo only** (owner decision D-20, 2026-11-11); production use remains Proposed
- Date: 2026-11-10
- Related: owner decision 2026-11-10 (build a functional demo before validation), R-37, local-development.md

## Context
The owner wants a functional demo of the whole application to present to kindergartens. Platform decisions D-3
(Supabase Cloud), D-6 (admin hosting) and D-7 (processors) are not approved, and no paid service may be created.

## Options considered
1. **Supabase CLI local stack in Docker + synthetic seed; apps run locally; phones connect over LAN.**
2. Free-tier Supabase Cloud project for the demo — requires an account and a US-parented processor before D-3;
   a "free demo project" tends to become the real one (R-37).
3. Mocked backend (MSW/in-memory) — fast UI demo, but nothing about RLS/authorization would be real, and the code
   would have to be rewritten.

## Decision (proposed)
Option 1. The demo is the real architecture (Postgres + RLS + Auth + Edge Functions) running locally:
`supabase start` (CLI pinned as a dev dependency), Mailpit for all emails, synthetic seed with `.test` email domain,
"DEMO: izmišljeni podaci" banner, seed/reset scripts that refuse non-local databases.

Evidence: in this repository's cloud container the stack started successfully (Docker Hub registry override needed
because the AWS ECR CDN is blocked there) and the RLS spike passed 14/14 checks.

## Consequences
+ Zero cost, no processor relationship, no real data; the demo proves the security model, not a mock.
+ Same stack in CI (`db` job).
− Presenter needs a laptop with Docker; phones on the same network; no push notifications (in-app only).
− iOS native build not possible without macOS/Apple account — Expo Go is sufficient for the demo.

## Security & privacy implications
Well-known local keys only; local ports not exposed beyond the presenter's private network; no Sentry/email/push
credentials. Kindergartens must not be offered to "try it with our data" on the demo (R-37).

## Cost & complexity
Free. Low–medium complexity (Docker, LAN networking).
