# ADR-0015: Client application stack and state management

- Status: **Accepted for the local demo only** (owner decision D-20, 2026-11-11); production use remains Proposed
- Date: 2026-11-10
- Related: ADR-0006, technical-architecture.md §3, mobile-app.md, admin-app.md

## Decision (proposed)
| Concern | Mobile | Admin |
|---|---|---|
| Routing | Expo Router (typed routes) | Next.js App Router |
| Server state | TanStack Query (keys include `organizationId`) | Server Components; TanStack Query only for interactive widgets |
| Mutations | TanStack mutations → PostgREST/RPC/Edge Function | Server Actions → same |
| Global client state | none (React context for session/mode) | none |
| Forms | react-hook-form + Zod resolver (shared schemas) | same |
| Styling | RN StyleSheet with `packages/tokens` | CSS variables from `packages/tokens` + CSS Modules |
| i18n | i18next (`hr`) | i18next (`hr`) |
| Session storage | expo-secure-store | `@supabase/ssr` cookies |

Rejected: Redux/Zustand (no global state need), Tailwind in RN (token pipeline duplication), a shared cross-platform
UI kit (React DOM must not be shared with RN — owner requirement), GraphQL (PostgREST + RPC suffice).

## Implementation status (D1, 2026-11-11)
The decision is unchanged; this records what is actually in the code so the ADR is not read as implemented.
| Concern | Mobile (implemented) | Admin (implemented) |
|---|---|---|
| Routing | Expo Router, typed routes — single `Stack`, no route groups or tabs yet | Next.js App Router ✓ |
| Server state | **TanStack Query not installed**; component state + `useEffect` loaders | Server Components ✓; no TanStack Query (not needed yet) |
| Mutations | Supabase client and Edge Function calls from screens | Server Actions → PostgREST / Edge Function ✓ |
| Global client state | none ✓ (React context for the session) | none ✓ |
| Forms | controlled inputs + shared Zod schemas; **react-hook-form not installed** | native `<form>` + Server Actions + shared Zod schemas; **react-hook-form not used** |
| Styling | RN `StyleSheet` + `packages/tokens` ✓ | CSS variables from `packages/tokens` in one global stylesheet; **CSS Modules not used** |
| i18n | i18next ✓ | small server-side translator over the same `hr` catalog |
| Session storage | expo-secure-store (chunked adapter) ✓ | `@supabase/ssr` cookies, httpOnly ✓ |
Whether to adopt the not-yet-used parts or amend this ADR is an open point for the owner (no decision taken here).

## Consequences
Fewer dependencies; design system implemented twice (RN + web) from one token source — accepted cost.
