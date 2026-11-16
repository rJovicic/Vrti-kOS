# VrtićOS — procjena spremnosti nakon D5

**Datum:** 2026-11-16 · **Grana:** `claude/vrtricos-master-init-zv9c14` · **Pregledani commit:** `f610167`
(jednak `origin`, bez necommitanih promjena na početku) · **CI:** run #56 na `f610167` — sva 4 posla uspješna
(provjereno izravno kroz GitHub API, uključujući korak „demo resets to the same presentation scenario (D5)”).

> **Dodatak 2026-11-16:** vlasnik je donio odluke D-41 (R-54) i D-42 (D-10/Q-P11); zaštita `main` provjerena u
> detalje — ruleset je aktivan od 2026-11-12. Vidi [decision-followup.md](decision-followup.md). Ostatak dokumenta je
> snimka stanja na `f610167` i nije naknadno mijenjan, osim ispravka oznake u §3.2.

> Ovo je procjena stanja, ne odobrenje razvoja. Ništa nije popravljano u sklopu ovog zadatka; nalazi su samo
> dokumentirani. Ništa nije deployano, spojeno u `main`, niti je mijenjan hosted Supabase ili aktiviran Expo Push.

---

## 1. Sažetak stvarnog stanja

VrtićOS je **funkcionalan lokalni demo** (ADR-0009) s tri uloge kroz bazu, administraciju i mobilnu aplikaciju:
identitet i struktura (D1), djeca i skrbnici (D2), dolasci i izostanci (D3), komunikacija (D4), dostava push
obavijesti bez aktivacije (D-40) i demo poliranje (D5). Sigurnosni model (RLS, MFA uprave, funkcije u `private`
shemi, audit bez sadržaja) je dosljedan i potvrđen neovisnim upitima nad katalogom baze (§4.1).

Ono što **nije** dokazano: rad mobilne aplikacije na stvarnom uređaju (R-44, R-55), rad izvan lokalnog stacka
(nema staginga ni produkcije), pravni okvir (DPA, DPIA, pravna osnova, retencija), te tržišna validacija (tok V
„nije započet” — PRODUCT/roadmap).

**Ukratko:** spremno za **lokalnu tehničku provjeru i internu prezentaciju na prijenosnom računalu**. Za
**kontrolirano testiranje na stvarnim uređajima** nedostaje jedna radnja vlasnika (pokretanje na telefonu uz
lokalni stack) ili odluka o testnom okruženju. **Nije spremno za pilot** — blokiraju ga pravne i infrastrukturne
odluke te nekoliko „Must” funkcija prije produkcije (§9).

## 2. Potvrđene dovršene faze

| Faza / sloj | Stanje | Dokaz |
|---|---|---|
| Faze 0–4 (discovery, specifikacija, arhitektura, dizajn) | dovršene kao nacrti; **MVP nije potvrđen** (D-19), tok V nije započet | phase-status, roadmap |
| D0 temelj | ✅ | CI, `pnpm demo`, ST-RLS-00 u pgTAP 00 |
| D1 identitet i struktura | ✅ (R-44, R-49, R-45 otvoreni) | pgTAP 01–08, integracija, e2e |
| D2 djeca i skrbnici | ✅ (R-54 otvoren) | pgTAP 09–18 |
| D3 dolasci i izostanci (D3-A…I, D-38) | ✅ | pgTAP 19–23 |
| D4 komunikacija (D4-A…G) | ✅ | pgTAP 24–28 |
| D-40 push (lažni adapter) | ✅ implementirano, **namjerno neaktivno** | pgTAP 29, `push.test.ts`, ADR-0007 |
| D5 demo poliranje | ✅ zatvoren | `demo:verify` lokalno i u CI #56; d5-plan §4 |

## 3. Funkcionalna matrica

Oznake: ✅ implementirano i testirano · 🟡 djelomično · ❌ nije implementirano · ⚖️ treba poslovnu/pravnu odluku.
„Testovi” znači testove koji provjeravaju i negativne slučajeve (odbijanja), ne samo sretni put.

