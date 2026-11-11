---
version: 1
slug: "src-app-app-educator-groups-groupid-attendance-tsx"
primary_target: "src/app/(app)/(educator)/groups/[groupId]/attendance.tsx"
related_targets: []
---

# Surface brief — Evidencija dolazaka (educator attendance)

Scope: apps/mobile educator attendance screen; the same world carries the parent home, admin group views and the rest of the app.
Visitor mode: Operate. Audience: educators (primary pilot user), one hand free, children around, often noisy room, morning peak 6:30–8:30.
Job: mark each expected child arrived/departed in seconds, with handover person from a list, undo mistakes, keep working when Wi-Fi drops.
Constraints: no child photos or pictograms, no health data, Croatian copy with diacritics, WCAG 2.2 AA, 44pt/48dp targets, synthetic data only.
Unresolved: shared tablet vs personal phone (Q-T03); "all present" bulk action deliberately absent (FR-05-6).

## Direction contract
FORM: seed:298a0373c0a57b80 (degraded roll — no challengers), assigned grounded candidate 4 of 7: the kindergarten cloakroom wall (garderoba).
THESIS: The register is the cloakroom wall educators already read every morning — one labelled tag per child — not a spreadsheet of rows. Refuses the category default of a dense table with checkboxes and a coloured status column.
OWN-WORLD: Birch-plywood warm neutrals (stone-white ground, warm grey borders), painted soft green as the one committed colour for "here", ochre for "javljen izostanak", terra-rossa only for real errors. Typographic name tags with initials, generous radius, tabular times; system UI faces (SF/Roboto) for every control.
STORY: The educator sees at once who is expected, who is here, who has gone and who is reported absent; each tap fills a tag and stamps the time; mistakes are undone in place; offline changes wait visibly.
FIRST VIEWPORT: Group name + date + live counts (Očekuje se / U vrtiću / Otišli / Izostanak), then the tag wall in two columns (one column at large text sizes), sync state pinned above the tab bar.
SIGNATURE: The tag fills with green from its base like a coat placed on a hook, with the check-in time stamped on the tag; undo drains it back.
RISK: A grid of tags can read as playful; held back by restrained type, no pictograms, and state carried by fill + text, never colour alone.
