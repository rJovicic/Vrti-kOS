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
- [x] [P3-1] Spike: Expo + pnpm + Turborepo + TypeScript 7 → ADR-0016
- [x] [P3-2a] Spike: RLS helperi, kompozitni FK, exclusion, opoziv — `architecture/spikes/rls-spike.sql` (14/14)
- [ ] [P3-2b] Mjerenje performansi RLS-a s 10 vrtića / 1.000 djece — D0
- [x] [P3-3] ADR-ovi 0009–0015 (lokalni demo, e-pošta, mediji, offline, backup, autorizacija u bazi, klijentski stog) + dodatak ADR-0006 (hosting admina)
- [x] [P3-4] Tehnička arhitektura, shema baze, API konvencije, mobilna i admin aplikacija, lokalno okruženje — `architecture/`

## Faza 4 — Dizajn (sljedeće)
- [x] [P4-1] Impeccable: context, concept-seed (degradirano), surface brief za evidenciju dolazaka
- [x] [P4-2] DESIGN.md (frontmatter generiran iz tokena; `pnpm design:sync`)
- [x] [P4-3] `packages/tokens` (TS izvor + CSS) s testom kontrasta (60 provjera)
- [x] [P4-4] HTML prototip: 18 mobilnih okvira (10 stanja evidencije), 5 admin ekrana — `design/prototype/`
- [ ] [P4-5] Test prototipa s odgojiteljima (validation-plan §5) — spojiti s intervjuima (D-17)
- [ ] [P4-6] Provjera nativnog izgleda na iOS simulatoru / Android emulatoru (R-41) — u D3
- [ ] [P4-7] Impeccable finish-reviewer i documenter subagenti nisu pokrenuti — pokrenuti nakon D3 nad stvarnim ekranom

## Demo izgradnja (vidi roadmap)
- [x] [D0-1] Monorepo (pnpm 12, Turborepo, TS 6.0.3 strict, ESLint s pravilima granica)
- [x] [D0-2] `supabase/` config (sigurne postavke) + 3 migracije (6 tablica, audit, helperi, RLS, grantovi)
- [x] [D0-3] pgTAP: 12 kataloških + 44 testa izolacije; CI jobovi `quality`, `db`, `apps`, `security`
- [x] [D0-4] Sintetički seed generator + `guard-local` i `pnpm demo`

### D1 — identitet i struktura (izvedeno 2026-11-11, vidi architecture/d1-implementation.md §4)
- [x] [D1-1] Edge Functions `invite-member`, `accept-invitations`; opoziv kroz RLS (ADR-0017). `create-organization` (platform admin) → D2
- [x] [D1-2] `invitations` + `api.accept_invitations` (profil i članstvo iz pozivnice, nikad iz `user_metadata`; umjesto triggera, ADR-0017)
- [x] [D1-3] Mobilna i admin prijava kodom (Mailpit), TOTP MFA za upravu (AAL2), odjava — ⚠️ mobilna nije pokrenuta na uređaju (R-44)
- [x] [D1-4] `staff_assignments` (regular/substitute) + politike za odgojitelje (grupe danas), proširenje `visible_profile_ids`
- [x] [D1-5] Admin: objekti, pedagoške godine, skupine, djelatnici i rasporedi (FS-02, FS-03) prema prototipu
- [x] [D1-6] Seed: rasporedi i zamjena; pgTAP NEG-07/08 za rasporede
- [x] [D1-7a] CI na GitHubu zelen (run #6 prvi s integracijskim i e2e testovima; zadnji run #10, commit `4c7f599`)
- [ ] [D1-7b] Branch protection za `main` — **radnja vlasnika (D-27)**, `main` trenutačno nije zaštićen
- [ ] [D1-8] Pokretanje mobilne aplikacije na iOS simulatoru / Android emulatoru (R-44)
- [ ] [D1-9] Ponovno slanje pozivnice (FR-01-2), ekran platform admina za novi vrtić (FR-02-1), potvrda obavijesti o privatnosti (FR-01-5)
- [ ] [D1-10] Aplikacijska ljuska mobilne aplikacije: grupe ruta s guardovima (sesija, aktivno članstvo, potvrda obavijesti FR-01-5), donja traka kartica i Android rail prema DESIGN.md (Layout), prebacivanje vrtića/načina rada. Preduvjet za D2–D3; ne započeto
- [ ] [D1-11] Parent Home UI (`apps/mobile/src/features/guardian-home/`, dev preview `vrticos://dev/parent-home`) — izvedeno i lokalno provjereno (mobilni Vitest, typecheck, Expo export); čeka vizualnu provjeru na simulatoru ili uređaju (R-44)
- [ ] [D1-12] Sigurnosni nalazi pregleda arhitekture (2026-11-11). **Zatvoreno 2026-11-12 (GitHub CI run #12):** suspenzija vs. pozivnica na čekanju (R-48), Deno check/lint za Edge Functions (R-47), cross-tenant testovi čitanja za `academic_years` i `audit_events` (R-52). **Otvoreno:** put prijave lozinkom (R-49 — implementirano i dokazano u CI-ju, run #10; čeka procjenu na hosted Supabaseu), limit pozivnica (R-50), audit prema SR-AUD-01/02 (R-51)
- [ ] [D1-13] Katalog `errorCodes` (`packages/validation/src/errors.ts`) uskladiti sa stvarnim kodovima: dodati `METHOD_NOT_ALLOWED`, `INVITATION_PENDING_EXISTS` i `MEMBERSHIP_SUSPENDED` (koriste ih Edge Functions; `INVITATION_PENDING_EXISTS` i `MEMBERSHIP_SUSPENDED` već imaju hrvatski tekst), ukloniti ili iskoristiti nekorišteni `INVITATION_ALREADY_USED`; dodati `errors.METHOD_NOT_ALLOWED` u i18n. Sljedeći tehnički zadatak, nije dio dokumentacijskog usklađivanja

#### Iz roadmapa Faze 6 namjerno odgođeno (nije bilo u D1 nalogu vlasnika od 5 stavki; ciljni sloj određuje vlasnik)
- [ ] Upravljanje sesijama i uređajima, odjava svih sesija (FR-01-8, SR-SESS-03)
- [ ] Obavijest o prijavi s novog uređaja (SR-AUTHN-06)
- [ ] Break-glass pristup platform admina s razlogom, rokom i auditom vidljivim vrtiću (ADR-0005)
- [ ] Testovi rate limita prijave i provjere koda (SR-AUTHN-02) i isteka sesije (Faza 6 „Testovi”)
- [ ] Ponovno slanje pozivnice, ekran platform admina za novi vrtić, potvrda obavijesti o privatnosti (vidi D1-9)
- [ ] [D2…D5] prema roadmapu

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