### 3.1 Uprava (administracija, web)
| Funkcija | Stanje | Testovi | Praznina / napomena |
|---|---|---|---|
| Prijava kodom iz e-pošte, obvezni MFA (TOTP), lozinke zabranjene | ✅ | pgTAP 03, `auth-password` (7), e2e | R-49: ponovna procjena na hosted okruženju nije moguća (nema staginga) |
| Vrtić, objekti, pedagoške godine, skupine | ✅ | pgTAP 01–02, e2e | — |
| Djelatnici: pozivnice, suspenzija/reaktivacija, rasporedi (i zamjene) | ✅ | pgTAP 02, 04, 07, `invitations`, `membership-suspension` | limit pozivnica (R-50 riješen) |
| Djeca, upis, premještaj, ispis, poništavanje budućih zapisa | ✅ | pgTAP 09, 14, 15, e2e | D-35/D-36/D-37 provedeni u bazi |
| Skrbnici, veze s pravima, pozivnice skrbnika | ✅ | pgTAP 10, 16, `guardian-invitations` | — |
| Ograničenja pristupa (oznaka „Ograničeno”) | ✅ | pgTAP 11, 12 | — |
| Ovlaštene osobe za preuzimanje | ✅ | pgTAP 13 | — |
| Završetak veze/ograničenja/ovlaštenja | 🟡 | pgTAP 10–13 | **R-54:** pravilo „bez kraja u prošlosti” provodi samo admin aplikacija (`endRecord`), baza ga prihvaća izravnim API pozivom |
| Dolasci po skupini i danu, ispravci s razlogom, propušteni unos | ✅ | pgTAP 19, e2e D3-G | — |
| Izostanci: pregled, u ime skrbnika, otkazivanje | ✅ | pgTAP 20, e2e | — |
| Obavijesti vrtića (nacrt, objava, izmjena s poviješću, arhiva) | ✅ | pgTAP 25, e2e D4-C | odgojitelji ne objavljuju (matrica „***” otvorena) |
| Dnevni pregledi skupina | ❌ (prikaz) | RLS dopušta čitanje (pgTAP 26) | **nema ekrana u administraciji** — uprava ne vidi dnevne preglede |
| Razgovori | — (namjerno) | pgTAP 27 (mutacija: uprava kao sudionik → 4 pada) | Q-T16: uprava nema pristup do odluke |
| **Pregled audita s filtrima (FR-09-4, Must)** | ❌ | audit se piše (pgTAP 06, svaka tablica) | **nema ekrana**; uprava ne može pregledati audit vlastitog vrtića |
| Izvještaji i izvozi (FS-14) | ❌ | — | Faza 12 |
| Prava ispitanika, retencija | ❌ | — | Faza 12, R-53, Q-P09 ⚖️ |

### 3.2 Odgojitelj (mobilna aplikacija)
| Funkcija | Stanje | Testovi | Praznina / napomena |
|---|---|---|---|
| Pristup samo skupinama s rasporedom danas | ✅ | pgTAP 02, 09, NEG-07/08 | — |
| Djeca skupine, skrbnici (imena i prava, D-31), oznaka „Ograničeno” (D-33) | ✅ | pgTAP 10, 12 | bez kontakata (D-34) |
| Dolazak/odlazak jednim dodirom, poništi 10 s, potvrda za javljen izostanak | ✅ | pgTAP 19, render 10 | **nije pokrenuto na uređaju** (R-55) |
| Osoba predaje/preuzimanja s popisa, ograničeni skrbnik s oznakom (D-38 b) | ✅ | pgTAP 23 (mutacija), render 5 | — |
| Rad bez mreže (šifrirani red, ID-ovi, brisanje pri odjavi) | ✅ (kod) | unit 7, render 6 | ponašanje SecureStorea i povratka mreže **na telefonu nije provjereno** |
| „Opravdani/neopravdani izostanci” | ❌ ⚖️ | — | **namjerno ne postoji**: prijava je bez razloga (FR-06-2, Q-P16 ⚖️); odgojitelj ne evidentira izostanak u ime skrbnika (N-10/H-04) |
| Dnevni pregled (nacrt, objava, izmjena istog dana) | ✅ | pgTAP 26, render 3 | ispravak ograničen na isti dan (D4-E) |
| Centar obavijesti (obavijesti vrtića, prijave izostanka) | ✅ | pgTAP 24–25, render 6 | push se ne šalje (R-56) |
| Razgovori sa skrbnicima, povlačenje poruke 5 min | ✅ | pgTAP 27, render 5 | radno vrijeme odgovaranja nije prikazano (Q-T05) |
| Nakon premještaja / kraja rasporeda / suspenzije | ✅ | pgTAP 19, 22, 27, 28 (NEG-08/09) | gubi pristup na sljedećem zahtjevu; offline unosi tada se odbijaju i prikazuju kao „nije poslano” |

