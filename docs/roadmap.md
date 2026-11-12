# VrtićOS — Roadmap po fazama

Organizirano po fazama, ovisnostima i kriterijima prihvaćanja — ne po kalendaru.
Prelazak u sljedeću fazu uvijek traži **odobrenje vlasnika** (bilježi se u [phase-status.md](phase-status.md)).

## Predložene izmjene izvorne strukture faza

| # | Izmjena | Zašto |
|---|---|---|
| 1 | **Dodan kontinuirani tok "Validacija s kupcima" (od Faze 0)** | Nema potvrđenog pilota. Najveći rizik je tržišni (R-14), ne tehnički. Arhitektura bez razgovora s 3–5 vrtića riskira gradnju pogrešnih modula. |
| 2 | Faze 2 i 3 djelomično paralelne | Izbor procesora (Supabase, Vercel, Sentry) je istovremeno tehnička i GDPR odluka. |
| 3 | Revizijski zapis, i18n i infrastruktura obavijesti (outbox) premješteni u Fazu 5/6 | Naknadno dodavanje je skupo i ostavlja rupe u dokazima. |
| 4 | **Model privola** premješten u Fazu 7 (uz djecu); UI za medije ostaje u Fazi 11 | Privola mora postojati prije prve fotografije i prije nego se dijete uopće unese. |
| 5 | Prava ispitanika (izvoz, brisanje) i retencijski poslovi eksplicitno u Fazi 12 | Bez njih nema produkcije (kriterij sigurnosnog prihvaćanja). |
| 6 | Sigurnosna validacija kontinuirana; Faza 13 je završna potvrda, ne prvi put | RLS testovi nastaju s tablicama, ne na kraju. |

Kratice: **DoD** = Definition of Done. Svaki DoD implicitno uključuje: ažurirana dokumentacija, ažuriran
[phase-status.md](phase-status.md), bez otvorenih kritičnih rizika bez vlasnika.

---

## Izgradnja demo verzije (odluka vlasnika 2026-11-10)
Vlasnik je odlučio izgraditi funkcionalni demo cijele aplikacije prije završetka intervjua. MVP ostaje nepotvrđen.
Demo radi **samo lokalno** sa sintetičkim podacima (ADR-0009). Faze 5–12 izvode se kao **vertikalni slojevi**;
svaki sloj završava radnim tokom kroz bazu (RLS + testovi), mobilnu i admin aplikaciju:

**Stanje 2026-11-12:** Faza 4 ✅ · D0 ✅ · **D1 zaključen** (otvoreni rizici R-44, R-49, R-53, R-45/D-27 dokumentirani, ne blokiraju) · **D2 u tijeku**: D2-A, D2-B i D2-C izvedeni; plan: [architecture/d2-plan.md](architecture/d2-plan.md).

| Sloj | Sadržaj | Faze | Gotovo kada |
|---|---|---|---|
| D0 Temelj | monorepo, CI, lokalni stack, migracije osnovnih tablica i helpera, seed, ST-RLS-00 | 5 | `pnpm demo` pokreće sve; CI zelen |
| D1 Identitet i struktura | prijava OTP, MFA uprave, pozivnice (Mailpit), vrtić/objekti/godine/skupine, djelatnici i rasporedi | 6 (dio) | uprava postavi vrtić i pozove odgojitelja; NEG testovi prolaze |
| D2 Djeca i skrbnici | djeca, upisi, premještaj, skrbnici, ograničenja, ovlaštene osobe | 7 | skrbnik vidi samo svoje dijete (NEG-03…06) |
| D3 Dolasci i izostanci | evidencija s predajom, poništavanje, offline red, izostanci, pregled uprave | 8 (+ FS-14) | jutarnji tok < 30 s; AC-05/06 |
| D4 Komunikacija | obavijesti, centar obavijesti u aplikaciji, razgovori, dnevni pregled | 9–10 | AC-07, AC-10, AC-11 |
| D5 Demo poliranje | sintetički scenarij za prezentaciju, banner, skripta prezentacije, Impeccable audit | — | prezentacija vrtiću moguća |
| Nakon dema | fotografije (11), prava ispitanika i retencija (12), QA i vanjski pregled (13), pilot (14) | 11–14 | prema roadmapu |

