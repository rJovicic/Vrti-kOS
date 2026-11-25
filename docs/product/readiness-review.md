# VrtićOS — procjena spremnosti (ažurirano nakon D-41a i D-42)

**Datum:** 2026-11-16 · **Grana:** `claude/vrtricos-master-init-zv9c14` · **Pregledani commit:** `470d030`
(jednak `origin`, bez necommitanih promjena na početku).
**CI:** run #56 na `f610167` (zaključak D5) — sva 4 posla uspješna; zadnji run #60 na `470d030` — sva 4 posla uspješna
(provjereno kroz GitHub API).

> **Dopuna 2026-11-19:** nakon ove procjene izvedeni su D-41b (povijesni ispravak) i Q-T22 (poništenje pogrešnog
> unosa istog dana, s korekcijom provjere izostanaka). **R-54 i R-58 su zatvoreni.**
> Nepromjenjivost evidencije ispravaka vrijedi prema aplikaciji, ne prema privilegiranom operateru baze (model prijetnji
> §3.1). Ostale ocjene ovog dokumenta nisu se promijenile.

> Ovo je druga verzija procjene. Prva (commit `e458d83`, stanje `f610167`) ostaje u povijesti gita. Od tada su odobreni
> i izvedeni D-41a (zaštita povijesti odnosa djeteta) i D-42 (razgovor po djetetu i skrbniku); D-41b je samo plan.
> Ova procjena **ne mijenja kod ni odluke** — nalazi su samo dokumentirani. Nema mergea, deploya, promjena hosted
> Supabasea, GitHub postavki ni aktivacije Expo Pusha.

---

## 1. Sažetak stvarnog stanja

VrtićOS je **funkcionalan lokalni demo** (ADR-0009) s tri uloge kroz bazu, administraciju i mobilnu aplikaciju:
identitet i struktura (D1), djeca i skrbnici (D2), dolasci i izostanci (D3), komunikacija (D4), dostava push obavijesti
bez aktivacije (D-40), demo poliranje (D5) te, nakon procjene, zaštita povijesti (D-41a) i razgovor po skrbniku (D-42).
Sigurnosni model (RLS na svim tablicama, MFA uprave, funkcije u `private` shemi, audit bez sadržaja) potvrđen je
neovisnim upitima nad katalogom baze i sondama u ulozi korisnika (§4).

Dva nalaza prve procjene su riješena: **R-54** (izmjena prošlosti izravnim API pozivom — sada odbija baza) i
**sonda P5** (drugi skrbnik vidio poruke prvoga — sada 0 razgovora, 0 poruka).

Nije dokazano: rad mobilne aplikacije na stvarnom uređaju (R-44, R-55), rad izvan lokalnog stacka (nema staginga ni
produkcije), pravni okvir (DPA, DPIA, pravna osnova, retencija) i tržišna validacija (tok V nije započet).

**Ukratko:** spremno za **lokalnu tehničku provjeru**. **Kontrolirano testiranje na uređajima** čeka jednu radnju
vlasnika (pokretanje na telefonu uz lokalni stack). **Nije spremno za pilot.**

## 2. Potvrđene dovršene faze

