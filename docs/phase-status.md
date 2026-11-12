# Status faza

**Trenutna faza:** sloj **D1** (prijava, MFA uprave, pozivnice, rasporedi, struktura vrtića) — **izveden, čeka pregled vlasnika**; otvoreno: provjera mobilne aplikacije na uređaju (R-44) i zaštita grane `main` (D-27)
**Zadnja provjera:** 2026-11-11 (D1) — lint, typecheck, 99 unit testova, **105 pgTAP**, RLS spike 14/14, **20 integracijskih** (Edge Functions, kod iz Mailpita, TOTP), **8 Playwright e2e** (admin), admin build, Expo export
**CI:** GitHub Actions [run #10](https://github.com/rJovicic/Vrti-kOS/actions/runs/43173757352) (commit `4c7f599`: Parent Home UI, R-49 zabrana lozinki, usklađena dokumentacija) — sva 4 posla zelena; prethodno run #8 (commit `6c9a8a2`, kraj D1) — sva 4 posla zelena: lint/typecheck/unit, baza (migracije od nule, pgTAP, spike, tipovi, integracijski i Playwright e2e testovi), admin build + Expo bundle (provjera tajni), gitleaks + audit.
**Odluka vlasnika 2026-11-10:** izgraditi funkcionalni demo cijele aplikacije prije završetka intervjua; MVP ostaje nepotvrđen (D-19).
**Faza 1:** specifikacija izrađena (nacrt); MVP nije zaključan
**Paralelni tok:** V — validacija s kupcima → **nije započet**
**Zadnje ažuriranje:** 2026-11-11

## ✅ Završeno
- Inspekcija repozitorija (prazan, samo README) i okruženja (Node 22.23, npm 10.9, pnpm 10.28, Python 3.13, Git 2.43, Claude Code 2.1.322)
- Impeccable 4.8.2 instaliran i provjeren (detektor, simulirani hook, registracija skilla); telemetrija isključena
- UI UX Pro Max 2.15.0 instaliran i provjeren (pretraga, design-system, RN i Next.js smjernice); suvišni skillovi uklonjeni
- Impeccable init intervju (4 pitanja) → `PRODUCT.md`
- Preporuka dodatnih skillova → [tooling/skills.md](tooling/skills.md)
- Roadmap po fazama → [roadmap.md](roadmap.md)
- Dokumentacijska struktura, `CLAUDE.md`
- Checklista otkrivanja zahtjeva → [product/discovery-checklist.md](product/discovery-checklist.md)
- Otvorena pitanja (privatnost, sigurnost, proizvod) → [open-questions.md](open-questions.md)
- Registar rizika (24 rizika) → [risks.md](risks.md)
- ADR 0001–0008 → [decisions/](decisions/)
- DPIA screening v0 → [privacy/dpia-screening.md](privacy/dpia-screening.md)

## 🔄 U tijeku
- Faza 1: kompletan nacrt specifikacije (PRD, FS-01…FS-15, kriteriji prihvaćanja, inventar podataka, plan validacije) — **čeka tok V** (intervjui) za zaključavanje MVP-a.
- Supabase skill: službene smjernice učitane za arhitekturni rad; instalacija u projekt još nije provedena.
- **Faza 4 — dizajn (2026-11-11):** ✅ [DESIGN.md](../DESIGN.md) (tokeni generirani iz `packages/tokens`), prototip 18 mobilnih i 5 admin ekrana u [design/prototype/](../design/prototype/) sa svim stanjima evidencije dolazaka; Impeccable detektor bez blokirajućih nalaza (2 savjetodavna).
- **Parent Home UI (2026-11-11, nakon D1):** izveden kao prezentacijski ekran + dev preview sa sintetičkim podacima; lokalno provjeren (mobilni Vitest, typecheck, Expo export); vizualna provjera na simulatoru još nije obavljena (R-44). Backlog D1-11, [architecture/mobile-app.md](architecture/mobile-app.md) §1.
- **Pregled arhitekture i dokumentacije (2026-11-11):** nalazi zabilježeni kao R-47…R-53 i backlog D1-12/D1-13. **R-49** (lozinke) potvrđen testovima, a 2026-11-11 po odluci vlasnika **lokalno ispravljen** (lozinke zabranjene za sve, ADR-0008 dopuna; pgTAP 124/124, integracijski 27/27, e2e 8/8) — GitHub CI dokaz postoji (run #10, commit `4c7f599`); ostaje otvoren do ponovne procjene na hosted Supabaseu prije staginga. Ostali nalazi nisu ispravljeni. Dokumentacija usklađena s kodom (technical-architecture, mobile-app, local-development, architecture, ADR-0010/0014/0015/0016, registar rizika).
- **Iz Faze 6 namjerno odgođeno** (nije bilo u D1 nalogu): sesije i uređaji, obavijest o novom uređaju, break-glass platform admina, testovi rate limita i isteka sesije, ponovno slanje pozivnice, ekran za novi vrtić, potvrda obavijesti o privatnosti — [backlog.md](backlog.md) D1. Ciljni sloj određuje vlasnik.
- **D1 — identitet i struktura (2026-11-11):** ✅ migracije `staff_assignments`, `invitations` (+ `api.accept_invitations`), čuvar članstava; Edge Functions `invite-member`, `accept-invitations`; prijava kodom iz e-pošte (predlošci bez poveznice); TOTP MFA (AAL2) za upravu; admin: objekti, ped. godine, skupine, djelatnici i rasporedi (redovni/zamjena), pozivnice; mobilna: keychain sesija, prijava kodom, „Moje skupine danas”, prazno stanje roditelja; sintetički seed; CI integracija + e2e. ⚠️ mobilna nije pokrenuta na simulatoru (R-44). Detalji: [architecture/d1-implementation.md](architecture/d1-implementation.md) §4, ADR-0017.
- **D0 — tehnički temelj (2026-11-11):** ✅ monorepo (pnpm 12, Turborepo, TS 6.0.3), Expo SDK 58 app, Next.js 16 admin, paketi tokens/i18n/validation/domain/db-types/test-fixtures, Supabase lokalno + Mailpit, 3 migracije (6 tablica + audit), RLS + helperi + grantovi, sintetički seed (Alfa/Beta), pgTAP testovi izolacije, GitHub Actions CI, `pnpm demo`.
- **Faza 3 — tehnička arhitektura (2026-11-10):**
  - [x] [architecture/technical-architecture.md](architecture/technical-architecture.md), [database-schema.md](architecture/database-schema.md), [api-conventions.md](architecture/api-conventions.md), [mobile-app.md](architecture/mobile-app.md), [admin-app.md](architecture/admin-app.md), [local-development.md](architecture/local-development.md)
  - [x] ADR-0009…0015 (Proposed) + dodatak ADR-0006
  - [x] Lokalni Supabase stack pokrenut u ovom okruženju (Docker Hub registry); RLS spike 14/14 — [architecture/spikes/rls-spike.sql](architecture/spikes/rls-spike.sql)
  - [x] Spike Expo + pnpm + TypeScript 7 (P3-1) → ADR-0016 (TS 7 odbijen)
- **Faza 2 — ograničeni opseg** (nalog vlasnika 2026-11-10: sigurnosna arhitektura i priprema za incidente; ostali privatnosni dokumenti čekaju validaciju). D-18 i dalje formalno čeka odluku vlasnika o punoj Fazi 2.
  - [x] Threat model (STRIDE) — [security/threat-model.md](security/threat-model.md)
  - [x] Sigurnosni zahtjevi (SR, Critical–Low, NEG-01…15) — [security/security-requirements.md](security/security-requirements.md)
  - [x] Plan sigurnosnog testiranja — [security/security-test-plan.md](security/security-test-plan.md)
  - [x] Plan odgovora na incidente (nacrt, uloge neimenovane, nije uvježban) — [security/incident-response-plan.md](security/incident-response-plan.md)
  - [ ] ASVS/MASVS kontrolna lista (P2-20), registar podizvršitelja (P2-24), imenovanje uloga za incidente (P2-25)

## ⛔ Blokirano
- `npx impeccable install` / `update` — `impeccable.style` blokiran mrežnom politikom okruženja (zaobiđeno instalacijom iz git taga).
- 17 od 18 privatnosnih dokumenata — ovise o Fazi 1 i odlukama o procesorima (namjerno, vidi [privacy/README.md](privacy/README.md)).

## ⏳ Čeka odobrenje vlasnika

| ID | Odluka | Preporuka | Dokument |
|---|---|---|---|
| D-1 | Izmjene strukture faza (tok V, model privola u F7, audit/i18n u F5–6…) | Prihvatiti | [roadmap.md](roadmap.md) |
| D-2 | Modularni monolit, pnpm + Turborepo monorepo | Prihvatiti | ADR-0002 |
| D-3 | Supabase Cloud, EU (Frankfurt) — plaćena usluga + podizvršitelj | Prihvatiti uvjetno (DPA, procjena prijenosa, PITR) | ADR-0003 |
| D-4 | Multi-tenancy: zajednička shema + RLS | Prihvatiti | ADR-0004 |
| D-5 | Autorizacija: uloge + relacijske provjere u Postgresu, bez trajnog pristupa platform admina | Prihvatiti | ADR-0005 |
| D-6 | Jedna Expo aplikacija + Next.js admin; hosting admina (Vercel fra1 vs EU host) | Jedna app + Next.js; hosting odlučiti nakon razgovora s DPO-om | ADR-0006 |
| D-7 | Push (Expo, bez PII), e-mail (EU pružatelj), Sentry EU sa scrubbingom, **bez analitike** | Prihvatiti | ADR-0007 |
| D-8 | Prijava: samo pozivnice, OTP za roditelje, obvezni MFA za upravu | Prihvatiti | ADR-0008 |
| D-9 | Zdravstveni podaci (alergije, lijekovi) **izvan MVP-a** | Prihvatiti | [open-questions.md](open-questions.md) Q-P12 |
| D-10 | Poruke kao razgovor roditelj ↔ tim skupine (ne privatni 1:1) | Validirati s vrtićima | Q-T05 |
| D-11 | Uključivanje Impeccable hookova (sada ili u Fazi 4/5) | Odgoditi do UI koda | [tooling/skills.md](tooling/skills.md) |
| D-12 | Instalacija preporučenih skillova (Supabase odmah; Expo/RN/React u F5; Trail of Bits u F5) | Supabase skill sada | [tooling/skills.md](tooling/skills.md) |
| D-13 | Ciljna razina OWASP ASVS L2; vanjski pentest prije pilota (plaćeno) | Prihvatiti | Q-S01, Q-S02 |
| ~~D-14~~ | ~~Odobrenje prelaska u Fazu 1~~ | **Odobreno za dokumentacijski rad** (nalog vlasnika 2026-11-10); implementacija nije odobrena | — |
| D-15 | Model privola graditi tek kad prva svrha temeljena na privoli (npr. fotografije) uđe u opseg; u MVP-u nema privola | Prihvatiti | [product/consistency-review.md](product/consistency-review.md) N-12 |
| D-16 | Pregled dokumentacijskih odluka DD-01…DD-08 i pretpostavki A-01…A-09 | Pregledati i potvrditi/odbiti | [product/consistency-review.md](product/consistency-review.md), [product/prd.md](product/prd.md) §9 |
| D-17 | Pokretanje toka V: potvrda plana validacije i popisa kontakata (ravnatelji, odgojitelji, DPO) | Pokrenuti odmah — blokira zaključavanje MVP-a | [product/validation-plan.md](product/validation-plan.md) |
| D-18 | Prijelaz u Fazu 2 (privatnost/sigurnost) paralelno s validacijom ili tek nakon nje | Paralelno samo za dokumente neovisne o opsegu (threat model, breach plan); ostalo nakon validacije | [roadmap.md](roadmap.md) |
| ~~D-19~~ | ~~Demo prije validacije~~ | **Odluka vlasnika 2026-11-10:** graditi demo cijele aplikacije; MVP nepotvrđen; samo lokalno i sintetički | [roadmap.md](roadmap.md) (Izgradnja demo verzije) |
| ~~D-20~~ | ~~ADR-0009…0015~~ | **Odobreno 2026-11-11 samo za lokalni demo:** ADR 0009, 0012, 0014, 0015. ADR 0010, 0011, 0013 ostaju Proposed | [decisions/](decisions/) |
| ~~D-21~~ | ~~DD-09…DD-11~~ | **Odobreno 2026-11-11** kao privremena pravila demo verzije | [product/consistency-review.md](product/consistency-review.md) |
| ~~D-22~~ | ~~Faza 4 i D0~~ | **Odobreno 2026-11-11**; oboje izvedeno | [roadmap.md](roadmap.md) |
| ~~D-23~~ | ~~ADR-0016: TypeScript 6.0.3 umjesto 7, pnpm 12 kroz Corepack, izolirani node_modules~~ | **Potvrđeno 2026-11-11** u nalogu vlasnika za D1 („Potvrđene odluke: D-23: zadržati postojeći tehnološki stack.”); ADR-0016 prihvaćen za lokalni demo | [decisions/0016-toolchain-versions.md](decisions/0016-toolchain-versions.md) |
| ~~D-24~~ | ~~Pregled dizajn sustava (DESIGN.md, smjer „zid garderobe”) i prototipa~~ | **Potvrđeno 2026-11-11** u nalogu vlasnika za D1 („D-24: potvrđen dizajnerski smjer „zid garderobe”.”). Potvrđen je smjer; nativni izgled još nije provjeren na uređaju (R-44) | [../DESIGN.md](../DESIGN.md), [../design/prototype/](../design/prototype/) |
| ~~D-25~~ | ~~Početak sloja D1~~ | **Odobreno 2026-11-11**; izvedeno (vidi gore) | [backlog.md](backlog.md) |
| D-26 | ADR-0017: tok pozivnica i prijave (bez tokena u e-pošti, pozivnica vezana uz potvrđenu adresu); **samo `org_admin` dodjeljuje i mijenja `org_admin` prava** (strože od „Ogr.” u matrici za ravnatelja) | Prihvatiti za demo; pravilo o ravnatelju potvrditi s vrtićima | [decisions/0017-invitation-and-sign-in-flow.md](decisions/0017-invitation-and-sign-in-flow.md) |
| D-27 | **Zaštita grane `main`** (radnja vlasnika — sesija nema ovlast). GitHub → Settings → Branches (ili Rules → Rulesets) za `main`: zahtijevaj pull request prije spajanja (≥1 odobrenje, poništi odobrenja nakon novih commitova); zahtijevaj zelene provjere `lint · typecheck · unit tests`, `database · migrations · RLS · integration · e2e`, `admin build · mobile bundle`, `secrets · dependencies` i ažurnu granu; zabrani force push i brisanje; linearna povijest; pravila vrijede i za administratore | Postaviti odmah (R-45) | [risks.md](risks.md) R-45 |
| D-28 | Prijelaz na D2 (djeca, upisi, skrbnici, pozivnice roditelja) | Nakon pregleda D1 i D-27 | [backlog.md](backlog.md) |

## Pravne/privatnosne odluke koje NE donosim umjesto vlasnika ⚖️
Uloge voditelj/izvršitelj po tokovima, pravne osnove, rokovi čuvanja, obveznost DPIA, prihvatljivost
US-matičnih procesora — vidi Q-P01…Q-P16. Incidentni plan pretpostavlja ulogu izvršitelja (IR-A1) i ne odlučuje o obavještavanju AZOP-a ni ispitanika.


## Napredak Faze 1 — 2026-11-10

- [x] P1-1 Rječnik pojmova — `product/glossary.md` (nacrt v0.1)
- [x] P1-2 Matrica uloga i dozvola — `product/roles-and-permissions.md` (nacrt v0)
- [x] P1-3 Korisnička putovanja — `product/user-journeys.md` (nacrt v0.1)
- [x] P1-4 Poslovna pravila — `product/business-rules.md` (nacrt v0.1)
- [x] P1-5 Domenski model — `product/domain-model.md` (nacrt v0.1)
- [x] P1-6 Nefunkcionalni zahtjevi — `product/nfr.md` (nacrt v0.1)
- [x] Privremeni MVP opseg — `product/mvp-scope.md` (nije zaključan)
- [ ] V-2 Razgovori s 3–5 vrtića
- [ ] V-3 Razgovor s DPO-om
- [x] Pregled dosljednosti — `product/consistency-review.md` (22 nalaza, 8 dokumentacijskih odluka)
- [x] PRD nacrt v0.1 — `product/prd.md`
- [x] Funkcionalne specifikacije FS-01…FS-15 — `product/functional-specs.md`
- [x] Kriteriji prihvaćanja (Given/When/Then, uključujući negativne testove autorizacije) — `product/acceptance-criteria.md`
- [x] Inventar podataka v0 — `privacy/data-inventory.md`
- [x] Plan validacije i vodiči za intervjue — `product/validation-plan.md`
- [x] Sljedivost i provjera usklađenosti — `product/traceability.md`
- [ ] P1-7 Zaključavanje PRD-a i MVP-a nakon validacije (kriterij u `product/mvp-scope.md`)
- [ ] P1-11 Dopuna kriterija prihvaćanja za preostale FR-ove
- [ ] P1-13 Pregled matrice dozvola s ravnateljem/odgojiteljima/DPO-om

**Kriterij završetka Faze 1 (roadmap):** nije zadovoljen — MVP opseg nije potvrđen s vrtićima, matrica dozvola nije pregledana s korisnicima/DPO-om.

**Granica:** svi novonastali dokumenti su prijedlozi za pregled. Ne predstavljaju odobrenje pravnih, financijskih, hosting ili produkcijskih odluka. Nema koda proizvoda, deploya ni stvarnih podataka.