## Tok V — Validacija s kupcima (kontinuirano, od Faze 0)
- **Cilj:** potvrditi problem, kupca, cijenu i proces nabave prije većeg ulaganja u razvoj.
- **Zadaci:** 3–5 razgovora s ravnateljima/odgojiteljima istarskih vrtića; razgovor s jednim DPO-om vrtića;
  razumjeti proces javne nabave (jednostavna nabava, pragovi) i proračunski ciklus osnivača; mapirati
  postojeće alate (papir, Viber/WhatsApp grupe, postojeći softver); pismo namjere za pilot.
- **Isporuke:** `docs/product/discovery-interviews.md`, ažuriran PRODUCT.md, prioritizirani MVP opseg.
- **Kriterij:** barem jedan vrtić pristaje na pilot pisanim putem prije Faze 14; MVP opseg potvrđen s ≥3 vrtića.
- **Rizik:** pravna osnova i DPA ovise o stvarnom kupcu — bez kupca su privatnosni dokumenti hipotetski.

---

## FAZA 0 — Discovery i postavljanje
- **Cilj:** inspekcija, alati, struktura dokumentacije, početni rizici, ADR-ovi, popis odluka.
- **Opseg:** samo dokumentacija i lokalni alati. Bez koda proizvoda.
- **Ovisnosti:** nema.
- **Zadaci:** inspekcija repozitorija i okruženja; instalacija i provjera Impeccable i UI UX Pro Max;
  preporuka dodatnih skillova; roadmap; dokumentacijska struktura; checklista za otkrivanje zahtjeva;
  privatnosna/sigurnosna pitanja; registar rizika; prvi ADR-ovi; popis odluka.
- **Isporuke:** `CLAUDE.md`, `PRODUCT.md`, `docs/**` (ovaj skup), `.claude/skills/**`.
- **Datoteke:** `CLAUDE.md`, `PRODUCT.md`, `.gitignore`, `docs/`, `.claude/skills/`.
- **Tehnički rizici:** mrežna ograničenja okruženja (impeccable.style blokiran); hookovi u RN projektu ograničene vrijednosti.
- **Privatnost/sigurnost:** instalacija skripti trećih strana (pregledano), telemetrija alata (isključena).
- **Testovi:** provjera da skillovi rade (pretraga, detektor, simulirani hook).
- **Kriteriji prihvaćanja:** sve isporuke postoje; vlasnik je pregledao izvještaj; odluke D-1…D-n zabilježene.
- **DoD:** commit + push na razvojnu granu; vlasnik odobrio prelazak u Fazu 1.

## FAZA 1 — Arhitektura proizvoda
- **Cilj:** potpuna, validirana slika proizvoda: uloge, dozvole, moduli, putovanja, pravila, entiteti.
- **Opseg:** PRD, funkcionalni i nefunkcionalni zahtjevi, matrica uloga i dozvola, korisnička putovanja,
  domenski model, rječnik pojmova (HR), MVP opseg, rubni slučajevi.
- **Ovisnosti:** Faza 0; tok V (barem 2 razgovora).
- **Zadaci:** rječnik; matrica dozvola; putovanja (odgojitelj: jutarnji dolazak, izostanak, dnevni pregled;
  roditelj: prva prijava, izostanak, poruka; ravnatelj: postavljanje godine, upis djeteta, premještaj);
  poslovna pravila (skrbništvo, ograničenja pristupa, zamjene, premještaji, višestruka članstva);
  MoSCoW prioritizacija; NFR (performanse, dostupnost, pristupačnost, podrška).
- **Isporuke:** `docs/product/prd.md`, `glossary.md`, `roles-and-permissions.md`, `user-journeys.md`,
  `business-rules.md`, `domain-model.md`, `nfr.md`, `mvp-scope.md`, `functional-specs.md`,
  `acceptance-criteria.md`, `validation-plan.md`, `traceability.md`, `consistency-review.md`;
  `docs/privacy/data-inventory.md` v0 (premješteno iz Faze 2 jer ga specifikacija treba).