| Faza / sloj | Stanje | Dokaz |
|---|---|---|
| Faze 0–4 (discovery, specifikacija, arhitektura, dizajn) | nacrti dovršeni; **MVP nije potvrđen** (D-19), tok V nije započet | phase-status, roadmap |
| D0, D1, D2, D3, D4 | ✅ | pgTAP 00–28, integracija, e2e |
| D-40 push (lažni adapter) | ✅ implementirano, **namjerno neaktivno** | pgTAP 29, `push.test.ts` |
| D5 demo poliranje | ✅ zatvoren | `demo:verify` lokalno i u CI-ju (#56, #60) |
| **D-41a** zaštita povijesti odnosa | ✅ (2026-11-16) | pgTAP 30 (49; bez okidača pada 18), `relationship-history.test.ts` |
| **D-42** razgovor po djetetu i skrbniku | ✅ (2026-11-16) | pgTAP 31 (54; staro pravilo obara 10), `conversations.test.ts` |
| D-41b povijesni ispravak | 📄 samo plan | [architecture/d41b-plan.md](../architecture/d41b-plan.md) |

## 3. Funkcionalna matrica

✅ implementirano i testirano (uključujući negativne slučajeve) · 🟡 djelomično · ❌ nije implementirano ·
⚖️ treba poslovnu/pravnu odluku. „Na uređaju” ni za jednu mobilnu stavku nije provjereno (R-44, R-55).

### 3.1 Uprava (administracija, web)
| Funkcija | Stanje | Testovi | Praznina / napomena |
|---|---|---|---|
| Prijava kodom iz e-pošte, obvezni MFA (TOTP), lozinke zabranjene | ✅ | pgTAP 03, integracija, e2e | R-49: ponovna procjena na hosted okruženju nemoguća (nema staginga) |
| Vrtić, objekti, pedagoške godine, skupine | ✅ | pgTAP 01–02, e2e | — |
| Djelatnici: pozivnice, suspenzija, rasporedi i zamjene | ✅ | pgTAP 02, 04, 07 | — |
| Djeca, upis, premještaj, ispis, poništenje budućih zapisa | ✅ | pgTAP 09, 14, 15, 30, e2e | **novo (D-41a):** početak samo od danas — povijesni podaci pri prvom unosu vrtića (npr. upis od rujna) ne mogu se unijeti dok ne postoji D-41b |
| Skrbnici, veze s pravima, pozivnice skrbnika | ✅ | pgTAP 10, 16, 30 | — |
| Ograničenja pristupa | ✅ | pgTAP 11, 12, 30 | ograničenje koje počinje danas ne može se ukloniti istog dana (samo D-41b) |
| Ovlaštene osobe | ✅ | pgTAP 13, 30 | ime se ne mijenja nakon što je ovlaštenje vrijedilo (D-41a) |
| Promjene prošlih datuma i imena | ✅ redovni put zatvoren | pgTAP 30, integracija kroz PostgREST | **povijesni ispravak ❌** — D-41b samo plan |
| Dolasci po skupini i danu, ispravci s razlogom | ✅ | pgTAP 19, e2e | — |
| Izostanci: pregled, u ime skrbnika, otkazivanje | ✅ | pgTAP 20, e2e | — |
| Obavijesti vrtića (nacrt, objava, izmjena s poviješću, arhiva) | ✅ | pgTAP 25, e2e | objave odgojitelja ⚖️ (matrica „***”) |
| Dnevni pregledi skupina | ❌ (prikaz) | RLS dopušta čitanje (pgTAP 26) | uprava nema ekran za dnevne preglede |
| Razgovori | — (namjerno) | pgTAP 27, 31 | **D-42:** uprava nema pristup (potvrđeno odlukom) |
| **Pregled audita s filtrima (FR-09-4, Must)** | ❌ | audit se piše za svaku tablicu | uprava ne može pregledati audit vlastitog vrtića |
| Izvještaji i izvozi (FS-14) | ❌ | — | Faza 12 |
| Prava ispitanika, retencija | ❌ | — | Faza 12, R-53, Q-P09 ⚖️ |

### 3.2 Odgojitelj (mobilna aplikacija)
| Funkcija | Stanje | Testovi | Praznina / napomena |
|---|---|---|---|
| Pristup samo skupinama s rasporedom danas | ✅ | pgTAP 02, 09, 22 | — |
| Djeca skupine, skrbnici (imena i prava), oznaka „Ograničeno” | ✅ | pgTAP 10, 12 | bez kontakata (D-34) |
| Dolazak/odlazak, poništi 10 s, potvrda za javljen izostanak | ✅ | pgTAP 19, render | nije pokrenuto na uređaju |
| Osoba predaje/preuzimanja s popisa | ✅ | pgTAP 23 | — |
| Rad bez mreže (red s ID-ovima, brisanje pri odjavi) | ✅ (kod) | unit, render | SecureStore i povratak mreže na telefonu nisu provjereni |
| Opravdani / neopravdani izostanci | ❌ ⚖️ | — | namjerno ne postoji: prijava bez razloga (FR-06-2, Q-P16) |
| Dnevni pregled | ✅ | pgTAP 26, render | ispravak samo isti dan |
| Centar obavijesti | ✅ | pgTAP 24–25, render | push se ne šalje (R-56) |
| Razgovori: **zaseban razgovor po skrbniku** (D-42), povlačenje 5 min | ✅ | pgTAP 27, 31, integracija, render | radno vrijeme odgovaranja nije prikazano (Q-T05) |
| Nakon premještaja / kraja rasporeda / suspenzije | ✅ | pgTAP 19, 22, 27, 28, 31 | bivši odgojitelj gubi i povijest razgovora |

### 3.3 Roditelj / skrbnik (mobilna aplikacija)
| Funkcija | Stanje | Testovi | Praznina / napomena |
|---|---|---|---|
| Prijava kodom, prihvaćanje pozivnice | ✅ | pgTAP 16, integracija | — |
| Prikaz povezanog djeteta, ovlaštene osobe | ✅ | pgTAP 09–13, render | — |
| Status djeteta danas | ✅ | pgTAP 21, render | — |
| Povijest dolazaka | ❌ ⚖️ | — | specifikacija: samo danas (FR-05-9); prototip: „Tjedan dolazaka" — neusklađeno |
| Prijava i otkazivanje izostanka | ✅ | pgTAP 20, render | rokovi 30/30 su pretpostavka (Q-T14) |
| Obavijesti i dnevni pregledi | ✅ | pgTAP 25–26, render | — |
| Razgovori: **samo vlastiti** (D-42) | ✅ | pgTAP 31 (drugi skrbnik, drugo dijete, drugi vrtić), integracija | — |
| Postavke push obavijesti | ✅ (spremanje) | pgTAP 24 | slanje neaktivno |
| Nakon kraja veze / ograničenja / suspenzije | ✅ | pgTAP 10, 11, 22, 28, 31 | gubi pristup na sljedećem zahtjevu, uključujući vlastiti razgovor |

## 4. Sigurnosna procjena

### 4.1 Katalog baze (neovisno o testovima, `470d030`, nakon `demo:verify`)
| Provjera | Rezultat |
|---|---|
| Tablice u `public`/`api` | 25, **sve s RLS-om** |
| Tablični DML za klijente | samo `notification_preferences` (vlastiti redovi kroz RLS); ostalo stupčana prava + politike ili RPC |
| `push_tokens` | bez politika i prava klijentima |
| Pogledi | 3, svi `security_invoker`, `anon` nema čitanje |
| SECURITY DEFINER u `api`/`public` | 0 |
| `api` funkcije izvršive za `anon` | 0 |
| Definer funkcije bez fiksnog `search_path` | 0 |
| Funkcije samo za service role | 4 (`record_audit_event`, `accept_invitations`, `push_claim`, `push_report`) |
| `audit.details` u seed stanju | samo `changed_columns`; u prvoj procjeni (nakon testova) 15 ključeva — svi ID-ovi, datumi, nazivi stupaca i kodovi |
| Storage bucketi | 0 |
| Tajni ključevi u klijentskim paketima | 0 |

### 4.2 Sonde iz perspektive korisnika
| Sonda | Rezultat | Ocjena |
|---|---|---|
| P1 skrbnik: profili | samo vlastiti | ✅ |
| P2 skrbnik: autori/pošiljatelji | UUID vidljiv, ime nerazrješivo (osim vlastite poruke) | ✅; manja napomena (pseudonimni ID djelatnika) |
| P3 skrbnik: članstva, rasporedi, skupine, djeca | 1 / 0 / 1 / 2 | ✅ |
| P4 odgojitelj: profili, skrbnici | 6 / 6 (vlastita skupina, D-31) | ✅ |
| **P5 drugi skrbnik istog djeteta** | **0 razgovora, 0 poruka** (prije D-42: 1 / 2) | ✅ riješeno |

### 4.3 Slojevi aplikacije
| Područje | Nalaz |
|---|---|
| Server Actions | sve akcije nad podacima kroz DAL (`getOrgContext`: potpisane tvrdnje, članstvo uprave, AAL2, 404 za tuđi vrtić); završetak zapisa više ne prima početni datum iz obrasca (D-41a) |
| Edge Functions | `invite-member`, `accept-invitations` (JWT pozivatelja), `push-dispatch` (pozivatelja autorizira baza) — testirano odbijanje korisničkog tokena i poziva bez tokena |
| Tuđi ID-ovi | RLS + RPC s istim odgovorom za nepostojeći i tuđi ID (uključujući razgovore, D-42) |
| Zaobilaženje poslovnih pravila | **nijedno poznato.** R-54 zatvoren za redovni put (D-41a); pravila dolazaka, rokova, publike i sudionika razgovora su u bazi |
| Uprava i privatni razgovori | nema puta (RLS, RPC, kontakti); dokazano pgTAP 27, 31 i integracijom |
| Mobilna pohrana | sesija samo u Keychain/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); red dolazaka samo ID-ovi; bez AsyncStoragea i `console` zapisa |
| **SR-MOB-03** (skrivanje u prikazu nedavnih aplikacija, sigurnosne kopije) | ❌ nije implementirano |
| Offline red nakon gubitka pristupa | baza odbija, unos se prikazuje kao „nije poslano” (render); na uređaju nije provjereno |
| Push | generički sadržaj, token minimiziran; stvarni adapter se ne može pokrenuti bez odobrenja i Q-T05 |
| GitHub `main` | ruleset `main-protection` aktivan (samo PR, 4 obvezne provjere, bez force pusha i brisanja); lista iznimaka nije potvrđena autenticiranim čitanjem (R-45) |