### 3.3 Roditelj / skrbnik (mobilna aplikacija)
| Funkcija | Stanje | Testovi | Praznina / napomena |
|---|---|---|---|
| Prijava kodom, prihvaćanje pozivnice, povezivanje uz zapis skrbnika | ✅ | pgTAP 16, `guardian-invitations` | — |
| Prikaz povezanog djeteta (i bez skupine, D-32), ovlaštene osobe | ✅ | pgTAP 09–13, render | — |
| Status djeteta danas („U vrtiću od …”, bez imena djelatnika) | ✅ | pgTAP 21, render | — |
| Povijest dolazaka | ❌ ⚖️ | — | specifikacija traži samo današnji status (FR-05-9), prototip prikazuje „Tjedan dolazaka” — **neusklađenost spec/prototip** |
| Prijava i otkazivanje izostanka (bez razloga) | ✅ | pgTAP 20, render 7 | rokovi 30/30 dana su pretpostavka (Q-T14) |
| Obavijesti vrtića i dnevni pregledi (samo dani kad je dijete bilo u skupini) | ✅ | pgTAP 25–26, render 5–6 | — |
| Razgovori s odgojiteljima | ✅ | pgTAP 27, render 5 | **drugi skrbnik istog djeteta vidi cijeli razgovor** (sonda P5, po FR-11-1) — ⚖️ za razdvojene roditelje (Q-P11, D-10) |
| Postavke push obavijesti | ✅ (spremanje) | pgTAP 24, render | slanje neaktivno (R-56) |
| Nakon kraja veze / ograničenja / suspenzije | ✅ | pgTAP 10, 11, 22, 28 (NEG-05/06/09) | gubi pristup na sljedećem zahtjevu |

## 4. Sigurnosna procjena

### 4.1 Neovisna provjera kataloga baze (ne oslanja se na testove)
Upiti nad lokalnom bazom nakon `db:reset` (sintetički seed), 2026-11-16:

| Provjera | Rezultat |
|---|---|
| Tablice u izloženim shemama (`public`, `api`) | 25 tablica, **sve s RLS-om**; 0 bez RLS-a |
| Tablični DML za `authenticated` | nijedna tablica nema tablično INSERT/UPDATE/DELETE pravo osim `notification_preferences` (vlastiti redovi kroz RLS); pisanja idu kroz stupčana prava + politike ili kroz RPC |
| `push_tokens` | 0 politika, 0 prava klijentima — potpuno zatvoreno (SR-PUSH-02) |
| Pogledi | 3, svi `security_invoker`, `anon` nema čitanje |
| SECURITY DEFINER u `api`/`public` | **0** (SR-API-01) |
| `api` funkcije izvršive za `anon` | **0** |
| Definer funkcije bez fiksnog `search_path` | **0** |
| Funkcije samo za service role | 4: `record_audit_event`, `accept_invitations`, `push_claim`, `push_report` — očekivano |
| Ključevi u `audit.details` | samo ID-ovi, datumi, nazivi stupaca i kodovi (15 ključeva, nijedno ime ni tekst) |
| Storage bucketi | 0 (NEG-12 nije primjenjiv) |
| Tajni ključevi u klijentskim paketima (Expo export, `.next/static`) | **0 pronađenih** |

### 4.2 Sonde iz perspektive korisnika (izvan postojećih testova)
| Sonda | Rezultat | Ocjena |
|---|---|---|
| P1 skrbnik: koje profile može čitati | samo vlastiti (1) | ✅ |
| P2 skrbnik: može li razriješiti autora dnevnog pregleda, pošiljatelja poruke ili autora obavijesti u ime | vidi `author_id`/`sender_id` kao UUID, ali **ne može ih razriješiti u ime** (0 profila djelatnika) | ✅; manja napomena: UUID djelatnika je pseudonimni identifikator (može povezati poruke iste osobe) |
| P3 skrbnik: članstva, rasporedi, skupine, djeca | 1 vlastito članstvo, 0 rasporeda, samo skupina i djeca vlastitih veza | ✅ |
| P4 odgojitelj: profili, skrbnici, ID prijavitelja izostanka | 6 profila, 6 skrbnika vlastite skupine (D-31), ID prijavitelja vidljiv | ✅ po specifikaciji |
| P5 drugi skrbnik istog djeteta (`receives_messages`) | vidi razgovor i poruke prvog skrbnika | ⚖️ po FR-11-1; vidi §6 (Q-P11/D-10) |

