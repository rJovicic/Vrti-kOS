# ADR-0006: Client applications — one Expo app + Next.js admin; admin hosting

- Status: Proposed — hosting part **requires owner approval** (subprocessor)
- Date: 2026-11-10
- Related: R-03, R-13 (app store review), Q-T03

## Context
Parents and educators need native mobile apps; management needs an efficient desktop UI.

## Options considered — mobile
1. **One React Native + Expo app, role-based experience** (parent vs educator mode; user with both roles
   can switch).
2. Two separate apps (parent app, staff app) — clearer store listings and permissions, double release overhead.
3. Fully native (Swift + Kotlin) — best platform fidelity, 2× the work.
4. Flutter — good, but no code sharing with a TypeScript web admin/validation stack.

**Recommended: Option 1.** Revisit option 2 if store review, device management (shared kindergarten tablets)
or permission prompts make a single app awkward.

## Options considered — admin web
1. **Next.js (App Router)** — mature, good DX, server components; ui-ux-pro-max has current guidance.
2. Vite + React SPA — simpler, static hosting anywhere in the EU, no server runtime processing personal data.

**Recommended: Next.js**, but with a constraint: the admin acts with the user's Supabase session; no
`service_role` on the server.

## Hosting the admin — the real decision
If Next.js server components/route handlers render child data, the host **processes personal data** and
becomes a subprocessor.
| Option | Notes |
|---|---|
| A. Vercel, functions pinned to an EU region (`fra1`) | Best DX; Vercel Inc. is US → subprocessor + transfer assessment; edge/CDN logs contain IPs |
| B. EU host (e.g. Scaleway, Hetzner + Coolify, Netlify EU?) | Stronger residency; more ops |
| C. Vercel serving only static/client-rendered pages; all data fetched browser→Supabase | Vercel processes only IP/request logs, smaller footprint, loses some Next.js benefits |

**Recommended for pilot: A or C, decided together with ADR-0003 and the DPO conversation.** Record Vercel
in the subprocessor register either way.

## Cost & complexity (approximate)
Expo/EAS: free tier may suffice for pilot; EAS paid plans start around USD 19–99/month if build volume grows.
Apple Developer USD 99/year; Google Play USD 25 one-off. Vercel Pro ~USD 20/user/month.

## Open points
- D-6: approve one-app strategy and admin hosting option.
- Q-T03: shared kindergarten tablets vs personal phones for educators (affects session model and MDM).

## Phase 3 addendum (2026-11-10) — admin hosting
- **Demo:** admin runs locally only (ADR-0009); no hosting decision needed to build or present the demo.
- The admin server holds **no service key**; Server Components and Server Actions act with the user's session
  (admin-app.md). Consequently any host processes request logs and rendered personal data in transit → it is a
  processor either way.
- Recommendation unchanged: decide after the DPO conversation (Q-P08) between Vercel (`fra1` functions) and an
  EU-headquartered host; record in a new ADR before staging. Status remains **Proposed**.
