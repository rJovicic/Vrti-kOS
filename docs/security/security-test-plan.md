# Plan sigurnosnog testiranja — VrtićOS (MVP)

**Verzija:** 0.1 (nacrt) · **Datum:** 2026-11-10 · **Faza:** 2 (ograničeni opseg); izvedba od Faze 5
**Status (2026-11-11, D1):** dio testova implementiran i pokreće se u CI-ju — pgTAP 105 (izolacija vrtića, rasporedi, pozivnice, eskalacija, AAL1), integracijski 20 (Edge Functions, kod iz e-pošte, MFA), Playwright e2e 8 (admin). Ostatak plana i dalje je plan. Pretpostavlja predloženu arhitekturu
(SA-01…SA-08, [threat-model.md](threat-model.md)).
**Veze:** [security-requirements.md](security-requirements.md) · [../product/acceptance-criteria.md](../product/acceptance-criteria.md) ·
[../product/roles-and-permissions.md](../product/roles-and-permissions.md)

## 1. Pristup

| Razina | Alat (prijedlog, odluka u Fazi 3/5) | Što pokriva | Kada se izvodi |
|---|---|---|---|
| **L1 — statička provjera baze** | SQL upiti nad katalogom (`pg_class`, `pg_policy`, `pg_proc`, grantovi) u CI-u | RLS uključen, nema `true` politika, `SECURITY DEFINER` izvan izloženih shema, `EXECUTE` grantovi, `security_invoker` viewovi, javni bucketi | svaki PR |
| **L2 — testovi baze** | pgTAP na lokalnom Supabase stacku; simulacija korisnika postavljanjem JWT claimova i uloge `authenticated` | Matrica dozvola: tablica × uloga × operacija × odnos | svaki PR |
| **L3 — integracijski API testovi** | supabase-js s pravim prijavama sintetičkih korisnika protiv lokalnog stacka | PostgREST, RPC, Storage, Edge Functions, potpisani URL-ovi, opoziv | svaki PR (brzi skup), noćno (puni) |
| **L4 — e2e** | Detox/Maestro (mobilno), Playwright (admin) | Tokovi kroz sučelje, push payload, deep linkovi, lokalna pohrana | prije release kandidata |
| **L5 — ručni / vanjski** | pregled konfiguracije, penetracijski test (D-13, plaćeno — odobrenje), tabletop vježba incidenta | Konfiguracija dobavljača, procedure, kreativni napadi | prije pilota (Faza 13) |

**Pravila:** samo sintetički podaci; testovi se pokreću samo protiv lokalnog stacka ili zasebnog testnog projekta —
nikad protiv produkcije. Svaki Critical SR ima barem jedan automatizirani negativni test. Neuspjeli sigurnosni test blokira merge.

### Matrično generiranje testova (L2)
Matrica dozvola ([roles-and-permissions.md](../product/roles-and-permissions.md) §4, §7) zapisuje se kao strojno čitljiva
tablica (`resource`, `operation`, `role`, `relation`, `expected`). Generator stvara pgTAP slučajeve za svaku kombinaciju
s očekivanjem *dopušteno* ili *odbijeno*. Ćelije "Otvoreno" generiraju test *odbijeno*. Ručno pisani testovi niže pokrivaju
vremenske prijelaze i rubne slučajeve koje matrica ne izražava. (Backlog P5-10.)

## 2. Sintetički testni svijet
Isti kao u [acceptance-criteria.md](../product/acceptance-criteria.md): vrtići **Alfa** i **Beta**; objekt **A1**; skupine
**S1**, **S2** (PG-1); djeca **D1**, **D2** (S1), **D3** (S2), **D9** (Beta); skrbnici **G1** (D1, sve zastavice), **G2**
(D1, bez `can_report_absence`), **G3** (D2), **G9** (D9); odgojitelji **E1** (S1), **E2** (S2), **E3** (zamjena S1 samo dan T);
**U1** uprava Alfe, **U9** uprava Bete, **P1** platform admin; **O1** ovlaštena osoba D1; **M12** korisnik s članstvom u Alfi
(skrbnik D2) i Beti (skrbnik D9); **ANON** neprijavljen. Vrijeme se u testovima kontrolira (fiksni "danas" = T).

## 3. Testni scenariji