### 4.3 Slojevi aplikacije
| Područje | Nalaz |
|---|---|
| Server Actions (admin) | 36 akcija nad podacima, **sve** prolaze kroz DAL (`getOrgContext`: potpisane tvrdnje, članstvo uprave, AAL2, 404 za tuđi vrtić); baza ponovno odlučuje |
| Edge Functions | `invite-member`, `accept-invitations` (JWT pozivatelja, service ključ samo za Auth admin); `push-dispatch` — pozivatelja autorizira baza (red dostave samo za service role); testirano odbijanje korisničkog tokena i bez tokena |
| Zaštita od tuđih ID-ova | RLS + RPC-ovi s istim odgovorom za nepostojeći i tuđi ID (PERMISSION_DENIED); NEG-01…NEG-15 u pgTAP-u (osim NEG-12 n/a) |
| Zaobilaženje poslovnih pravila izravnim pozivom | **R-54** (kraj veze/ograničenja/ovlaštenja u prošlosti) — jedino poznato; ostala pravila su u bazi (redoslijed dolazaka, rokovi poništavanja, publika, sudionici razgovora) |
| Mobilna pohrana | sesija samo u Keychain/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); red dolazaka samo ID-ovi; push token samo u SecureStoreu; nema AsyncStoragea ni `console` zapisa |
| **SR-MOB-03** (sakrivanje sadržaja u prikazu nedavnih aplikacija) | ❌ **nije implementirano** |
| Tokeni sesije | access token 15 min, rotacija refresh tokena, prijava samo pozivnicom (`config.toml`) — lokalno; **na hosted okruženju nije provjereno** |
| Push | sadržaj generički (test payloada kroz Edge Function), token minimiziran, stvarni adapter se ne može pokrenuti bez odobrenja i Q-T05 |
| Uprava i privatni razgovori | nema puta (RLS, RPC, prikaz); dokazano mutacijskim testom |

### 4.4 Kvaliteta testova
- pgTAP: 995 tvrdnji u 30 datoteka; ~271 provjera odbijanja (`throws_ok`) i ~154 provjere „ne vidi ništa” — oko 40 %
  negativnih slučajeva; svaki NEG scenarij iz plana ima test (NEG-12 nije primjenjiv; NEG-14 bez izričite oznake,
  ali pokriven).
- Mutacijske provjere (namjerno pokvareno pravilo → testovi padaju) rađene za svaki paket D3–D-40.
- Integracija kroz stvarni API, Auth, Mailpit i Edge Functions: 118 testova, 82 očekivanja odbijanja/skrivanja.
- **Slabosti:** render testovi mobilne aplikacije koriste lažni klijent (bez RLS-a) — pravo pristupa dokazano je samo u
  bazi i API-ju; nema automatskog testa pristupačnosti (npr. axe) za administraciju; nema testova opterećenja; e2e
  pokriva samo administraciju (mobilni e2e ne postoji).

## 5. Rezultati pokrenutih provjera (lokalno, 2026-11-16)

Sve pokrenuto iz čistog stanja (`db:reset`), typecheck i unit testovi **bez Turbo predmemorije** (`--force`):

| Provjera | Rezultat |
|---|---|
| Lint (ESLint) | ✅ |
| Typecheck (10 paketa) | ✅ |
| Unit (Vitest) | ✅ 193: domena 29, i18n 8, mobilni 49, test-fixtures 10, tokeni 60 (uključuje provjere kontrasta), validacija 37 |
| Mobilni render testovi (Jest, stvarni router) | ✅ 75 |
| `design:sync` (DESIGN.md i tokeni prototipa) | ✅ bez razlike |
| Seed deterministički i commitan | ✅ |
| Deno check / lint (Edge Functions) | ✅ / ✅ |
| `db:reset` (migracije od nule + sintetički seed) | ✅ |
| pgTAP | ✅ 995 u 30 datoteka |
| RLS spike | ✅ 14/14 |
| Generirani DB tipovi jednaki commitanima | ✅ |
| API integracija | ✅ 118 u 20 datoteka |
| Admin build (Next.js, produkcijski) | ✅ |
| Admin e2e (Playwright) | ✅ 11 |
| Expo export iOS + Android | ✅ |
| Bez tajnih ključeva u klijentskim paketima | ✅ |
| `demo:verify` (reset → scenarij → izmjene → reset → isti scenarij) | ✅ |
| CI run #56 (`f610167`) | ✅ sva 4 posla (lint/typecheck/unit; baza/integracija/e2e/demo; build/bundle; tajne/ovisnosti) |

**Nije provjereno (i zašto):** rad na simulatoru ili uređaju (nema simulatora u okruženju; vlasnik je odgodio ručno
testiranje); hosted Supabase (zabranjeno ovim zadatkom, staging ne postoji); stvarna dostava e-pošte i push obavijesti
(nije aktivirano).