### 4.4 Kvaliteta testova
- pgTAP: **1.099 provjera u 32 datoteke**; dvije nove datoteke (30, 31) gotovo su u cijelosti negativni scenariji.
- Kontrolne provjere s namjerno uklonjenim pravilom napravljene su za svaki paket D3–D-42 (D-41a: 18 padova,
  D-42: 10 padova).
- Integracija kroz stvarni API, Auth, Mailpit i Edge Functions: 122 testa.
- **Slabosti (nepromijenjene):** render testovi mobilne aplikacije koriste lažni klijent (prava se dokazuju samo u bazi
  i API-ju); nema automatskog testa pristupačnosti; nema testova opterećenja; nema mobilnog e2e; migracijska zaštita
  D-42 (prekid ako postoje razgovori) provjerena je samo ručno, jednom.

## 5. Rezultati pokrenutih provjera (lokalno, `470d030`, 2026-11-16)

Sve iz čistog stanja (`db:reset`); typecheck i unit testovi bez Turbo predmemorije (`--force`):

| Provjera | Rezultat |
|---|---|
| Lint | ✅ |
| Typecheck | ✅ |
| Unit (Vitest) | ✅ 193 (domena 29, i18n 8, mobilni 49, test-fixtures 10, tokeni 60, validacija 37) |
| Mobilni render testovi (Jest) | ✅ 75 |
| `design:sync`, seed deterministički | ✅ / ✅ |
| Deno check / lint (Edge Functions) | ✅ / ✅ |
| `db:reset` (sve migracije od nule + seed) | ✅ |
| pgTAP | ✅ 1.099 u 32 datoteke |
| RLS spike | ✅ |
| DB tipovi jednaki commitanima | ✅ |
| API integracija | ✅ 122 |
| Admin build | ✅ |
| Admin e2e (Playwright) | ✅ 11 |
| Expo export iOS + Android | ✅ |
| Bez tajnih ključeva u paketima | ✅ |
| `demo:verify` | ✅ |
| CI #56 (`f610167`), #59 (`3a1274f`), #60 (`470d030`) | ✅ sva 4 posla u svakom |