### 3.1 Statička provjera i opća RLS pravila
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-RLS-00 | Katalog: svaka tablica u izloženim shemama ima RLS; nema politika `true` za `anon`/`authenticated` na tenant tablicama; nema politika koje čitaju `user_metadata`; `SECURITY DEFINER` funkcije samo u `private` shemi s fiksnim `search_path`; `EXECUTE` oduzet od `PUBLIC`/`anon`; svi izloženi viewovi `security_invoker`; nijedan bucket nije javan | Upit vraća 0 prekršaja; inače CI pada | L1 | SR-TEN-01…03, 06, SR-AUTHZ-08, SR-API-01, 02, SR-STO-01 |
| ST-RLS-01 | Generirani matrični testovi (§1) za sve MVP resurse | Svaka kombinacija odgovara matrici | L2 | SR-AUTHZ-01 |

### 3.2 Izolacija vrtića Alfa ↔ Beta
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-TEN-01 | U1 izvodi `SELECT` na svakoj tenant tablici | Vraćaju se samo retci Alfe; nijedan redak Bete | L2 | SR-TEN-01 |
| ST-TEN-02 | ANON izvodi `SELECT/INSERT/UPDATE/DELETE` na svakoj tablici i Storage objektima | Sve odbijeno ili prazno | L2, L3 | SR-TEN-01 |
| ST-TEN-03 | U1 pokušava `INSERT` zapisa s `organization_id` = Beta (dijete, upis, obavijest, raspored) i `UPDATE` postojećeg zapisa na `organization_id` = Beta | Odbijeno (`WITH CHECK`); ništa nije zapisano | L2 | SR-TEN-05, SR-API-03 |
| ST-TEN-04 | U1 pokušava povezati zapise dvaju vrtića: upis D9 u S1, skrbništvo G9 ↔ D1, raspored E1 na skupinu Bete | Odbijeno kompozitnim FK-om i politikom | L2 | SR-TEN-04 |
| ST-TEN-05 | M12 s kontekstom Alfa traži D9; s kontekstom Beta traži D2; dohvat bez konteksta | D2 samo u Alfi, D9 samo u Beti; nijedan odgovor ne miješa vrtiće; kontekst ne mijenja ishod autorizacije | L3 | SR-AUTHZ-02 |
| ST-TEN-06 | Svaki view i RPC izložen API-ju pozvan kao U1 i U9 | Vraća samo podatke vlastitog vrtića | L2 | SR-TEN-06, SR-API-02 |
| ST-TEN-07 | U1 dohvaća postojeći ID zapisa Bete i nepostojeći ID; uspoređuje status, tijelo, zaglavlja i brojače (`count`) | Identični odgovori — nema otkrivanja postojanja | L3 | SR-API-04 |
| ST-TEN-08 | Ako je Realtime uključen: G1 se pretplaćuje na promjene tablica i kanale | Prima samo događaje za koje ima pravo; bez Realtimea: pretplata odbijena | L3 | SR-API-05 |

### 3.3 Pristup skrbnika djeci
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-GRD-01 | G1 dohvaća D2 i D3 izravnim ID-om (dijete, upis, dolasci, izostanci, ovlaštene osobe) | Prazno/odbijeno, isti odgovor kao za nepostojeći ID | L2, L3 | SR-AUTHZ-04 |
| ST-GRD-02 | G1 izlistava djecu skupine S1, pretražuje po imenu, traži broj djece | Vidi samo D1; nema popisa ni broja ostale djece | L2, L3 | SR-AUTHZ-04, FR-04-9 |
| ST-GRD-03 | G1 dohvaća izvedene resurse: dolasci D2, razgovor o D2, ovlaštene osobe D2 | Odbijeno | L2 | SR-AUTHZ-04 |
| ST-GRD-04 | G2 (bez `can_report_absence`) šalje prijavu izostanka za D1 kroz API | Odbijeno; ništa nije zapisano | L2, L3 | SR-AUTHZ-04 |
| ST-GRD-05 | U1 aktivira ograničenje za G2 ↔ D1; G2 zatim dohvaća D1, status dolaska, obavijesti S1, dnevni pregled, razgovor; G1 dohvaća skrbnike i ograničenja D1 | G2: sve odbijeno na sljedećem zahtjevu; G1 ne vidi postojanje ograničenja | L2, L3 | SR-AUTHZ-05 |
| ST-GRD-06 | Skrbnička veza G3 ↔ D2 ističe (`valid_to` = T); G3 dohvaća D2 na T i T+1 | T: dopušteno; T+1: odbijeno | L2 | SR-AUTHZ-04 |
| ST-GRD-07 | G1 pokušava dodati, izmijeniti ili obrisati ovlaštenu osobu za D1 | Odbijeno (MVP: samo uprava); promjena koju napravi U1 je auditirana | L2 | SR-AUTHZ-09 |
| ST-GRD-08 | G1 mijenja vlastite zastavice ili veze (`can_view` za drugo dijete, novo skrbništvo) | Odbijeno | L2 | SR-AUTHZ-07 |

