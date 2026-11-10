# Backlog

Stavke su grupirane po fazi. Format: `[ID] opis — ovisnost`. Stavke ulaze u rad samo u odobrenoj fazi.

## Tok V — Validacija s kupcima
- [V-1] Pripremiti scenarij razgovora iz [product/discovery-checklist.md](product/discovery-checklist.md) (sekcije A–D)
- [V-2] 3–5 razgovora s ravnateljima/odgojiteljima istarskih vrtića
- [V-3] Razgovor s DPO-om jednog javnog vrtića (procesori, DPA, DPIA)
- [V-4] Istražiti proces jednostavne nabave i e-račun prema javnom sektoru
- [V-5] Konkurentska analiza (proizvodi u HR/regiji/EU)

## Faza 1
- [P1-1] Rječnik pojmova (HR↔EN identifikatori) — `docs/product/glossary.md`
- [P1-2] Matrica uloga i dozvola — ovisi o P1-1
- [P1-3] Korisnička putovanja (odgojitelj, roditelj, ravnatelj)
- [P1-4] Poslovna pravila i rubni slučajevi
- [P1-5] Domenski model (validacija ERD-a iz architecture.md)
- [P1-6] NFR dokument
- [P1-7] PRD + MVP opseg (MoSCoW) — ovisi o V-2

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