- **Tehnički rizici:** prekompleksan model; nejasni pojmovi između vrtića.
- **Privatnost/sigurnost:** svaki atribut djeteta mora imati svrhu (ulaz u data inventory).
- **Testovi:** pregled matrice dozvola s pravim korisnicima (validacija, ne kod).
- **Kriteriji prihvaćanja:** svaka MVP funkcija ima korisnika, svrhu, pravila i dozvole; vlasnik odobrio MVP opseg.
- **DoD:** dokumenti pregledani; otvorena pitanja imaju vlasnika i rok.

## FAZA 2 — Privatnost, GDPR i sigurnosna arhitektura
- **Cilj:** privacy-by-design temelj prije implementacije.
- **Opseg:** 18 dokumenata u `docs/privacy/` (vidi [privacy/README.md](privacy/README.md)), threat model,
  izbor sigurnosnih kontrola (OWASP ASVS L2, MASVS, API Top 10).
- **Ovisnosti:** Faza 1 (inventar podataka iz domenskog modela); odluke D-3, D-6, D-7 (procesori).
- **Zadaci:** inventar i klasifikacija; mapa tokova; uloge voditelj/izvršitelj po toku; pravne osnove;
  DPIA screening → DPIA nacrt; retencija; postupci prava ispitanika i povrede; nacrt DPA; registar
  podizvršitelja; procjena prijenosa; threat model (STRIDE po komponenti); kontrolna lista ASVS.
- **Isporuke:** `docs/privacy/*` (18), `docs/security/threat-model.md`, `docs/security/controls.md`.
- **Tehnički rizici:** kontrole koje arhitektura ne može ispuniti → povratak u Fazu 3.
- **Privatnost/sigurnost:** sve stavke za pravnika jasno označene.
- **Testovi:** svaka kontrola ima predviđen test (pgTAP, e2e, ručni).
- **Kriteriji prihvaćanja:** svaka svrha obrade ima pravnu osnovu (nacrt) i rok čuvanja; DPIA nacrt postoji;
  popis pitanja za pravnika/DPO predan vlasniku.
- **DoD:** vlasnik odobrio; pravni pregled **zakazan** (ne nužno završen — završava prije Faze 14).

## FAZA 3 — Tehnička arhitektura
- **Cilj:** konačni tehnički dizajn i prihvaćeni ADR-ovi.
- **Opseg:** schema po modulima, RLS strategija, API i error konvencije, obavijesti, mediji, pretraga,
  izvještaji, audit, okruženja, CI/CD, sigurnosne kopije, monitoring.
- **Ovisnosti:** Faze 1–2.
- **Zadaci:** dovršiti ADR 0002–0008; nove ADR-ove (email, mediji, offline, backup); spike: Expo + pnpm
  monorepo; spike: RLS helperi + pgTAP performanse s 1.000 djece.
- **Isporuke:** ažuriran `docs/architecture.md`, `docs/architecture/*.md`, prihvaćeni ADR-ovi.
- **Tehnički rizici:** performanse RLS politika; Expo/pnpm kompatibilnost.
- **Privatnost/sigurnost:** svaki procesor ima DPA i zapis u registru.
- **Testovi:** spike rezultati dokumentirani s mjerenjima.
- **Kriteriji prihvaćanja:** svi ADR-ovi Accepted/Rejected; ERD odgovara domenskom modelu.
- **DoD:** vlasnik odobrio arhitekturu.

## FAZA 4 — Dizajn sustav i Figma
- **Cilj:** vizualni sustav i ključni ekrani prije implementacije.
- **Opseg:** DESIGN.md (Impeccable), tokeni (boja, tipografija, razmaci, radijusi, sjene, pokreti), ikone,
  komponente, stanja (loading/empty/error/success), ključni ekrani mobilne i admin aplikacije u Figmi.
- **Ovisnosti:** Faza 1 (putovanja), PRODUCT.md.
- **Zadaci:** `/impeccable shape` za ključne ekrane; paleta s provjerom kontrasta; tipografija s podrškom
  za hrvatske dijakritike (č ć đ š ž) i talijanski; iOS/Android konvencije; prototip za testiranje s 3–5 odgojitelja.
