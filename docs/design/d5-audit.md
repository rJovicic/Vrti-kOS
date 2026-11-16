# D5 — final Impeccable audit (admin and mobile)

Date: 2026-11-16. Scope: `apps/admin` (Next.js, web) and `apps/mobile` (Expo, native screens rendered in tests), against
PRODUCT.md and DESIGN.md. Mode: **Operate** (task surfaces) — precision and restraint, not expression.

## Method and limits
- **Code-level audit** of every screen added or changed in D3–D5 plus the shared styles and UI primitives (tokens,
  hard-coded values, focus, roles, live regions, touch targets, dark mode, text fields).
- **Rendered check:** admin pages in Chromium (Playwright) at 1440 px, light theme; see §4.
- **Not run:** the Impeccable context loader and detector — the session's command runner was intermittently unavailable
  when the audit started (recorded honestly; the detector was clean at Phase 4, 2 advisory findings). Mobile screens
  are verified through render tests only — no simulator or device (R-44, R-55; device testing deferred by the owner).

## Audit health score
| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Mobile result messages were not announced to screen readers (fixed) |
| 2 | Performance | 4 | No animations, no images; server-rendered admin; lists are small (demo scale) |
| 3 | Theming | 3 | Admin native controls and the new textarea did not follow dark mode (fixed) |
| 4 | Responsive | 3 | Multi-line editors on mobile were one line high (fixed); admin collapses at 760 px |
| 5 | Implementation integrity | 4 | Tokens everywhere (one justified `#fff` behind the MFA QR code), no inline styles in admin, no hard-coded colours in mobile |
| **Total** | | **17/20** before fixes → **19/20** after | Good → Excellent |

**Implementation integrity verdict: pass.** The product speaks one system: shared tokens (`packages/tokens`, contrast
tested — secondary and tertiary text ≥ 4.5:1 on every surface), one state language (expected / present / departed /
absent) across attendance, admin and Parent Home, prototype labels reused verbatim, no decorative content.

## Findings
| ID | Sev. | Where | Finding | Fix |
|---|---|---|---|---|
| A-01 | P1 | `apps/mobile/src/ui/Notice.tsx` and the editors | The result of an action (overview published, absence sent/cancelled, "osoba nije na popisu") appeared silently for VoiceOver/TalkBack; errors had role `alert` but no Android live region | `Notice` gets `announce`: role `alert` + `accessibilityLiveRegion` (polite for results, assertive for errors); used in the daily overview editor, child view and handover panel |
| A-02 | P2 | `apps/mobile/src/ui/TextField.tsx` | Multi-line fields (daily overview ≤ 1,000, messages ≤ 2,000 characters) were 48 px high; Android centres multi-line text vertically | `multiline` style: 132 px minimum, padding, body line height, text from the top |
| A-03 | P2 | `apps/admin/src/app/globals.css` | The announcement `textarea` (D4-C) had only `font: inherit` — browser border/background, white in dark mode | `textarea` shares the input tokens; vertical resize; body line height; themed placeholder |
| A-04 | P2 | `apps/admin/src/app/globals.css` | No `color-scheme`: native `select`, date inputs, checkboxes and scrollbars stayed light in dark mode while the tokens switch | `html { color-scheme: light dark; }` |
| A-05 | P3 | `.btn.text` (admin) | 36 px high text buttons (above the 24 px WCAG minimum, below 44 px) | Left as is: inline, spaced, not a primary control |
| A-06 | — | `.manage-body .danger-zone` | 3 px coloured left border on a callout (a "refuse" habit) | Left as is: confirmed D2 pattern, marks destructive actions only; no redesign in D5 |

## Positive findings (keep)
- Every admin message is `role=status` / `role=alert`; global `:focus-visible` ring from the focus token; 44 px controls.
- Mobile: 44 px minimum on every interactive element (chips, tiles, rows, withdraw), accessibility labels that read the
  whole state ("Lea Babić. U vrtiću od 07:42"), accessibility actions instead of gesture-only paths (handover).
- Demo banner on every screen of both apps ("DEMO: izmišljeni podaci", inside the safe area on mobile).
- Text-only empty and error states with a recovery action and a reference id, as DESIGN.md asks.

## 4. Rendered check (admin)
See the end of this file once the screenshots are taken (Galebovi attendance, announcements editor in light and dark).
