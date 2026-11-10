# Privatnost i GDPR — indeks dokumenata

> ⚠️ Svi dokumenti u ovoj mapi su **tehnički i operativni nacrti**, ne pravna potvrda usklađenosti.
> Stavke označene ⚖️ zahtijevaju pregled hrvatskog odvjetnika za zaštitu podataka, DPO-a vrtića
> ili kvalificiranog stručnjaka za privatnost. Ne tvrdimo usklađenost bez dokaza.

## Zašto većina dokumenata još ne postoji
Inventar podataka, pravne osnove, retencija i DPA ovise o domenskom modelu (Faza 1) i izboru procesora
(odluke D-3, D-6, D-7). Pisati ih sada značilo bi izmišljati činjenice. Iznimka je **DPIA screening**, koji je
započet u Fazi 0 jer utječe na arhitekturu.

| # | Dokument | Status | Faza | Ovisi o |
|---|---|---|---|---|
| 1 | data-inventory.md | Planirano | 2 | Domenski model (F1) |
| 2 | data-classification.md | Planirano | 2 | #1 |
| 3 | data-flow-map.md | Planirano | 2 | #1, ADR-0003/6/7 |
| 4 | gdpr-compliance-matrix.md | Planirano | 2 | #1–3 |
| 5 | lawful-basis-analysis.md | Planirano | 2 | Q-P01, Q-P02 ⚖️ |
| 6 | privacy-notice-parent-draft.md | Planirano | 2 | #5 |
| 7 | privacy-notice-staff-draft.md | Planirano | 2 | #5 |
| 8 | privacy-policy-draft.md | Planirano | 2 | #5 |
| 9 | data-processing-agreement-draft.md | Planirano | 2 | Q-P01, Q-P15 ⚖️ |
| 10 | subprocessor-register.md | Planirano | 2–3 | D-3, D-6, D-7 |
| 11 | data-retention-policy.md | Planirano | 2 | Q-P09 ⚖️ |
| 12 | data-subject-rights-procedure.md | Planirano | 2 | #1 |
| 13 | data-breach-response-plan.md | Planirano | 2 | #9 |
| 14 | consent-management-specification.md | Planirano | 2 | Q-P04 ⚖️ |
| 15 | privacy-by-design-checklist.md | Planirano | 2 | — |
| 16 | [dpia-screening.md](dpia-screening.md) | **Nacrt v0** | 0 → 2 | — |
| 17 | dpia-draft.md | Planirano | 2 | #16, #1–5 |
| 18 | international-data-transfer-assessment.md | Planirano | 2 | Q-P07 ⚖️ |

## Ključne pretpostavke (Faza 0)
- Pilot kupci su pretežno **javni vrtići** (odgovor vlasnika 2026-11-10). Vrtić je vjerojatno voditelj obrade,
  VrtićOS izvršitelj (čl. 28) — ⚖️ potvrditi po tokovima (Q-P01).
- Javni vrtići kao tijela javne vlasti moraju imati službenika za zaštitu podataka (čl. 37(1)(a)) — on je
  ključni sugovornik za DPA i DPIA.
- Nadzorno tijelo: Agencija za zaštitu osobnih podataka (AZOP). Nacionalni provedbeni zakon:
  Zakon o provedbi Opće uredbe o zaštiti podataka (NN 42/18).