- **Isporuke:** `DESIGN.md`, `packages/design-tokens` specifikacija, Figma datoteka, rezultati testiranja.
- **Rizici:** "dječji" ili generički izgled; nedostupni kontrasti mekane zelene.
- **Privatnost:** mockupi samo sa sintetičkim podacima i ilustracijama, bez stvarnih fotografija djece.
- **Testovi:** kontrast (WCAG 2.2 AA), test upotrebljivosti prototipa, Impeccable critique/audit.
- **Kriteriji prihvaćanja:** odgojitelj u testu evidentira dolazak grupe u < 30 s; svi tokeni prolaze kontrast.
- **DoD:** vlasnik odobrio dizajn smjer i tokene.

## FAZA 5 — Inženjerski temelj
- **Cilj:** monorepo, CI, okruženja, kvaliteta i sigurnost od prvog commita koda.
- **Opseg:** pnpm + Turborepo, TS strict, ESLint/Prettier, Zod paket, i18n paket, tokeni, Supabase CLI lokalno,
  migracije, pgTAP, seed sa sintetičkim podacima, CI (lint, typecheck, test, RLS provjera, secret scanning,
  dependency scanning), env dokumentacija, Sentry konfiguracija sa scrubbingom, audit log temelj, outbox.
- **Ovisnosti:** Faza 3 (ADR-ovi), D-3.
- **Isporuke:** `apps/*` skeleti, `packages/*`, `supabase/*`, `.github/workflows/*`, `.env.example`.
- **Rizici:** lanac opskrbe (R-17); tajne u repozitoriju (R-16).
- **Testovi:** CI prolazi; test koji pada ako tablica nema RLS; test scrubbinga Sentryja.
- **Kriteriji prihvaćanja:** prazan "hello" tok od mobilne aplikacije do baze pod RLS-om, u CI-u.
- **DoD:** staging projekt postoji (uz odobrenje), produkcija ne.

## FAZA 6 — Organizacije, autentikacija i dozvole