### 3.4 Pristup odgojitelja skupinama
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-EDU-01 | E1 dohvaća djecu, dolaske i izostanke S2 (D3) | Odbijeno | L2 | SR-AUTHZ-06 |
| ST-EDU-02 | E3 (zamjena S1 samo T) dohvaća S1 na T-1, T, T+1 | Samo T dopušteno | L2 | SR-AUTHZ-06 |
| ST-EDU-03 | U1 završava raspored E1 danas; E1 s još važećim JWT-om dohvaća S1 | Odbijeno na sljedećem zahtjevu | L3 | SR-AUTHZ-03, 06 |
| ST-EDU-04 | D1 premješten iz S1 u S2 s datumom T; E1 i E2 dohvaćaju D1 na T | E1 odbijeno, E2 dopušteno; povijesni dolasci D1 ostaju upravi | L2 | SR-AUTHZ-06 |
| ST-EDU-05 | E1 ispravlja dolazak nakon roka; E1 mijenja izvorni događaj izravno (`UPDATE`) | Ispravak nakon roka odbijen; izravni `UPDATE` izvornog događaja uvijek odbijen | L2 | SR-AUTHZ-12 |
| ST-EDU-06 | E1 objavljuje obavijest za cijeli vrtić i za S2 | Odbijeno (dok matrica ne odobri; tada samo vlastita skupina) | L2 | SR-AUTHZ-10 |
| ST-EDU-07 | E1 postavlja `recorded_by` = E2 ili `organization_id` = Beta pri evidenciji dolaska | Vrijednost se ignorira/odbija; zapis nosi E1 i Alfu | L2 | SR-API-03 |

### 3.5 Promjena uloge i opoziv pristupa
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-REV-01 | U1 deaktivira članstvo E1 dok E1 ima važeći access token | Sljedeći zahtjev odbijen; refresh ne stvara novu sesiju s pristupom | L3 | SR-AUTHZ-03, SR-SESS-03 |
| ST-REV-02 | Uloga korisnika smanjena s `director` na `educator` | Sljedeći zahtjev za upravljačke radnje odbijen | L3 | SR-AUTHZ-03 |
| ST-REV-03 | Skrbnička veza obrisana/zatvorena | Sljedeći zahtjev za dijete odbijen | L3 | SR-AUTHZ-03, 04 |
| ST-REV-04 | Zastavica `receives_messages` uklonjena G1 | G1 više ne čita razgovor (Should modul) | L2 | SR-AUTHZ-04 |
| ST-REV-05 | Članstvo M12 u Beti deaktivirano | M12 i dalje ima pristup u Alfi, nikakav u Beti | L3 | SR-AUTHZ-03, SR-TEN-05 |
| ST-REV-06 | Odjava svih sesija; korištenje starog refresh tokena; korištenje access tokena nakon odjave | Refresh odbijen (detekcija ponovne uporabe); access token odbijen ako je SR-SESS-04 usvojen, inače vrijedi najviše do isteka (mjeriti i dokumentirati) | L3 | SR-SESS-02, 04 |

### 3.6 Autentikacija i sesije
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-AUTH-01 | Pogrešan OTP N puta; ponovna uporaba ispravnog OTP-a; OTP nakon isteka; masovni zahtjevi za kod | Blokada nakon praga; jednokratnost; istek; ograničenje učestalosti | L3 | SR-AUTHN-02, SR-API-07 |
| ST-AUTH-02 | Zahtjev koda/prijava za postojeću i nepostojeću e-poštu | Identični odgovori i usporedivo vrijeme | L3 | SR-AUTHN-03 |
| ST-AUTH-03 | Pozivnica iskorištena dvaput, nakon isteka, nakon opoziva; sadržaj e-pošte | Odbijeno; e-pošta bez podataka o djetetu | L3 | SR-AUTHN-04, 05 |
| ST-AUTH-04 | E-pošta ne sadrži poveznicu koja sama prijavljuje; deep link ne nosi token | Potvrđeno pregledom predložaka i e2e testom | L4 | SR-AUTHN-01, SR-MOB-04 |
| ST-AUTH-05 | Korisnik bez MFA koji ima ulogu uprave pokušava preskočiti postavljanje MFA izravnim API pozivom | Odbijeno (AAL1 nedovoljan) | L3 | SR-AUTHN-07 |
| ST-AUTH-06 | Prijava s novog uređaja | Korisnik dobiva obavijest bez podataka o djetetu | L3 | SR-AUTHN-06 |
| ST-SESS-01 | Pregled pohrane: mobilni (Keychain/Keystore, nema tokena u AsyncStorage), web (nema tokena u `localStorage` gdje je izvedivo; kolačići `Secure`, `SameSite`) | Potvrđeno | L4 | SR-SESS-01 |

