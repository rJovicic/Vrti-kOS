# D5 — Demo polish: plan and closure

Approved by the owner on 2026-11-16 (together with D-40). Goal: a repeatable, convincing, functional demo that can be
shown to a kindergarten — synthetic data only, no production services, no real data.

## 1. Rules (owner, 2026-11-16, plus the permanent rules)
- Synthetic data only; local stack only (ADR-0009); no account, credentials or real push (D-40 not activated).
- No photos, media, consents, production infrastructure or pilot.
- Q-T05, Q-T15, Q-T16, educators publishing announcements and D-10 stay open; current rules stay in force.
- Fix real visual and UX defects found by the audit; no redesign of the confirmed direction (PRODUCT.md, DESIGN.md).

## 2. Work packages
| Package | Content | Acceptance |
|---|---|---|
| D5-A | Presentation scenario in the synthetic seed (`packages/test-fixtures`: world → seed.sql), relative to the load day, created through the real database functions (audiences, notifications): Galebovi with 3 arrivals (one handed over), 1 reported absence, 1 expected; 2 announcements; 2 previous daily overviews; 1 conversation | `pnpm seed:generate` deterministic (CI), seed loads, scenario documented in demo-accounts.md |
| D5-B | Repeatability: `pnpm demo:reset` (local reset) and `pnpm demo:verify` — reset, scenario snapshot, presentation-like changes, reset, identical snapshot | test passes locally and in CI |
| D5-C | Demo banner: present in both apps on every screen ("DEMO: izmišljeni podaci", the confirmed text — DESIGN.md, ADR-0009, R-37) | render/e2e evidence |
| D5-D | Presentation script (Croatian) with order, actions and expected results for manager, educator, guardian | docs/product/demo-script.md, matches the real UI |
| D5-E | Final Impeccable audit of admin and mobile (detector + review against PRODUCT.md and DESIGN.md) | findings recorded with severity |
| D5-F | Fixes of real defects from D5-E (no redesign) | tests/screenshots per fix |
| D5-G | Docs, closure, CI green | this file §4 |

## 3. Technical choices
- The scenario is part of the generated seed (not a separate script), so `supabase db reset` — the existing, guarded
  reset — always restores it; times are `least(now() − 1 min, today HH:MM in Europe/Zagreb)`, never in the future.
- Notifications in the scenario are produced by `private.notify` with the real audience functions, not hand-written.
- `demo:verify` resets the database, so it is excluded from `pnpm test:integration` and runs as its own CI step at the
  end of the database job.
- Today's daily overview is intentionally absent: the educator writes it live in the presentation (script step 2.8).