**Nestabilni (flaky) testovi u povijesti CI-ja:** #33 i #40 (izgubljena e-pošta s kodom pri prvoj prijavi; ublaženo
ponovnim slanjem i dijagnostikom), #45 (zauzet port na GitHub runneru — infrastruktura), #55 (utrka nakon reseta u
novom D5 koraku — popravljeno u `f610167`). Od tada nema ponovljenih padova.

**Usputni nalaz tijekom procjene:** `pnpm db:types` piše izlaz naredbe u `packages/db-types/src/database.ts` i kad baza
nije pokrenuta — datoteka se prepiše porukom o grešci (dogodilo se u prvom pokušaju ove procjene; vraćeno
`git checkout`, ništa nije commitano). Rizik za razvojni tijek, ne za proizvod (zadatak P2 u §10).

## 6. Otvoreni rizici i odluke

| ID | Trenutačno stanje | Riješeno | Nedostaje | Blokira kontrolirano testiranje? | Blokira pilot? | Potrebna odluka / aktivnost |
|---|---|---|---|---|---|---|
| **R-44** | otvoren | sve mobilno ima typecheck, Expo export i render testove | pokretanje na simulatoru/uređaju | **da** (to je upravo ta razina) | da | vlasnik: pokrenuti skriptu prezentacije na telefonu uz lokalni stack (Expo Go) |
| **R-45 / D-27** | **`main` je sada zaštićen** (`protected: true`, GitHub API 2026-11-16) — dokumentacija još kaže suprotno | ruleset pripremljen, vjerojatno primijenjen | potvrditi da pravila odgovaraju `.github/rulesets/main-protection.json` (sva 4 CI posla obvezna, samo PR, bez force pusha) | ne | ne (ali nužno prije bilo kakvog spajanja) | vlasnik: potvrditi postavke; zatim zatvoriti R-45/D-27 u dokumentaciji |
| **R-49** | otvoren | lozinke zabranjene okidačem i Auth hookom, testirano (CI) | ponovna procjena na hosted okruženju (hook mora biti uključen i tamo) | ne | da | odluka o stagingu (D-3), zatim provjera |
| **R-53** | otvoren | demo samo sintetički | retencijska pravila i posao čišćenja (Faza 12) | ne | **da** | ⚖️ voditelj obrade: rokovi (Q-P09); zatim implementacija |
| **R-54** | otvoren | samo uprava s MFA-om, audit, admin ne nudi prošli kraj | baza prihvaća kraj u prošlosti izravnim API pozivom | ne | preporuka: da (integritet povijesti pristupa) | vlasnik: proširiti D-36 na veze, ograničenja i ovlaštenja? (ako da: okidač + pgTAP) |
| **R-55** | otvoren | render testovi za sve D2–D4 ekrane | uređaj: SecureStore, povratak mreže, AppState, izgled | **da** | da | isto kao R-44 |
| **R-56** | otvoren | cijeli lanac dostave testiran s lažnim adapterom | aktivacija (račun, vjerodajnice) + Q-T05 | ne (centar obavijesti radi) | ovisno o očekivanju vrtića — vjerojatno da | vlasnik: aktivacija prema subprocessor-register §2 |
| **R-57** | otvoren | minimizacija tokena, generički sadržaj | DPA s Expo-om, pravna osnova prijenosa, DPIA dopuna | ne | **da** (ako se push koristi) | ⚖️ pravni pregled |
| **Q-T05** | otvoreno | mjesto za pravilo dostave postoji; razgovori bez prikaza sati | tiho razdoblje, radno vrijeme odgovaranja | ne | da (za push i očekivanja roditelja) | vrtić / vlasnik |
| **Q-T14** | otvoreno (pretpostavka 30/30 dana, rok istog dana = postavka vrtića, zadano bez roka) | implementirano kao dokumentirana pretpostavka | stvarni rok i utjecaj na prehranu/naplatu | ne | ne (pretpostavka je sigurna) | vrtić |
| **Q-T15** | otvoreno | nema potvrda pročitanosti (`read_at` je samo vlastito stanje primatelja) | odluka | ne | ne | vrtić |
| **Q-T16** | otvoreno | uprava nema pristup razgovorima (dokazano) | odluka | ne | ne (sigurna zadana vrijednost) | ⚖️ vrtić + pravnik |
| **D-10** | otvoreno (validacija) | implementiran model „razgovor o djetetu s timom skupine” (FR-11-1) | potvrda s vrtićima; **novo:** drugi skrbnik vidi poruke prvoga (sonda P5) | ne | **da** — odluka utječe na privatnost razdvojenih roditelja (Q-P11) | vlasnik / vrtić / ⚖️ |