### 3.7 Privilegirani računi
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-PRIV-01 | U1 i P1 s AAL1 (bez MFA) pozivaju upravljačke radnje i čitanje podataka | Odbijeno u bazi/funkciji, ne samo u UI-ju | L2, L3 | SR-AUTHN-07 |
| ST-PRIV-02 | P1 čita djecu, skrbnike, dolaske, izostanke, obavijesti, razgovore, audit vrtića Alfa | Odbijeno/prazno; P1 vidi samo konfiguraciju organizacije i prvog administratora | L2, L3 | SR-PRIV-01 |
| ST-PRIV-03 | Bilo koji korisnik mijenja vlastitu ulogu, članstvo, zastavice, raspored | Odbijeno | L2 | SR-AUTHZ-07 |
| ST-PRIV-04 | P1 pokušava sebi dodati članstvo u Alfi; P1 kreira organizaciju | Dodavanje članstva odbijeno; kreiranje dopušteno i auditirano, audit vidljiv upravi te organizacije | L2, L3 | SR-PRIV-02 |
| ST-PRIV-05 | U1 čita sadržaj razgovora o D1 | Odbijeno do odluke Q-T16 | L2 | SR-AUTHZ-11 |

### 3.8 API, RPC i Edge Functions
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-API-01 | Mass assignment: klijent šalje `recorded_by`, `recorded_at`, `status`, `approved_by`, `organization_id` u insert/update | Server postavlja vrijednosti; klijentske se ignoriraju ili odbijaju | L2, L3 | SR-API-03 |
| ST-API-02 | Zahtjev bez paginacije za veliki skup; ponavljani zahtjevi iznad praga | Ograničen broj redaka; ograničenje učestalosti na osjetljivim krajnjim točkama | L3 | SR-API-06, 07 |
| ST-API-03 | Izazvati grešku ograničenja, nepostojeću tablicu, pogrešan tip | Generička poruka s kodom; bez SQL-a, naziva ograničenja i stack tracea | L3 | SR-API-04 |
| ST-EF-01 | Svaka Edge Function pozvana kao G1, E1, U1, U9, P1, ANON za resurse Alfe | Samo uloge iz popisa dopuštenih s ispravnim odnosom uspijevaju | L3 | SR-EF-01, 02 |
| ST-EF-02 | Funkcija koja koristi service ključ pozvana s ID-om resursa drugog vrtića | Odbijeno eksplicitnom provjerom ovlasti | L3 | SR-EF-01 |
| ST-EF-03 | Privilegirana funkcija izvršena uspješno i neuspješno | Audit zapis u oba slučaja s ishodom | L3 | SR-EF-02, SR-AUD-01 |
| ST-EF-04 | Poziv bez JWT-a, s istekom, s nepoznatog Origin-a | Odbijeno; CORS ne dopušta nepoznate originove | L3 | SR-EF-03 |

### 3.9 Storage datoteke i potpisani URL-ovi
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-STO-01 | Konfiguracija: svi bucketi privatni; javni URL objekta | Javni pristup ne radi | L1, L3 | SR-STO-01 |
| ST-STO-02 | U9 traži izvoz Alfe pogađanjem putanje (`alfa-org-id/...`) za čitanje, listanje, upload, brisanje | Odbijeno | L3 | SR-STO-02 |
| ST-STO-03 | G1 traži izvoz koji nije za njega; E1 lista bucket izvoza | Odbijeno | L3 | SR-STO-02 |
| ST-STO-04 | Potpisani URL korišten unutar i nakon isteka; URL izdan tek nakon provjere ovlasti; URL se ne pojavljuje u logovima | Radi samo do isteka; bez provjere nema izdavanja; logovi čisti | L3 | SR-STO-03 |
| ST-STO-05 | Izvoz nakon preuzimanja i nakon roka | Objekt obrisan; ponovni URL ne radi; izdavanje auditirano | L3 | SR-STO-04 |
| ST-STO-06 | Uvoz: datoteka prevelika, pogrešan tip, CSV s formulama, neispravan UTF-8 | Odbijeno ili sigurno parsirano; izvoz CSV-a neutralizira formule | L3 | SR-STO-05 |
| ST-STO-07 | Izvoz za G1/D1: sadržaj i HTML verzija s tekstom koji sadrži `<script>` | Samo podaci G1/D1 iz Alfe; HTML escapean | L3 | SR-STO-06 |