**Nije provjereno (i zašto):** simulator ili uređaj (nema ih u ovom okruženju; ručno testiranje nije traženo); hosted
Supabase (zabranjeno, staging ne postoji); stvarna dostava e-pošte i push obavijesti (nije aktivirano).

**Nestabilni testovi u povijesti CI-ja:** #33 i #40 (izgubljena e-pošta s kodom; ublaženo), #45 (zauzet port na runneru),
#55 (utrka nakon reseta; popravljeno). Od #56 nema padova.

**Lokalno okruženje:** Docker u ovoj sesiji dvaput se ugasio nakon ponovnog pokretanja radnog procesa sesije; nakon
čišćenja zaostalog procesa `containerd` sve provjere prošle. To je svojstvo okruženja sesije, ne projekta.

## 6. Otvoreni rizici i odluke

| ID | Trenutačno stanje | Riješeno | Nedostaje | Blokira kontrolirano testiranje? | Blokira pilot? | Potrebna odluka / aktivnost |
|---|---|---|---|---|---|---|
| **R-44** | otvoren | typecheck, Expo export, render testovi | pokretanje na uređaju | **da** | da | vlasnik: demo prema skripti na iPhoneu i Androidu (Expo Go, lokalni stack) |
| **R-45 / D-27** | **ublažen** | ruleset aktivan od 2026-11-12, jednak D-27 (provjereno javnim API-jem 2026-11-16) | potvrda prazne liste iznimaka | ne | ne (nužno prije spajanja) | vlasnik: potvrda u postavkama rulesetova |
| **R-49** | otvoren | lozinke zabranjene, testirano u CI-ju | provjera na hosted okruženju | ne | da | D-3, zatim provjera |
| **R-53** | otvoren | samo sintetički podaci | retencija i čišćenje | ne | **da** | ⚖️ Q-P09, zatim implementacija |
| **R-54** | **ublažen** | D-41a: baza odbija izmjenu prošlosti na 4 tablice | D-41b (auditirani povijesni ispravak) | ne | **da** — bez D-41b vrtić ne može unijeti povijesne početke pri uvođenju | odobrenje implementacije D-41b (plan gotov) |
| **R-55** | otvoren | render testovi | uređaj (SecureStore, mreža, izgled) | **da** | da | isto kao R-44 |
| **R-56** | otvoren | lanac dostave testiran s lažnim adapterom | aktivacija + Q-T05 | ne | vjerojatno da | vlasnik: aktivacija prema registru podizvršitelja |
| **R-57** | otvoren | minimizacija, generički sadržaj | DPA s Expo-om, prijenosi, DPIA | ne | **da** ako se koristi push | ⚖️ pravni pregled |
| **Q-T05** | otvoreno | mjesto za pravilo dostave postoji | tiho razdoblje, radno vrijeme | ne | da | vrtić / vlasnik |
| **Q-T14** | otvoreno (pretpostavka 30/30) | implementirano kao pretpostavka | stvarni rok | ne | ne | vrtić |
| **Q-T15** | otvoreno | nema potvrda pročitanosti | odluka | ne | ne | vrtić |
| **Q-T16** | **odgovoreno (D-42)** | uprava nema pristup; testirano | — | ne | ne | — (svaka promjena = nova odluka) |
| **D-10** | **riješeno (D-42)** | razgovor po djetetu i skrbniku; tim skupine (Q-T20) | — | ne | ne | — |
| Q-T19 | otvoreno | migracija se prekida ako postoje razgovori | pravilo ako se ikad pojavi stvarna povijest | ne | ne (danas nema podataka) | samo ako zatreba |