Ostale bitne otvorene stavke koje utječu na pilot: **D-3** (hosting/staging/produkcija), **ADR-0010** (pružatelj
e-pošte, Proposed), praćenje grešaka (ADR-0007 dio, Proposed), **Q-P01** (uloge voditelj/izvršitelj), **Q-P07**
(prijenosi), **Q-P09** (retencija), **Q-P11** (sudska ograničenja skrbi), **Q-S10/Q-S12** (trajanje sesije,
zaključavanje aplikacije), matrica „***” (objave odgojitelja), tok V (validacija s kupcima — nije započet).

## 7. Nedostaci u dokumentaciji (stvarno stanje ≠ dokument)

| Dokument | Nesklad |
|---|---|
| `docs/roadmap.md` | redak „Stanje 2026-11-12 … D2 u tijeku” — zastario (D2–D5 dovršeni) |
| `docs/phase-status.md` | „Zadnja provjera” navodi D4-G i stare brojeve; „CI” navodi runove #30–#41; D-27/R-45 opisani kao nezaštićeni `main` |
| `docs/risks.md` R-45 | kaže `protected: false`; API sada vraća `true` |
| `docs/architecture/database-schema.md` §2 | `announcement_revision` i `push_tokens` označeni „deferred”, a oba su implementirana (D4-B, D-40) |
| `docs/backlog.md` | D2 neoznačen kao dovršen; D3, D4, D5 i D-40 nisu upisani |
| `docs/product/traceability.md` | nema nijednog upisa za D3/D4 implementaciju (sljedivost FR → test zaustavljena nakon Faze 1) |
| `docs/architecture/local-development.md` | ne spominje `pnpm demo:reset` i `pnpm demo:verify` |
| `docs/privacy/dpia-screening.md` | ne uključuje push tok (naveden u kontrolnom popisu D-40, ali nije izveden) |
| Prototip vs. specifikacija | prototip prikazuje roditelju „Tjedan dolazaka”, specifikacija i kod samo današnji status |
| `apps/mobile/app.json` | `userInterfaceStyle: "light"` — mobilna aplikacija ne slijedi tamni način sustava iako tokeni imaju tamnu temu; nije dokumentirano kao odluka |

## 8. Preduvjeti za kontrolirano testiranje (sintetički podaci)

### A. Lokalna tehnička provjera — moguće odmah, bez promjena infrastrukture
- ✅ Sve u §5 prolazi lokalno i u CI-ju; `pnpm demo:verify` dokazuje ponovljivost.
- Moguće dodatno bez novih odluka: automatski test pristupačnosti administracije; usklađivanje dokumentacije (§7).

### B. Kontrolirano testiranje na stvarnim uređajima — bez stvarnih korisnika i podataka
Potrebno:
1. **Računalo s Dockerom** na kojem radi `pnpm demo` (vlasnikovo; ovo okruženje ne može poslužiti telefon izvan
   svoje mreže) i telefon u istoj Wi-Fi mreži s **Expo Go** — bez računa, bez vjerodajnica, bez troška.
   *Alternativa:* testno hosted okruženje — **blokirano** odlukom D-3 i zabranom promjena hosted Supabasea.
2. Prolazak skripte `docs/product/demo-script.md` na iPhoneu i Android uređaju, s bilješkama (zatvara R-44/R-55).
3. Provjera na uređaju: Keychain/Keystore sesija nakon ponovnog pokretanja, red bez mreže i povratak mreže,
   prikaz u prikazu nedavnih aplikacija (SR-MOB-03 nije implementiran), pristupačnost (VoiceOver/TalkBack).
4. Za TestFlight/interne Android buildove (izvan Expo Go) potrebni su EAS i razvojni računi Applea/Googlea —
   **vlasnikova odluka, mogući trošak**; nije nužno za prvu provjeru.

Blokirano: ništa tehnički; potrebna je **radnja vlasnika** (točka 1–2).

### C. Pilot s prvim vrtićem
Vidi §9 — blokirano pravnim provjerama, odlukom o infrastrukturi i nedostajućim „Must” funkcijama.

## 9. Preduvjeti za pilot s prvim vrtićem