### 3.10 Push, mobilni uređaj, admin web, logovi
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-PUSH-01 | Svi predlošci push obavijesti renderirani sa sintetičkim podacima | Payload ne sadrži nijedno ime, naziv skupine, naslov ni tekst | L2/L3 | SR-PUSH-01, SR-VEN-02 |
| ST-PUSH-02 | Slanje push obavijesti s klijenta / bez pristupnog tokena; čitanje tuđih tokena uređaja | Odbijeno | L3 | SR-PUSH-02 |
| ST-PUSH-03 | Odjava i deaktivacija | Token uklonjen; nema daljnjih obavijesti | L3 | SR-PUSH-03 |
| ST-PUSH-04 | Deep link iz obavijesti otvoren kao drugi korisnik ili nakon opoziva | Sadržaj nije prikazan; generičko "nije dostupno" | L4 | SR-MOB-04 |
| ST-DEV-01 | Daljinska odjava izgubljenog uređaja; zaključavanje aplikacije nakon neaktivnosti (ako Q-S12) | Uređaj gubi pristup pri sljedećem zahtjevu; lokalni podaci obrisani pri sljedećem pokretanju | L4 | SR-SESS-03, SR-MOB-05 |
| ST-DEV-02 | Pregled pohrane aplikacije na emulatoru (rootan) | Tokeni samo u sigurnoj pohrani; offline red šifriran; nema imena djece u otvorenom tekstu | L4, L5 | SR-MOB-01, 02 |
| ST-DEV-03 | Prikaz nedavnih aplikacija; sigurnosna kopija uređaja | Sadržaj skriven; osjetljivi podaci isključeni iz kopije | L4 | SR-MOB-03 |
| ST-DEV-04 | (Ako zajednički tablet) promjena korisnika | Nema podataka prethodnog korisnika | L4 | SR-MOB-06 |
| ST-WEB-01 | XSS payloadi u naslovu obavijesti, nazivu skupine, imenu; provjera CSP zaglavlja i `frame-ancestors` | Nema izvršavanja; zaglavlja prisutna | L4 | SR-WEB-01, 02 |
| ST-WEB-02 | Mutacija s tuđeg Origin-a; mutacija preko GET-a | Odbijeno | L4 | SR-WEB-03 |
| ST-WEB-03 | Dva korisnika (U1, U9) zaredom kroz isti CDN/edge; zaglavlja predmemorije | Nema dijeljenja odgovora; `no-store` na stranicama s podacima | L4 | SR-WEB-04 |
| ST-LOG-01 | Izazvati grešku u aplikaciji sa sintetičkim imenom djeteta u stanju ekrana; pregledati događaj u monitoringu i logove | Nema imena, e-pošte, tijela zahtjeva ni query parametara | L3, L4 | SR-LOG-01, 02 |

### 3.11 Revizijski zapis
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-AUD-01 | Svaka radnja iz FR-09-1 izvedena jednom | Točno jedan audit zapis po radnji s obveznim poljima; bez kopije sadržaja (nema imena/teksta) | L2 | SR-AUD-01 |
| ST-AUD-02 | Neuspjela privilegirana radnja (odbijena) | Zapis s ishodom "odbijeno" (gdje je primjenjivo) | L2, L3 | SR-AUD-01 |
| ST-AUD-03 | U1, P1 i service uloga aplikacije pokušavaju `UPDATE`/`DELETE`/`TRUNCATE` audita kroz API | Odbijeno | L2 | SR-AUD-02, 03 |
| ST-AUD-04 | U1 čita audit; U9 čita audit Alfe; P1 čita audit Alfe | U1 vidi samo Alfu; U9 ništa iz Alfe; P1 samo zapise o konfiguraciji organizacije | L2 | SR-AUD-02, SR-PRIV-01 |