> **Stanje 2026-11-11:** demo sloj D1 pokriva dio ove faze (organizacijska struktura, članstva, pozivnice, prijava kodom,
> MFA uprave, audit zapisi). **Namjerno odgođeno** jer nije bilo u D1 nalogu vlasnika: upravljanje sesijama/uređajima,
> break-glass za platform admina, testovi rate limitinga i isteka sesije — popis u [backlog.md](backlog.md) (D1).
> Cross-tenant testovi čitanja za `academic_years` i `audit_events` dodani su 2026-11-12 (R-52 zatvoren, CI run #12).
> Faza 6 se i dalje ne smatra završenom zbog namjerno odgođenih stavki iznad.
- **Cilj:** sigurna osnova identiteta i pristupa.
- **Opseg:** organizacije, objekti, pedagoška godina, članstva, uloge, pozivnice, prijava (OTP), MFA za upravu,
  upravljanje sesijama/uređajima, break-glass za platform admina, audit zapisi.
- **Ovisnosti:** Faza 5, ADR-0005, ADR-0008.
- **Rizici:** preuzimanje računa (R-06), eskalacija privilegija (R-02).
- **Testovi:** pgTAP negativni testovi po ulozi; rate limiting; e2e prijava i poziv; istek sesije.
- **Kriteriji prihvaćanja:** korisnik org A ne može pročitati ništa iz org B (dokazano testovima za svaku tablicu).

## FAZA 7 — Djeca, skrbnici, skupine i djelatnici
- **Opseg:** djeca (minimalni atributi), skrbništvo s dozvolama i ograničenjima, osobe za preuzimanje,
  skupine, upisi (vremenski ograničeni), raspored djelatnika (uključujući zamjene), **model privola**.
- **Ovisnosti:** Faza 6; odluke o atributima djeteta (Q-P02, Q-P03).
- **Rizici:** roditelj vidi tuđe dijete (R-04); odgojitelj izvan skupine (R-05); skrbništvo/sudske odluke.
- **Testovi:** matrica dozvola kao pgTAP; premještaj djeteta oduzima pristup starom odgojitelju odmah.
- **Kriteriji prihvaćanja:** sve kombinacije iz matrice dozvola testirane pozitivno i negativno.

## FAZA 8 — Dolasci i izostanci
- **Opseg:** check-in/out (tko je doveo/odveo — samo ovlaštene osobe), izostanci od roditelja, pregled
  po skupini, tolerancija na loš internet (red čekanja + idempotentnost).
- **Rizici:** pogrešna evidencija (sigurnost djeteta), dvostruki unosi.
- **Testovi:** idempotentnost, konflikti, offline red, e2e na uređaju.
- **Kriteriji prihvaćanja:** odgojitelj evidentira dolazak skupine od 20 djece < 30 s; roditelj prijavi
  izostanak u < 3 dodira; nema izgubljenih unosa pri prekidu mreže.

## FAZA 9 — Dnevni izvještaji, aktivnosti i jelovnici
- **Opseg:** kratki dnevni pregled (obroci, spavanje, raspoloženje — **samo ako vrtić potvrdi svrhu**),
  aktivnosti skupine, jelovnici po objektu.
- **Privatnost:** opažanja o razvoju djeteta mogu biti "evaluacija" — predmet DPIA; alergije = zdravstveni
  podaci (čl. 9) — **izvan MVP-a dok se ne odobri** (D-9).
- **Kriteriji prihvaćanja:** dnevni pregled za skupinu u < 2 min; jelovnik objavljen tjedno.

## FAZA 10 — Obavijesti, poruke i push
- **Opseg:** obavijesti (organizacija/objekt/skupina), poruke roditelj↔odgojitelji (grupni razgovor oko
  djeteta, ne privatni 1:1 s pojedinim zaposlenikom — **odluka D-10**), push bez osobnih podataka,
  postavke obavijesti, tiho razdoblje.
- **Rizici:** curenje kroz push (R-07); očekivanje odgovora izvan radnog vremena (rizik za odgojitelje).
- **Testovi:** push payload ne sadrži PII (automatizirani test); RLS na razgovorima.

## FAZA 11 — Fotografije, mediji i privole
- **Opseg:** upload (resize, EXIF strip, validacija), privatni bucketi, potpisani URL-ovi, označavanje djece,
  provjera privola svih označenih, povlačenje privole (skrivanje), zabrana preuzimanja **[otvoreno]**.
- **Rizici:** javni bucket (R-11), zlonamjerni upload (R-15), fotografija djeteta bez privole.
- **Testovi:** storage politike (pozitivni/negativni), istek URL-a, povlačenje privole skriva fotografiju odmah.

## FAZA 12 — Izvještaji i administracija
- **Opseg:** izvještaji o dolascima, izvoz (auditiran), prava ispitanika (pristup, ispravak, brisanje, izvoz),
  retencijski poslovi, administracija platforme, upravljanje podizvršiteljima.
- **Kriteriji prihvaćanja:** zahtjev ispitanika proveden end-to-end u testnom okruženju; retencija briše
  podatke prema politici (dokazano testom).

## FAZA 13 — Osiguranje kvalitete i sigurnosna validacija
- **Opseg:** cjelovit pregled RLS-a, penetracijsko testiranje (vanjsko — **plaćeno, odobrenje**), MASVS
  provjera, test povrata iz backupa, scanning tajni i ovisnosti, pristupačnost (WCAG 2.2 AA), performanse,
  pregled incident plana.
- **Kriteriji prihvaćanja:** svi "security acceptance criteria" iz master briefa ispunjeni i dokumentirani.

## FAZA 14 — Pilot i spremnost za produkciju
- **Opseg:** produkcijska infrastruktura (odobrenje), potpisani DPA s pilot vrtićem, pravni pregled dokumenata
  završen, obavijesti o privatnosti objavljene, obuka odgojitelja, podrška, plan povlačenja, mjerila uspjeha pilota.
- **Kriteriji prihvaćanja:** pravni pregled potvrđen; DPIA odobrena od voditelja obrade; restore testiran;
  incident plan uvježban; vlasnik odobrio go-live.