| Područje | Preduvjet | Stanje |
|---|---|---|
| Kupac | pisani pristanak barem jednog vrtića; MVP potvrđen s ≥3 vrtića (tok V) | ❌ tok V nije započet |
| Pravo ⚖️ | uloge (Q-P01), DPA s vrtićem, DPIA odobrena od voditelja obrade, pravna osnova i prijenosi (Q-P07), obavijesti o privatnosti (stvarne, ne demo) | ❌ nacrti/ne postoje |
| Infrastruktura | D-3 (hosting u EU), odvojen staging i produkcija, backup i test povrata (ADR-0013), pružatelj e-pošte (ADR-0010), praćenje grešaka | ❌ nije odlučeno; **blokirano pristupom hosted okruženju** |
| Sigurnost | ponovna procjena R-49 na hostedu, R-54 odluka, SR-MOB-03, sesije Q-S10/Q-S12, vanjski penetracijski test (Faza 13, plaćeno) | 🟡 lokalno dobro, hosted nije provjeren |
| Funkcije „Must” prije produkcije | pregled audita za upravu (FR-09-4), prava ispitanika i retencija (Faza 12, R-53), izvoz/izvještaji po potrebi vrtića | ❌ |
| Odluke vrtića | Q-T05, Q-T14, Q-T15, Q-T16, D-10/Q-P11 (razgovor dijele svi skrbnici), objave odgojitelja | ❌ otvoreno |
| Push | aktivacija prema kontrolnom popisu, R-57 | ❌ namjerno neaktivno |
| Uređaji | R-44/R-55 zatvoreni (razina B) | ❌ |
| Obuka i podrška | priručnik za upravu i odgojitelje, kanal podrške, plan povlačenja (Faza 14) | ❌ |

## 10. Prioritizirani popis sljedećih zadataka

| # | Prioritet | Problem | Zašto je važno | Što napraviti | Kriterij prihvaćanja | Ovisnosti | Treba odluku / odobrenje vlasnika |
|---|---|---|---|---|---|---|---|
| 1 | **P0** | Mobilna aplikacija nikad nije pokrenuta na uređaju (R-44, R-55) | jedini preostali blok za razinu B; demo vrtiću bez toga je rizičan | pokrenuti `pnpm demo` na računalu s Dockerom, Expo Go na iPhoneu i Androidu, proći skriptu prezentacije, zapisati nalaze | sve tri uloge prođu skriptu na oba uređaja; nalazi zapisani; R-44/R-55 zatvoreni ili pretvoreni u konkretne zadatke | računalo s Dockerom, dva telefona | **da — radnja vlasnika** (ručno testiranje je dosad odgođeno) |
| 2 | **P0** | Dokumentacija nije usklađena sa stanjem (§7), uključujući zaštitu `main` | odluke se donose na netočnim podacima; R-45 možda zatvoren | uskladiti roadmap, phase-status, risks, schema, backlog, local-development, traceability | svaka stavka §7 riješena; R-45/D-27 ažuriran nakon potvrde vlasnika | potvrda postavki zaštite `main` | da, samo potvrda postavki zaštite |
| 3 | **P1** | Nema pregleda audita za upravu (FR-09-4, Must) | uprava ne može dokazati tko je što mijenjao; preduvjet pilota | stranica „Revizijski zapis” u administraciji (filtri razdoblje/akter/radnja), samo čitanje, bez sadržaja | e2e: uprava vidi samo audit svog vrtića; drugi vrtić 404; nema imena u prikazu osim aktera | — | odobrenje razvojnog paketa |
| 4 | **P1** | R-54: kraj veze/ograničenja/ovlaštenja u prošlosti moguć izravnim API pozivom | naknadna promjena tko je imao pristup djetetu | ako vlasnik proširi D-36: okidač kao `guard_child_lifecycle` + pgTAP | pgTAP: kraj u prošlosti odbijen za sve tri tablice; admin nepromijenjen | odluka | **da — poslovna odluka** |
| 5 | **P1** | Razgovor o djetetu dijele svi skrbnici s pravom poruka (sonda P5) | razdvojeni roditelji vide međusobne poruke | odlučiti model (zajednički razgovor / razgovor po skrbniku); dokumentirati u D-10/Q-P11 | odluka zapisana; ako se mijenja model — plan paketa | vrtić, pravnik | **da — produktna i pravna odluka** |
| 6 | **P1** | SR-MOB-03 nije implementiran (sadržaj u prikazu nedavnih aplikacija, sigurnosne kopije) | podaci o djeci vidljivi na zaključanom/dijeljenom uređaju | zaštita prikaza u prikazu aplikacija (iOS/Android), isključiti osjetljive podatke iz sigurnosnih kopija | provjera na uređaju (razina B) + render/unit gdje moguće | zadatak 1 | odobrenje razvojnog paketa |
| 7 | **P1** | Infrastruktura i hosting nisu odlučeni (D-3, ADR-0010, praćenje grešaka, ADR-0013) | bez toga nema staginga, pilota ni provjere R-49 na hostedu | odluka vlasnika; zatim plan staginga (odvojen od produkcije) | odluke zapisane; staging plan odobren | ⚖️ podizvršitelji | **da — infrastruktura, troškovi, podizvršitelji** |
| 8 | **P1** | Pravni okvir (Q-P01, DPA, DPIA, Q-P07, obavijesti o privatnosti, R-57) | bez toga nema stvarnih podataka | angažirati pravnika/DPO-a; dovršiti dokumente iz `docs/privacy/README.md` | DPIA i DPA prihvaćeni od voditelja obrade | kupac (tok V) | **da — pravne odluke** |
| 9 | **P1** | Retencija i prava ispitanika (R-53, Faza 12) | zakonska obveza prije produkcije | nakon Q-P09: politika, poslovi čišćenja, izvoz/brisanje | zahtjev ispitanika proveden end-to-end u testu; retencija dokazana testom | Q-P09 | **da — rokovi (⚖️)** |
| 10 | **P1** | Tok V (validacija s kupcima) nije započet | najveći rizik je tržišni (R-14); MVP nije potvrđen | 3–5 razgovora, demo prema skripti, pismo namjere | zapisnici razgovora; MVP opseg potvrđen | zadatak 1 | **da — vlasnikova aktivnost** |
| 11 | **P2** | Uprava nema prikaz dnevnih pregleda | nadzor kvalitete sadržaja koji ide roditeljima | stranica samo za čitanje po skupini i danu | e2e; RLS već postoji | — | odobrenje paketa |
| 12 | **P2** | Roditelj nema povijest dolazaka; prototip i specifikacija se razlikuju | očekivanje roditelja iz prezentacije | odlučiti (samo danas / tjedan); uskladiti dokument ili kod | odluka zapisana | — | **da — produktna odluka** |
| 13 | **P2** | Nema automatskog testa pristupačnosti administracije | WCAG 2.2 AA je cilj dizajna | axe u e2e za glavne stranice | 0 kritičnih nalaza na stranicama iz skripte | — | ne (tehnički zadatak) |
| 14 | **P2** | `pnpm db:types` prepisuje generiranu datoteku porukom o grešci kad baza ne radi | lako se commita pokvarena datoteka (CI bi pao) | pisati u privremenu datoteku i zamijeniti samo pri uspjehu | bez baze naredba završi greškom, datoteka nepromijenjena | — | ne |
| 15 | **P2** | UUID djelatnika vidljiv skrbniku (`author_id`, `sender_id`) | pseudonimno povezivanje poruka iste osobe; nisko | ukloniti stupce iz čitanja skrbnika (prikaz kroz RPC već postoji) ili prihvatiti | odluka; ako se mijenja — pgTAP | — | ne (tehnička procjena), osim ako se procijeni kao privatnosno pitanje |
| 16 | **P2** | Mobilna aplikacija zaključana na svijetli način (`userInterfaceStyle: light`) | tokeni imaju tamnu temu; neusklađenost | odlučiti i dokumentirati | odluka u DESIGN.md | — | da — dizajnerska odluka (manja) |

