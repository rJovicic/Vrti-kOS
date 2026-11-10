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
- [x] [P2-19] Threat model (STRIDE po komponenti) — `security/threat-model.md` (nacrt v0.1)
- [x] [P2-21] Plan odgovora na incidente — `security/incident-response-plan.md` (nacrt; uloge neimenovane)
- [x] [P2-22] Sigurnosni zahtjevi s prioritetima i sljedivošću — `security/security-requirements.md`
- [x] [P2-23] Plan sigurnosnog testiranja — `security/security-test-plan.md`
- [ ] [P2-20] Odabir ASVS L2 / MASVS kontrola — detaljna kontrolna lista (u zahtjevima samo približno mapiranje, §12)
- [ ] [P2-24] Registar podizvršitelja s kontaktima za incidente (SR-VEN-01) — ovisi o D-3, D-6, D-7
- [ ] [P2-25] Imenovati uloge za incidente i kontakte (Q-S07) — odluka vlasnika
- [ ] [P2-26] Odluke Q-S10, Q-S11, Q-S12 (sesije, kod za povezivanje, zaključavanje aplikacije) prije Faze 6

## Faza 3
- [ ] [P3-1] Spike: Expo + pnpm + Turborepo monorepo (+ kompatibilnost TypeScript 7, R-39) — **premješteno u D0 (Faza 5), prvi zadatak**
- [x] [P3-2a] Spike: RLS helperi, kompozitni FK, exclusion, opoziv — `architecture/spikes/rls-spike.sql` (14/14)
- [ ] [P3-2b] Mjerenje performansi RLS-a s 10 vrtića / 1.000 djece — D0
- [x] [P3-3] ADR-ovi 0009–0015 (lokalni demo, e-pošta, mediji, offline, backup, autorizacija u bazi, klijentski stog) + dodatak ADR-0006 (hosting admina)
- [x] [P3-4] Tehnička arhitektura, shema baze, API konvencije, mobilna i admin aplikacija, lokalno okruženje — `architecture/`

## Faza 4 — Dizajn (sljedeće)
- [ ] [P4-1] `/impeccable shape` za ključne ekrane: odgojitelj — evidencija dolazaka; roditelj — početna; uprava — pregled vrtića
- [ ] [P4-2] DESIGN.md: paleta (mekana zelena + topli neutralni, provjera kontrasta WCAG 2.2 AA), tipografija s hrvatskim dijakriticima, razmaci, radijusi, stanja
- [ ] [P4-3] `packages/tokens` izvorni JSON iz DESIGN.md
- [ ] [P4-4] Ključni ekrani (Figma ili kodni prototip) — 6 mobilnih + 4 admin ekrana
- [ ] [P4-5] Test prototipa s odgojiteljima (validation-plan §5) — može se spojiti s intervjuima

## Demo izgradnja (vidi roadmap)
- [ ] [D0-1] Monorepo skeleton (pnpm, Turborepo, TS strict, ESLint granice), P3-1 spike
- [ ] [D0-2] `supabase/` config (sigurne postavke — local-development §3a), prve migracije: organizations, facilities, academic_years, groups, profiles, memberships, private helperi, grantovi
- [ ] [D0-3] pgTAP: ST-RLS-00 katalog + prvi NEG testovi; CI `quality`, `db`, `security`
- [ ] [D0-4] Sintetički seed generator (`packages/test-fixtures`) + sigurnosne ograde skripti
- [ ] [D1…D5] prema roadmapu (vertikalni slojevi)

## Faza 5 (unaprijed zabilježeno)
- [P5-1] CI provjera: tablica bez RLS-a ruši build
- [P5-2] Secret scanning + dependency scanning u CI-u
- [P5-3] Uključiti Impeccable hook (ako D-11) i zapisati u `.claude/settings.json`
- [P5-4] Skripta za dohvat Impeccable enginea iz npm registryja s provjerom SHA-256 (za nove sesije)
- [P5-5] Statička provjera kataloga baze (ST-RLS-00): RLS, `SECURITY DEFINER`, grantovi, `security_invoker`, javni bucketi
- [P5-6] pgTAP paket s negativnim testovima NEG-01…NEG-15 kao uvjet za merge
- [P5-7] Izvoz logova u EU pohranu (SR-LOG-03) — ovisi o Q-S08
- [P5-8] Potpisivanje OTA ažuriranja (SR-SUP-03)
- [P5-9] Push slanje uz obvezni pristupni token (SR-PUSH-02)
- [P5-10] Strojno čitljiva matrica dozvola + generator pgTAP testova (security-test-plan §1)
- [P5-11] CSP i sigurnosna zaglavlja admin weba (SR-WEB-02)
- [P5-12] Monitoring scrubbing + test (ST-LOG-01)
- [P5-13] Feature flag / način održavanja po modulu za brzo ograničavanje incidenta

## Faza 13 (unaprijed zabilježeno)
- [P13-1] Tabletop vježba incidentnog plana (najmanje P-01, P-03, P-04)
- [P13-2] Vježba rotacije ključeva i PITR restore u zasebnom okruženju
- [P13-3] Vanjski penetracijski test (ako D-13 odobren)