### 3.12 Operacije i lanac opskrbe
| ID | Scenarij | Očekivano | Razina | SR |
|---|---|---|---|---|
| ST-OPS-01 | Secret scanning repozitorija i povijesti; pretraga buildova klijenta za service ključem | Nema nalaza | L1 | SR-SUP-04, SR-OPS-02 |
| ST-OPS-02 | Pregled popisa osoba s pristupom konzolama, MFA statusa i zapisa operativnog pristupa | Usklađeno s procedurom | L5 | SR-OPS-03, 04 |
| ST-OPS-03 | Skeniranje ovisnosti; popis paketa s install skriptama | Nema kritičnih ranjivosti bez iznimke; skripte popisane | L1 | SR-SUP-01, 02 |
| ST-OPS-04 | Instalirati nepotpisano/izmijenjeno OTA ažuriranje na testnom uređaju | Aplikacija ga odbija | L4 | SR-SUP-03 |
| ST-OPS-05 | Pokušaj migracije na produkciju mimo pipelinea / bez odobrenja | Nije moguće (zaštita grane, okruženja) | L5 | SR-OPS-01 |

## 4. Ulazni i izlazni kriteriji
- **Ulaz (po modulu):** matrica dozvola za modul odobrena; sintetički seed postoji; Critical SR-ovi modula imaju napisane testove prije koda (TDD za politike).
- **Izlaz (merge):** svi L1 i L2 testovi prolaze; NEG testovi modula ([security-requirements.md](security-requirements.md) §11) prolaze.
- **Izlaz (pilot, Faza 13):** svi L1–L4 prolaze; L5 pregled i vanjski pentest (ako odobren, D-13) bez otvorenih Critical/High nalaza; tabletop vježba incidentnog plana održana.

## 5. Izvještavanje
Rezultati se čuvaju kao CI artefakti (bez osobnih podataka — sintetički svijet). Svaki neuspjeh sigurnosnog testa koji se
pojavi nakon releasea tretira se kao potencijalni incident (vidi [incident-response-plan.md](incident-response-plan.md) §2).

## 6. Implementation status (D0, 2026-11-11)
| Test set | File | Status |
|---|---|---|
| ST-RLS-00 catalog checks (12 checks: RLS, anon privileges, DELETE grants, definer placement and `search_path`, private EXECUTE, views `security_invoker`, `user_metadata`, `true` policies, `organization_id NOT NULL`, public buckets) | `supabase/tests/database/00_catalog.test.sql` | ✅ passing |
| Tenant isolation for D0 tables (44 assertions: NEG-01, NEG-02, NEG-09, NEG-10, NEG-11, NEG-13, NEG-15; AAL2 gate; suspended/expired memberships; audit append-only) | `supabase/tests/database/01_tenant_isolation.test.sql` | ✅ passing |
| Phase 3 RLS spike (children/enrollments/attendance patterns) | `docs/architecture/spikes/rls-spike.sql` via `pnpm db:spike` | ✅ 14/14 |
| Mutation check | weakening `facilities_select` to `USING (true)` made 4 tests fail | ✅ tests are not vacuous |
| NEG-03…08, NEG-12, NEG-14; generated permission matrix (ST-RLS-01) | — | ⏳ with D1–D4 tables |
| D2-A children and enrolments (46 assertions: NEG-01, NEG-07, NEG-08, NEG-09, NEG-10; guardians see nothing before D2-B; immutable columns; audit) | `supabase/tests/database/09_children_enrollments.test.sql`, `tests/integration/src/children.test.ts` | ✅ 2026-11-12 |
| D2-B guardians and links (50 assertions: NEG-01, NEG-03, NEG-04, NEG-06, NEG-09, NEG-10, NEG-11; D-31 educator visibility incl. column grants; D-32; membership without link) | `supabase/tests/database/10_guardians.test.sql`, `tests/integration/src/guardians.test.ts` | ✅ 2026-11-12 |
| D2-C access restrictions (47 assertions: NEG-05 for view, absence reporting and messages; future/ended restrictions; other guardian and other links unaffected; only managers read/write; audit; D-31/D-32 unchanged) | `supabase/tests/database/11_access_restrictions.test.sql`, `tests/integration/src/access-restrictions.test.ts` | ✅ 2026-11-12 |
| D-33 restriction flag for educators (32 assertions: flag within D-31 scope only, no reference/author, read-only, no probing by other educators, guardians, other kindergartens, platform admin or managers without MFA; ends with transfer/assignment/restriction end) | `supabase/tests/database/12_restriction_flag.test.sql`, `tests/integration/src/access-restrictions.test.ts` | ✅ 2026-11-12 |
