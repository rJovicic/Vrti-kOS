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

## 4. Closure (2026-11-16)
| Package | Result |
|---|---|
| D5-A | Done: scenario in `world.ts` → `seed.sql` (deterministic, CI checks it), listed in demo-accounts.md "D5 presentation scenario" |
| D5-B | Done: `pnpm demo:reset`, `pnpm demo:verify` (`tests/integration/src/demo-reset.demo.test.ts`) passes locally and is the last CI step of the database job |
| D5-C | Done: existing banner on every screen of both apps (admin layout, mobile root inside the safe area), unchanged text |
| D5-D | Done: [docs/product/demo-script.md](../product/demo-script.md) — preparation, manager, educator, guardian, closing and reset, with expected results |
| D5-E | Done: [docs/design/d5-audit.md](../design/d5-audit.md) — 17/20 → 19/20; detector source 1 → 0, rendered sign-in 0 |
| D5-F | Done: A-01 (announced results, mobile), A-02 (multi-line fields), A-03/A-04 (admin dark mode for textarea and native controls), A-06 (side stripe) |
| D5-G | Done: docs, CI |

**Proven:** seed loads; reset restores the identical scenario (demo:verify); lint, typecheck, unit, render, pgTAP,
integration and admin e2e pass on the seeded database; screenshots of the scenario in light and dark.

**Not verified:** the mobile part of the script on a phone (R-44, R-55). Before the first presentation to a
kindergarten, run the script once on a device (precondition written in the script, step 0).

**Out of scope, unchanged:** photos, media, consents, production, pilot, real push (D-40 not activated), Q-T05, Q-T15,
Q-T16, educators publishing announcements, D-10.
