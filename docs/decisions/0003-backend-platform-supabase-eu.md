# ADR-0003: Supabase (EU region) as backend platform

- Status: Proposed — **requires owner approval** (paid service, subprocessor, transfer assessment)
- Date: 2026-11-10
- Related: R-03 (international transfer), R-01 (cross-tenant), Q-P07, Q-P08

## Context
We need Postgres, authentication, file storage, server functions and scheduled jobs, operated by a very
small team, with EU data residency and strong tenant isolation.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Supabase Cloud, EU region (e.g. Frankfurt `eu-central-1`)** | Postgres + RLS is a natural fit for multi-tenant authorization; Auth/Storage/Edge Functions/cron included; local dev via CLI; migrations-first; open source (exit path to self-host) | Supabase Inc. is a US company; infra on AWS → transfer/CLOUD Act analysis needed; platform-level support access; some features (e.g. Edge Functions region behaviour, logs) must be verified for EU-only processing |
| B. Self-hosted Supabase on EU provider (Hetzner/OVH/Scaleway) | Full EU control, no US processor | We operate backups, upgrades, security patching, HA — unrealistic for a tiny team handling child data |
| C. Managed Postgres (EU provider, e.g. Scaleway/OVH/Aiven-EU) + custom API (NestJS/Fastify) + separate auth (e.g. Keycloak / EU IdP) + S3-compatible EU storage | Strongest residency story; no lock-in | Much more code to write and secure (auth, storage authz, jobs); slower MVP; more attack surface we own |
| D. Firebase | Fast to build | NoSQL weak for relational authorization; Google US; poor fit |

## Decision (recommended)
**Option A** for MVP and pilot, with conditions:
1. EU region only; separate projects for staging and production.
2. Sign Supabase DPA; record Supabase and its subprocessors (AWS etc.) in the subprocessor register;
   complete the international-transfer assessment (SCCs / EU-US DPF status **must be verified**, not assumed).
3. Enable PITR backups on production (Pro plan add-on) and test restore before pilot.
4. Keep the schema portable (plain Postgres, migrations in repo, no proprietary lock-in beyond Auth/Storage
   APIs) so Option B/C remains an exit path if a kindergarten's DPO rejects a US-parented processor.

## Consequences
+ Fastest secure path; RLS-first design is testable with pgTAP.
− Vendor dependency; pricing changes; Auth customization limits (e.g. custom claims via auth hooks).
− The DPO of a public kindergarten may challenge a US-parented subprocessor → must be raised early (Q-P08).

## Security & privacy implications
Never expose `service_role`. Enforce SSL. Network restrictions for DB direct access. MFA on Supabase
dashboard accounts. Audit Supabase org members. Logs may contain IPs/emails → retention and access limits.

## Cost & complexity (approximate, verify current pricing)
Pro plan ~USD 25/month per org + compute add-ons; PITR add-on extra; staging project adds compute cost.
Order of magnitude for pilot: **USD 50–150/month**. Complexity: low–medium.

## Open points / approval needed
- D-3: approve Supabase EU as primary platform (paid service + subprocessor).
- Confirm region (Frankfurt vs. other EU) — recommend Frankfurt for latency to Croatia.