## Ocjena

- **Spremno za kontrolirano testiranje?** Za **razinu A (lokalna tehnička provjera): da** — sve provjere prolaze
  lokalno i u CI-ju, demo je ponovljiv. Za **razinu B (stvarni uređaji, sintetički podaci): još ne** — blokira ga
  isključivo to što mobilna aplikacija nikad nije pokrenuta na uređaju (R-44, R-55); tehničkih blokera u kodu nema,
  potrebna je radnja vlasnika (računalo s Dockerom + Expo Go).
- **Spremno za pilot s prvim vrtićem? Ne.** Blokiraju ga: nepostojeći pravni okvir (DPA, DPIA, uloge, prijenosi,
  retencija), neodlučena infrastruktura (D-3; hosted okruženje ne postoji), nedostajuće „Must” funkcije prije
  produkcije (pregled audita, prava ispitanika, retencija), otvorene odluke vrtića (Q-T05, Q-T16, D-10/Q-P11) i
  nezapočeta validacija s kupcima.
- **Najrazumniji sljedeći korak:** (1) vlasnik pokreće demo prema skripti na iPhoneu i Androidu uz lokalni stack i
  zapisuje nalaze (zatvara R-44/R-55); (2) paralelno usklađivanje dokumentacije (§7) i potvrda zaštite `main`;
  (3) zatim, uz odobrenje, mali paket „spremnost za pilot”: pregled audita (FR-09-4), SR-MOB-03 i — nakon odluke —
  R-54; (4) istovremeno započeti tok V i pravni pregled, jer o njima ovisi sve iza demonstracije.
