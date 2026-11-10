# Backlog

Stavke su grupirane po fazi. Format: `[ID] opis — ovisnost`. Stavke ulaze u rad samo u odobrenoj fazi.

## Tok V — Validacija s kupcima
- [x] [V-1] Pripremiti scenarij razgovora — vodiči u [product/validation-plan.md](product/validation-plan.md) §4
- [V-2] 3–5 razgovora s ravnateljima/odgojiteljima istarskih vrtića
- [V-3] Razgovor s DPO-om jednog javnog vrtića (procesori, DPA, DPIA)
- [V-4] Istražiti proces jednostavne nabave i e-račun prema javnom sektoru
- [V-5] Konkurentska analiza (proizvodi u HR/regiji/EU)

## Faza 1
- [x] [P1-1] Rječnik pojmova (HR↔EN identifikatori) — `product/glossary.md` (v0.2, usklađen)
- [x] [P1-2] Matrica uloga i dozvola (nacrt) — `product/roles-and-permissions.md` (usklađena; čeka validaciju)
- [x] [P1-3] Korisnička putovanja (nacrt) — `product/user-journeys.md`
- [x] [P1-4] Poslovna pravila i rubni slučajevi (nacrt) — `product/business-rules.md`
- [x] [P1-5] Domenski model (nacrt) — `product/domain-model.md`
- [x] [P1-6] NFR dokument (nacrt) — `product/nfr.md`
- [x] Privremeni MVP opseg (nacrt) — `product/mvp-scope.md`
- [x] [P1-8] Pregled dosljednosti — `product/consistency-review.md`
- [x] [P1-9] Funkcionalne specifikacije FS-01…FS-15 — `product/functional-specs.md` (nacrt v0.1)
- [x] [P1-10] Kriteriji prihvaćanja (Given/When/Then) — `product/acceptance-criteria.md` (nacrt v0.1)
- [x] [P2-1 → F1] Inventar podataka v0 — `privacy/data-inventory.md`
- [x] [V-1] Plan validacije i vodiči za intervjue — `product/validation-plan.md`
- [x] Sljedivost i provjera usklađenosti — `product/traceability.md`
- [~] [P1-7] PRD — nacrt v0.1 u `product/prd.md`; **zaključavanje MVP-a** ovisi o V-2 i V-3
- [ ] [P1-11] Dopuniti AC za FR-ove bez zasebnog kriterija (popis u `traceability.md` §3, red 4) — prije Faze 3
- [ ] [P1-12] Nakon intervjua: ažurirati PRD §9 (status pretpostavki), mvp-scope (zaključati), specifikacije
- [ ] [P1-13] Zatražiti pregled matrice dozvola od ravnatelja/odgojitelja i DPO-a (kriterij P1-2)
- [ ] [P1-14] Skripta za provjeru dokumentacije (linkovi, ID-ovi) u repozitoriju — trenutno se pokreće ad hoc

## Faza 2
- [P2-1…18] 18 privatnosnih dokumenata (vidi [privacy/README.md](privacy/README.md))
- [P2-19] Threat model (STRIDE po komponenti)
- [P2-20] Odabir ASVS L2 / MASVS kontrola

## Faza 3
- [P3-1] Spike: Expo + pnpm + Turborepo monorepo
- [P3-2] Spike: RLS helperi + pgTAP + mjerenje performansi sa 1.000 sintetičke djece
- [P3-3] ADR-ovi: e-mail pružatelj, mediji, offline dolasci, backup/restore

## Faza 5 (unaprijed zabilježeno)
- [P5-1] CI provjera: tablica bez RLS-a ruši build
- [P5-2] Secret scanning + dependency scanning u CI-u
- [P5-3] Uključiti Impeccable hook (ako D-11) i zapisati u `.claude/settings.json`
- [P5-4] Skripta za dohvat Impeccable enginea iz npm registryja s provjerom SHA-256 (za nove sesije)
