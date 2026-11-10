# ADR-0015: Client application stack and state management

- Status: Proposed
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

## Consequences
Fewer dependencies; design system implemented twice (RN + web) from one token source — accepted cost.