Ostalo što utječe na pilot: **D-3** (hosting/staging), **ADR-0010** (e-pošta), praćenje grešaka (ADR-0007),
**Q-P01**, **Q-P07**, **Q-P09**, **Q-P11**, **Q-S10/Q-S12**, matrica „***", tok V.

## 7. Nedostaci u dokumentaciji (provjereno ponovno na `470d030`)

| Dokument | Nesklad | Stanje |
|---|---|---|
| `docs/roadmap.md` | redak „Stanje 2026-11-12 … D2 u tijeku” | **nije ispravljeno** |
| `docs/phase-status.md` | „Zadnja provjera” (D4-G, 969 pgTAP) i „CI” (#30–#41) zastarjeli | **nije ispravljeno** (unosi D-41a/D-42 dodani) |
| `docs/architecture/database-schema.md` §2 | `announcement_revision` i `push_tokens` označeni „deferred” | **nije ispravljeno** (§5.17 ažuriran za D-42) |
| `docs/backlog.md` | D2 neoznačen; D3/D4/D5/D-40 bez unosa | **nije ispravljeno** (D-41a/D-42/D-41b dodani) |
| `docs/architecture/local-development.md`, README | bez `pnpm demo:reset` / `demo:verify` | **nije ispravljeno** |
| `docs/privacy/dpia-screening.md` | push tok nije uključen | **nije ispravljeno** |
| `docs/product/traceability.md` | D3/D4 bez sljedivosti | djelomično (dodan §3 za D-41/D-42) |
| R-45 / D-27 | prije netočno („nije zaštićeno”) | ✅ ispravljeno 2026-11-16 |
| Prototip vs. specifikacija | „Tjedan dolazaka” u prototipu, samo danas u kodu | **otvoreno** ⚖️ |
| `apps/mobile/app.json` | `userInterfaceStyle: "light"` — tamna tema postoji u tokenima | **nedokumentirana odluka** |

## 8. Preduvjeti za kontrolirano testiranje (samo sintetički podaci)

### A. Lokalna tehnička provjera — moguće odmah
✅ Sve u §5 prolazi lokalno i u CI-ju. Bez novih odluka moguće je još: test pristupačnosti administracije, usklađivanje
dokumentacije (§7), automatizirani test migracijske zaštite D-42.

### B. Stvarni uređaji, bez stvarnih korisnika i podataka
1. Računalo s Dockerom na kojem radi `pnpm demo` i telefon u istoj Wi-Fi mreži s **Expo Go** — bez računa i troška.
2. Prolazak [demo-script.md](demo-script.md) na iPhoneu i Androidu, uključujući novi popis razgovora po skrbniku (D-42)
   i provjeru da roditelj.alfa.2 ne vidi razgovor roditelja.alfa.1.
3. Na uređaju: sesija nakon ponovnog pokretanja, red bez mreže i povratak mreže, prikaz u nedavnim aplikacijama
   (SR-MOB-03 nije implementiran), VoiceOver/TalkBack.
4. TestFlight / interni Android buildovi traže EAS i račune Applea/Googlea — **odluka vlasnika, mogući trošak**; nije
   nužno za prvu provjeru.

**Blokirano tehnički: ništa. Potrebna je radnja vlasnika (1–2).** Testno hosted okruženje kao alternativa blokirano je
odlukom D-3 i zabranom promjena hosted Supabasea.

### C. Pilot — vidi §9.

## 9. Preduvjeti za pilot s prvim vrtićem

| Područje | Preduvjet | Stanje |
|---|---|---|
| Kupac | pisani pristanak vrtića; MVP potvrđen s ≥3 vrtića (tok V) | ❌ tok V nije započet |
| Pravo ⚖️ | Q-P01, DPA, odobrena DPIA, pravna osnova i prijenosi (Q-P07), stvarne obavijesti o privatnosti | ❌ |
| Infrastruktura | D-3 (EU hosting), staging odvojen od produkcije, backup i test povrata, e-pošta (ADR-0010), praćenje grešaka | ❌ **blokirano pristupom hosted okruženju i odlukama** |
| Sigurnost | R-49 na hostedu, SR-MOB-03, sesije Q-S10/Q-S12, vanjski penetracijski test | 🟡 lokalno dobro, hosted neprovjeren |
| Funkcije prije produkcije | pregled audita (FR-09-4), prava ispitanika i retencija (R-53), **D-41b** (uvođenje povijesnih podataka i ispravci) | ❌ |
| Odluke vrtića | Q-T05, Q-T14, Q-T15, objave odgojitelja, povijest dolazaka za roditelje | ❌ otvoreno |
| Push | aktivacija, R-57 | ❌ namjerno neaktivno |
| Uređaji | R-44 / R-55 zatvoreni | ❌ |
| Obuka i podrška | priručnici, kanal podrške, plan povlačenja | ❌ |

## 10. Prioritizirani popis sljedećih zadataka

| # | Prioritet | Problem | Zašto je važno | Što napraviti | Kriterij prihvaćanja | Ovisnosti | Odluka / odobrenje vlasnika |
|---|---|---|---|---|---|---|---|
| 1 | **P0** | Mobilna aplikacija nikad nije pokrenuta na uređaju (R-44, R-55) | jedini blok za razinu B; D-42 promijenio je mobilni popis razgovora | demo prema skripti na iPhoneu i Androidu uz lokalni stack, zapisati nalaze | sve tri uloge prođu skriptu na oba uređaja; R-44/R-55 zatvoreni ili pretvoreni u zadatke | računalo s Dockerom, 2 telefona | **da — radnja vlasnika** |
| 2 | **P0** | Dokumentacija nije usklađena (§7) | odluke se donose na netočnim podacima | uskladiti roadmap, phase-status, schema §2, backlog, local-development, DPIA (push) | svaka stavka §7 riješena ili označena kao odluka | — | ne (tehnički); da za potvrdu bypass liste (R-45) |
| 3 | **P1** | Nema povijesnog ispravka (D-41b) | bez njega vrtić ne može unijeti povijesne početke pri uvođenju ni ispraviti stvarnu pogrešku; R-54 ostaje otvoren | implementirati prema [d41b-plan.md](../architecture/d41b-plan.md) | testovi i kontrolne provjere iz plana §4; R-54 zatvoren | — | **da — odobrenje implementacije** |
| 4 | **P1** | Nema pregleda audita (FR-09-4, Must) | uprava ne može dokazati tko je što mijenjao | stranica „Revizijski zapis” samo za čitanje, filtri, bez sadržaja | e2e: vlastiti vrtić vidljiv, tuđi 404, bez imena osim aktera | — | odobrenje paketa |
| 5 | **P1** | SR-MOB-03 nije implementiran | podaci o djeci vidljivi na dijeljenom/zaključanom uređaju | zaštita prikaza u nedavnim aplikacijama, isključiti osjetljive podatke iz sigurnosnih kopija | provjera na uređaju + render/unit gdje moguće | zadatak 1 | odobrenje paketa |
| 6 | **P1** | Infrastruktura nije odlučena (D-3, ADR-0010, praćenje grešaka, ADR-0013) | bez toga nema staginga, pilota ni R-49 | odluka; plan staginga | odluke zapisane, plan odobren | ⚖️ podizvršitelji | **da — troškovi i podizvršitelji** |
| 7 | **P1** | Pravni okvir (Q-P01, DPA, DPIA, Q-P07, obavijesti, R-57) | bez toga nema stvarnih podataka | pravnik/DPO; dokumenti iz `docs/privacy/` | DPIA i DPA prihvaćeni | kupac | **da — pravne odluke** |
| 8 | **P1** | Retencija i prava ispitanika (R-53) | zakonska obveza | nakon Q-P09: politika i poslovi čišćenja, izvoz/brisanje | proveden zahtjev ispitanika i retencija u testu | Q-P09 | **da — rokovi ⚖️** |
| 9 | **P1** | Tok V nije započet | najveći rizik je tržišni; MVP nepotvrđen | 3–5 razgovora, demo, pismo namjere | zapisnici; potvrđen opseg MVP-a | zadatak 1 | **da — aktivnost vlasnika** |
| 10 | **P2** | Uprava nema prikaz dnevnih pregleda | nadzor sadržaja koji ide roditeljima | stranica samo za čitanje | e2e; RLS postoji | — | odobrenje paketa |
| 11 | **P2** | Povijest dolazaka za roditelje: prototip ≠ specifikacija | očekivanje iz prezentacije | odlučiti (samo danas / tjedan) | odluka zapisana | — | **da — produktna odluka** |
| 12 | **P2** | Nema automatskog testa pristupačnosti | WCAG 2.2 AA cilj | axe u e2e | 0 kritičnih nalaza | — | ne |
| 13 | **P2** | Migracijska zaštita D-42 testirana samo ručno | regresija bi mogla tiho razdvojiti/izgubiti povijest u budućem okruženju | skripta u CI-ju: baza s razgovorom → migracija mora pasti | CI korak zelen | — | ne |
| 14 | **P2** | `pnpm db:types` prepisuje datoteku porukom o grešci kad baza ne radi | lako se commita pokvarena datoteka | pisati u privremenu datoteku | bez baze: greška, datoteka nepromijenjena | — | ne |
| 15 | **P2** | UUID djelatnika vidljiv skrbniku | pseudonimno povezivanje poruka; nisko | procjena; po potrebi ukloniti stupce iz čitanja skrbnika | odluka; pgTAP ako se mijenja | — | ne (tehnički) |
| 16 | **P2** | Mobilna aplikacija zaključana na svijetli način | tokeni imaju tamnu temu | odlučiti i zapisati u DESIGN.md | odluka zapisana | — | da — manja dizajnerska odluka |

## Ocjena

- **Kontrolirano testiranje?** **Razina A (lokalno): da** — 17/17 lokalnih provjera i CI #60 zeleni, demo ponovljiv.
  **Razina B (uređaji, sintetički podaci): još ne** — blokira isključivo to što mobilna aplikacija nikad nije
  pokrenuta na uređaju (R-44, R-55); u kodu nema tehničkog blokera; potrebna je radnja vlasnika.
- **Pilot s prvim vrtićem? Ne.** Blokiraju ga: pravni okvir, neodlučena infrastruktura (hosted okruženje ne postoji),
  nedostajuće funkcije prije produkcije (pregled audita, retencija i prava ispitanika, D-41b za uvođenje povijesnih
  podataka), otvorene odluke vrtića (Q-T05 i dr.) i nezapočeta validacija s kupcima.
- **Najrazumniji sljedeći korak:** (1) vlasnik pokreće demo na iPhoneu i Androidu uz lokalni stack (zatvara R-44/R-55);
  (2) paralelno usklađivanje dokumentacije i potvrda bypass liste (R-45); (3) uz odobrenje, paket „spremnost za pilot”:
  D-41b, pregled audita (FR-09-4) i SR-MOB-03; (4) istovremeno započeti tok V i pravni pregled.

## Dodatak 2026-11-19 — staging okruženje

- **Postoji hostano okruženje za testiranje, ali nije produkcija ni odluka D-3:** Railway `vrticos-staging` (servis
  `admin`, Amsterdam) i Supabase `vrticos-staging` (Frankfurt), samo sintetički podaci
  ([architecture/staging.md](../architecture/staging.md)). Rečenica iz ocjene „hosted okruženje ne postoji” vrijedi i
  dalje za **produkciju**.
- Dokaz: smoke `tests/integration/src/staging/smoke.ts` — 25 PASS, 0 FAIL (health, Auth, RLS i izolacija s upisom,
  Realtime). Staging je pronašao dvije razlike hostanih zadanih postavki koje lokalni testovi ne mogu vidjeti (shema
  `api` nije izložena; javni Realtime kanali otvoreni) — ispravljeno, R-60 i R-61.
- **Razina B** je sada moguća bez lokalnog stacka (iPhone s Expo Go prema stagingu), ali još nije provedena na
  uređaju (R-44, R-55).
- Realtime nije značajka proizvoda; scenariji i prijedlog: [architecture/realtime.md](../architecture/realtime.md).

## Dodatak 2026-11-19 (2) — R-59 i D-43

Odvojeno prema vrsti dokaza:

- **Lokalno (stvarni lokalni Supabase stack s Realtimeom):** pgTAP 1.256 (35 datoteka, uklj. `34_realtime_broadcast`),
  139 integracijskih (uklj. 9 Realtime: isporuka uživo, drugi skrbnik, drugi vrtić, izgubljeno pravo uz otvorenu
  pretplatu, premještaj, izravni pokušaji preko Realtime API-ja, ponovno spajanje, duplikati), 12 scenarija
  istodobnosti, 12 admin e2e (stranica dolazaka osvježava se bez ponovnog učitavanja), 76 mobilnih render testova,
  Expo export, `demo:verify`.
- **CI:** isti koraci na čistom runneru po commitu (vidi fazni status).
- **Staging (hostani Supabase + Railway):** smoke 46/46 — Auth, RLS, usporedba hostanih postavki s
  `expected-config.json`, Realtime događaji uživo i `/api/live` na Railwayu; R-59: lažni tokeni i legacy ključevi
  vraćaju 401.
- **Nije dokazano:** rad na fizičkom iPhoneu (R-44, R-55), ponašanje pod opterećenjem.
- R-59 zatvoren; R-60 i R-61 ostaju ublaženi; R-58 ostaje zatvoren (bez regresije).

## Dodatak 2026-11-19 (3) — završetak D-43 i priprema fizičkog testa

- CI #72 zelen; lokalni niz i staging smoke (46/46) ponovno prolaze nakon proširenja pgTAP-a 34 i izmjene smokea.
- Ublažene tvrdnje bez automatskog dokaza: kraj SSE streama prije isteka tokena i ponovno spajanje preglednika;
  zatvaranje Realtime kanala (samo brisanje/zabrana računa, ne promjena članstva — tada kanal ostaje, ali događaji ne
  stižu, što je dokazano).
- Fizički test na iPhoneu pripremljen ([iphone-test-protocol.md](iphone-test-protocol.md)), **nije izveden**: R-44 i
  R-55 ostaju otvoreni. Opterećenje Realtimea nije testirano (procjena troška prije bilo kakvog testa opterećenja).

## Dodatak 2026-11-25 — konfiguracija kao kod i retencija

| Tvrdnja | Lokalno | CI | Hostani staging | Ručno | Nije dokazano |
|---|---|---|---|---|---|
| Hostana konfiguracija odgovara specifikaciji | — | unit testovi alata | ✅ `check` 42/42, smoke 81/0 | — | kontinuirano (nema zakazane provjere s tokenom) |
| Odstupanje obara provjeru, `apply` je ograničen na staging | unit (18) | ✅ #74 | ✅ izazvano odstupanje + `apply` | — | GitHub workflow (nije pokretljiv prije mergea) |
| Nijedno brisanje ne uništava evidenciju | pgTAP 35 | ✅ | — | — | — |
| Retencija `realtime.messages` ~3 dana | — | — | ⚠️ samo uz aktivni Realtime (bez prometa ≥ 6 dana; nakon buđenja obrisano u nekoliko sati) | — | točan raspored čišćenja |
| Rokovi čuvanja i anonimizacija | — | — | — | — | nisu odlučeni (Q-P09) |
