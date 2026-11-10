# Sigurnosni zahtjevi — VrtićOS (MVP)

**Verzija:** 0.1 (nacrt) · **Datum:** 2026-11-10 · **Faza:** 2 (ograničeni opseg)
**Status:** zahtjevi za buduću implementaciju (Faza 5+); ništa nije implementirano. Pretpostavlja predloženu arhitekturu
(SA-01…SA-08 u [threat-model.md](threat-model.md)); odluke D-3…D-18 **nisu** odobrene.
**Izvori:** [threat-model.md](threat-model.md) · [../product/functional-specs.md](../product/functional-specs.md) ·
[../product/roles-and-permissions.md](../product/roles-and-permissions.md) · [../privacy/data-inventory.md](../privacy/data-inventory.md) ·
[../risks.md](../risks.md) · referentni okviri OWASP ASVS (cilj L2 — prijedlog D-13), MASVS, API Security Top 10.

## Prioriteti
| Prioritet | Značenje | Kada mora biti ispunjen |
|---|---|---|
| **Critical** | Bez ovoga moguć je pristup podacima djece izvan opsega ili potpuno zaobilaženje kontrola | Prije prvog koda modula koji ga treba; blokira merge |
| **High** | Značajno povećava rizik incidenta ili onemogućuje otkrivanje | Prije staginga s pilot konfiguracijom |
| **Medium** | Obrana u dubinu, smanjuje utjecaj | Prije produkcije (Faza 14) |
| **Low** | Poboljšanje; može se odgoditi uz zapis | Nakon pilota, uz pregled rizika |

Stupci: **FR / dozvole** — povezani funkcionalni zahtjevi i ključevi kataloga; **DI** — podaci iz inventara;
**Rizik / T** — registar rizika i prijetnje; **Test** — [security-test-plan.md](security-test-plan.md).

## 1. Izolacija vrtića (TEN)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-TEN-01 | Svaka tablica u izloženim shemama ima `ENABLE ROW LEVEL SECURITY` i barem jednu eksplicitnu politiku po operaciji koju klijent smije izvoditi; bez politike = zabrana. Tablice koje klijent ne treba nalaze se u neizloženoj shemi (`private`). | Critical | sve | sve R3/R4 | R-01, T-TEN-01 | ST-RLS-00, ST-TEN-01 |
| SR-TEN-02 | Zabranjene su politike `USING (true)` / `WITH CHECK (true)` na tenant tablicama za uloge `anon` i `authenticated`; iznimke samo uz ADR. | Critical | — | — | T-TEN-01 | ST-RLS-00 |
| SR-TEN-03 | CI provjera ruši build ako tablica/view u izloženoj shemi nema RLS (ili `security_invoker`) — vidi backlog P5-1. | Critical | — | — | R-01 | ST-RLS-00 |
| SR-TEN-04 | Svaka tenant tablica ima `organization_id NOT NULL`; reference između tenant tablica koriste kompozitni FK `(organization_id, id)` tako da veza dvaju vrtića nije moguća ni pogreškom aplikacije. | Critical | FR-04-2, FR-04-4 | DI-09…16 | R-01, T-TEN-02 | ST-TEN-04 |
| SR-TEN-05 | `INSERT`/`UPDATE` politike provjeravaju (`WITH CHECK`) da je `organization_id` organizacija u kojoj korisnik ima aktivno članstvo s odgovarajućom ulogom; `organization_id` se ne mijenja nakon kreiranja. | Critical | sve `*.manage`, `*.record` | sve | T-TEN-03 | ST-TEN-03 |
| SR-TEN-06 | Viewovi u izloženim shemama koriste `security_invoker = true`; materializirani viewovi nisu izloženi API-ju. | Critical | FS-14 `report.read` | DI-14, 16 | T-TEN-04 | ST-RLS-00, ST-TEN-06 |

## 2. Autorizacija (AUTHZ) — provedba matrice dozvola
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-AUTHZ-01 | Svaka politika i privilegirana funkcija izvodi odluku iz **trenutnog stanja baze** (članstvo, raspored, upis, skrbništvo, ograničenje, valjanost na lokalni datum vrtića) preko helper funkcija; matrica dozvola je jedini izvor istine. | Critical | svi ključevi | sve | R-02, T-AZ-* | ST-RLS-01 |
| SR-AUTHZ-02 | Odabrani "kontekst vrtića" u klijentu nikad nije autorizacija; svaki zahtjev se provjerava za organizaciju ciljnog zapisa. | Critical | FR-01-7 | — | T-TEN-07 | ST-TEN-05 |
| SR-AUTHZ-03 | Dinamične ovlasti (uloga, članstvo, raspored, skrbništvo) **ne** nose se u JWT claimovima kao izvor istine; opoziv djeluje na sljedeći zahtjev. | Critical | FR-01-8, FR-03-5 | DI-03, 04, 11 | R-02, T-SESS-02 | ST-REV-01…06 |
| SR-AUTHZ-04 | Skrbnik pristupa djetetu samo uz aktivnu skrbničku vezu i odgovarajuću zastavicu (`can_view`, `can_report_absence`, `receives_messages`); vrijedi za sve izvedene resurse (dolasci, izostanci, obavijesti skupine, dnevni pregled, razgovori, ovlaštene osobe). | Critical | FR-04-4, FR-04-9, `child.read` | DI-09…16 | R-04, T-AZ-01 | ST-GRD-01…04, 06 |
| SR-AUTHZ-05 | Aktivno `access_restriction` ima prednost nad svim zastavicama i djeluje odmah; skrbnik ne može saznati da ograničenje postoji za druge skrbnike. | Critical | FR-04-5, FR-04-6 | DI-12 | R-21, T-AZ-02 | ST-GRD-05 |
| SR-AUTHZ-06 | Odgojitelj pristupa samo djeci aktivno upisanoj u skupine za koje ima raspored važeći **danas**; zamjena izvan `valid_from`/`valid_to` ne daje pristup. | Critical | FR-03-3, FR-03-4, `attendance.*` | DI-09, 10, 14 | R-05, T-AZ-03 | ST-EDU-01…04 |
| SR-AUTHZ-07 | Korisnik ne može mijenjati vlastito članstvo, ulogu, zastavice skrbništva, ograničenja ni rasporede; takve promjene smije samo uprava (uz MFA) ili platform admin za prvog administratora. | Critical | `membership.manage`, `guardianship.manage` | DI-03, 04, 11, 12 | T-AZ-04 | ST-PRIV-03 |
| SR-AUTHZ-08 | Politike ne koriste podatke koje korisnik može sam mijenjati (npr. `raw_user_meta_data`/`user_metadata`). | Critical | — | DI-01 | T-AZ-05 | ST-RLS-00 |
| SR-AUTHZ-09 | Popis ovlaštenih osoba za preuzimanje mijenja samo uprava (MVP, FR-04-8); svaka promjena je auditirana. | High | FR-04-7, `pickup_person.manage` | DI-13 | T-AZ-06, T-CHD-01 | ST-GRD-07 |
| SR-AUTHZ-10 | Objava obavijesti provjerava da je publika unutar opsega autora (odgojitelj samo vlastita skupina, ako se uopće odobri — matrica "Ogr.***"). | High | FR-07-1, `announcement.publish` | DI-17 | T-AZ-08 | ST-EDU-06 |
| SR-AUTHZ-11 | Do odluke Q-T16 uprava **nema** pristup sadržaju razgovora. | High | FR-11-6 | DI-19 | T-AZ-09 | ST-PRIV-05 |
| SR-AUTHZ-12 | Ispravak dolaska nakon roka dopušten je samo ovlaštenima, traži kategoriju razloga, ne mijenja izvorni događaj. | High | FR-05-5, FR-05-10, `attendance.correct` | DI-15 | T-AZ-10 | ST-EDU-05 |

## 3. Autentikacija i sesije (AUTHN, SESS)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-AUTHN-01 | Prijava i prihvaćanje pozivnice koriste jednokratni kod koji korisnik unosi u aplikaciju; u e-pošti nema poveznice koja sama prijavljuje korisnika. | High | FR-01-2, FR-01-3 | DI-01, 05 | T-AUTH-05, T-AUTH-07 | ST-AUTH-04 |
| SR-AUTHN-02 | OTP: najmanje 6 znamenki, kratko trajanje (prijedlog ≤ 10 min), jednokratan, ograničen broj pokušaja po kodu, računu i IP-u; zaključavanje nakon prekoračenja. | Critical | FR-01-3 | DI-01 | T-AUTH-01 | ST-AUTH-01 |
| SR-AUTHN-03 | Odgovori na prijavu, pozivnicu i zahtjev koda ne otkrivaju postoji li račun. | Medium | FR-01-3 | DI-01 | T-AUTH-02 | ST-AUTH-02 |
| SR-AUTHN-04 | Pozivnice i e-pošta ne sadrže ime djeteta, skupinu ni drugi podatak o djetetu; pozivnica je jednokratna, vremenski ograničena i opoziva. | High | FR-01-2 | DI-05 | T-AUTH-04, T-MAIL-01 | ST-AUTH-03, AC-01-1 |
| SR-AUTHN-05 | Postoji mehanizam brzog opoziva pogrešne veze (pozivnica/skrbništvo) i procedura incidenta (IRP playbook P-03). Opcija za odluku: povezivanje s djetetom zahtijeva i kod predan osobno u vrtiću (Q-S11). | High | FR-01-2, FR-04-4 | DI-05, 11 | R-30, T-AUTH-04 | ST-AUTH-03 |
| SR-AUTHN-06 | Korisnik dobiva obavijest (e-pošta, bez podataka o djetetu) o prijavi s novog uređaja. | Medium | FR-01-8 | DI-06 | R-06, T-AUTH-03 | ST-AUTH-06 |
| SR-AUTHN-07 | `org_admin`, `director`, `platform_admin`: TOTP MFA obvezan; politike i privilegirane funkcije za te uloge zahtijevaju razinu prijave AAL2 (provjera u bazi, ne samo u UI-ju). | Critical | FR-01-6 | DI-01 | T-AUTH-06, T-PRV-01 | ST-PRIV-01, ST-AUTH-05 |
| SR-SESS-01 | Mobilni tokeni u sigurnoj pohrani OS-a (Keychain/Keystore); u webu bez tokena u `localStorage` gdje je izvedivo (kolačići uz `Secure`, `SameSite`), uz CSP (SR-WEB-02) kao glavnu zaštitu. | High | FR-01-10 | DI-06 | T-SESS-01 | ST-SESS-01 |
| SR-SESS-02 | Kratko trajanje access tokena (prijedlog 10–15 min, Q-S10) i rotacija refresh tokena s detekcijom ponovne uporabe. | High | FR-01-8 | DI-06 | T-SESS-02 | ST-REV-06 |
| SR-SESS-03 | Korisnik i uprava mogu odjaviti sve sesije; deaktivacija članstva odmah ukida pristup podacima (SR-AUTHZ-03), a opoziv refresh tokena sprječava novu sesiju. | High | FR-01-8 | DI-06 | T-DEV-01, R-09 | ST-REV-01, ST-DEV-01 |
| SR-SESS-04 | Opcija za odluku (Q-S10): politike provjeravaju da sesija iz JWT-a još postoji, čime odjava djeluje odmah i na access token. | Medium | FR-01-8 | DI-06 | T-SESS-02 | ST-REV-06 |

## 4. API, RPC i Edge Functions (API, EF)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-API-01 | `SECURITY DEFINER` funkcije nalaze se samo u neizloženoj shemi, imaju fiksni `search_path`, a `EXECUTE` je oduzet od `PUBLIC`/`anon` i dodijeljen samo potrebnoj ulozi. | Critical | — | — | R-35, T-API-01 | ST-RLS-00 |
| SR-API-02 | RPC funkcije izložene API-ju su po zadanom `SECURITY INVOKER`; svaka iznimka ima ADR i negativne testove. | Critical | — | — | T-API-01, T-TEN-04 | ST-RLS-00 |
| SR-API-03 | Polja koja određuje poslužitelj (`organization_id` iz konteksta, `recorded_by`, `recorded_at`, statusi, `approved_by`) postavljaju se u bazi (default/trigger) ili su zaštićena grantovima na razini stupca; klijentska vrijednost se ignorira ili odbija. Svi ulazi validiraju se Zod shemama i ograničenjima u bazi. | Critical | FR-05-2, FR-03-3 | DI-04, 14 | T-API-03 | ST-API-01 |
| SR-API-04 | Nedopušten i nepostojeći resurs vraćaju isti odgovor; poruke grešaka prema klijentu su generičke s kodom (bez SQL-a, naziva ograničenja, stack tracea). | High | opće pravilo FS §2 | — | T-TEN-05, T-API-05 | ST-TEN-07, ST-API-03 |
| SR-API-05 | Realtime je isključen u MVP-u osim ako modul to izričito zahtijeva; ako se uključi, koristi samo kanale s autorizacijom i RLS. | High | FS-11 (eventualno) | DI-19 | T-TEN-06 | ST-TEN-08 |
| SR-API-06 | Ograničen maksimalan broj redaka po odgovoru i obvezna paginacija; indeksi na stupcima koje koriste politike. | Medium | — | — | T-API-04 | ST-API-02 |
| SR-API-07 | Ograničenje učestalosti za osjetljive krajnje točke (OTP, pozivnice, izvozi, Edge Functions). | High | FR-01-3, FR-15-2 | — | T-API-04, T-AUTH-01 | ST-AUTH-01, ST-API-02 |
| SR-API-08 | Mutacije iz offline reda nose `idempotency_key` s jedinstvenim ograničenjem u bazi. | Medium | FR-05-8 | DI-14 | T-API-08 | AC-05-2 |
| SR-EF-01 | Edge Functions po zadanom koriste klijent s **korisnikovim** JWT-om (RLS vrijedi). Service ključ samo gdje je nužno, uz eksplicitnu provjeru ovlasti pozivatelja prije svake operacije. | Critical | FR-01-1, FR-15-2 | sve | T-API-02 | ST-EF-01, 02 |
| SR-EF-02 | Svaka privilegirana Edge Function ima popis dopuštenih uloga i relacijskih uvjeta, piše audit zapis i ima negativne testove. | Critical | FS-01, FS-09, FS-15 | DI-22 | T-API-02 | ST-EF-03 |
| SR-EF-03 | Provjera JWT-a uključena za sve funkcije osim izričito javnih (npr. webhook s potpisom); CORS ograničen na poznate originove. | High | — | — | T-API-06 | ST-EF-04 |

## 5. Storage i datoteke (STO)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-STO-01 | Svi bucketi su privatni; CI/konfiguracijska provjera ruši build ako je bucket javni. | Critical | FS-15 | DI-23 | R-11, T-STO-01 | ST-STO-01 |
| SR-STO-02 | Putanja objekta počinje s `organization_id` (i dodatnim opsegom); Storage politike provjeravaju članstvo i odnos iz baze, ne samo putanju. | Critical | FR-15-2, `dsr.manage` | DI-23 | T-STO-02 | ST-STO-02, 03 |
| SR-STO-03 | Potpisani URL-ovi: najkraće praktično trajanje (prijedlog izvoz ≤ 5 min, mediji kasnije ≤ 5 min), izdaju se tek nakon provjere ovlasti, ne zapisuju se u logove ni analitiku. | High | FR-15-2 | DI-23 | R-28, T-STO-03 | ST-STO-04 |
| SR-STO-04 | Izvozi zahtjeva ispitanika brišu se automatski nakon preuzimanja ili kratkog roka (prijedlog 24 h); svako izdavanje poveznice je auditirano. | High | FR-15-2 | DI-23 | T-STO-03 | ST-STO-05 |
| SR-STO-05 | Uvoz datoteka: whitelist tipova, ograničenje veličine, parsiranje na poslužitelju, odbijanje formula (`=`, `+`, `-`, `@` na početku ćelije) pri izvozu u CSV. | Medium | FR-04-10 | — | T-STO-04 | ST-STO-06 |
| SR-STO-06 | Izvoz se generira iz upita ograničenog na jednu organizaciju i navedene ispitanike; HTML verzija escapea sav korisnički tekst. | High | FR-15-2 | DI-23 | T-STO-05, T-STO-07 | ST-STO-07 |
| SR-STO-07 | (Faza 11) Fotografije: uklanjanje EXIF/GPS metapodataka, ponovno kodiranje, provjera privole za svako označeno dijete prije izdavanja URL-a. | — (izvan MVP-a) | — | DI-F1 | T-STO-06 | — |

## 6. Push i e-pošta (PUSH)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-PUSH-01 | Payload sadrži samo generički tekst i neprozirni ID događaja; bez imena, skupine, sadržaja. Automatizirani test na svim predlošcima. | Critical | FR-08-2 | DI-07 | R-07, T-PUSH-01 | ST-PUSH-01 |
| SR-PUSH-02 | Slanje push obavijesti dopušteno je samo poslužitelju (kod Expo Push: obvezni pristupni token za slanje); tokeni uređaja nisu čitljivi drugim korisnicima. | High | FR-08-6 | DI-07 | R-33, T-PUSH-02 | ST-PUSH-02 |
| SR-PUSH-03 | Odjava i deaktivacija brišu token uređaja; nevažeći tokeni se uklanjaju po povratnoj informaciji dobavljača. | High | FR-08-6 | DI-07 | T-PUSH-03 | ST-PUSH-03 |

## 7. Mobilna aplikacija (MOB)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-MOB-01 | Tokeni samo u sigurnoj pohrani OS-a; podaci o djeci ne pišu se u nešifriranu pohranu. | High | FR-01-10 | DI-06, 09, 14 | T-DEV-02 | ST-DEV-02 |
| SR-MOB-02 | Offline red sadrži samo minimalne podatke (ID-ovi, vrijeme, vrsta), šifriran je i briše se pri odjavi (uz upozorenje na neposlane unose). | High | FR-05-8 | DI-14 | T-DEV-02, T-DEV-06 | ST-DEV-02, AC-05-5 |
| SR-MOB-03 | Sadržaj zaslona se skriva u prikazu nedavnih aplikacija; aplikacija ne uključuje osjetljive podatke u sigurnosne kopije uređaja. | Medium | — | DI-09 | T-DEV-03 | ST-DEV-03 |
| SR-MOB-04 | Deep linkovi (uključujući one iz push obavijesti) nose samo ID-ove, a sadržaj se dohvaća nakon autorizacije; koriste se verificirani universal/app linkovi; nikakvi tokeni ne idu kroz custom URL sheme. | High | FR-08-3 | — | T-PUSH-04, T-AUTH-05 | ST-PUSH-04 |
| SR-MOB-05 | Opcionalno zaključavanje aplikacije za djelatnike preko mehanizma OS-a (PIN/otključavanje uređaja) nakon neaktivnosti — odluka Q-S12. VrtićOS ne obrađuje biometrijske podatke; provjeru radi OS. | Medium | — | — | T-DEV-01 | ST-DEV-01 |
| SR-MOB-06 | Ako se odobri zajednički tablet (Q-T03): brza odjava, automatska odjava nakon neaktivnosti, bez zadržavanja podataka prethodnog korisnika. | Medium (uvjetno) | — | — | T-DEV-05 | ST-DEV-04 |

## 8. Admin web (WEB)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-WEB-01 | Sav korisnički sadržaj renderira se kao tekst; zabranjeno umetanje sirovog HTML-a iz korisničkog unosa. | Critical | FS-07, FS-10, FS-11 | DI-17…19 | R-34, T-WEB-01 | ST-WEB-01 |
| SR-WEB-02 | Stroga Content-Security-Policy (bez `unsafe-inline` skripti, `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`. | High | — | — | R-34, T-WEB-01, T-WEB-04 | ST-WEB-01 |
| SR-WEB-03 | Mutacije zaštićene od CSRF-a (provjera Origin-a, `SameSite` kolačići); nema mutacija preko GET-a. | High | — | — | T-WEB-02 | ST-WEB-02 |
| SR-WEB-04 | Stranice s osobnim podacima nisu predmemorirane na dijeljenim slojevima (CDN, statičko generiranje); `Cache-Control: no-store`. | High | — | sve | T-WEB-03 | ST-WEB-03 |

## 9. Revizija i logovi (AUD, LOG)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-AUD-01 | Audit zapis za sve radnje iz FR-09-1, pisan u istoj transakciji kao promjena (ili kroz pouzdan outbox), s akterom, ulogom, organizacijom, radnjom, ID-om cilja, vremenom, ishodom. | Critical | FR-09-1, FR-09-2 | DI-22 | T-SESS-03, T-PRV-01 | ST-AUD-01 |
| SR-AUD-02 | Audit je samo za dodavanje: nema `UPDATE`/`DELETE` grantova ni politika za klijentske uloge; tablica u neizloženoj shemi, čitanje kroz kontrolirani view/RPC. | Critical | FR-09-3, `audit.read` | DI-22 | T-PRV-03 | ST-AUD-03 |
| SR-AUD-03 | Integritet audita provjerljiv (npr. ulančani hash ili periodički izvoz izvan baze) — odluka Faze 3. | Medium | FR-09-3 | DI-22 | T-PRV-03 | ST-AUD-03 |
| SR-AUD-04 | (Nakon MVP-a) upozorenja na neobične obrasce: masovne promjene skrbništva, mnogo izvoza, prijave iz neuobičajenih lokacija. | Low | — | DI-22 | T-PRV-01 | — |
| SR-LOG-01 | Sentry/monitoring: bez slanja osobnih podataka po zadanom, `beforeSend` scrubbing, bez session replaya i snimki zaslona, bez tijela zahtjeva i query parametara. | High | NFR-SEC-05 | DI-25 | R-08, T-VEN-02 | ST-LOG-01 |
| SR-LOG-02 | Aplikacijski logovi ne sadrže imena, e-pošte, sadržaj poruka ni tokene; koriste ID-ove i korelacijske ID-ove. | High | NFR-SEC-05 | DI-24 | R-08 | ST-LOG-01 |
| SR-LOG-03 | Sigurnosno relevantni logovi (auth, API greške pristupa, Edge Functions, audit) čuvaju se dovoljno dugo za istragu incidenta (prijedlog ≥ 90 dana, ⚖️ uskladiti s retencijom) — ako dobavljač čuva kraće, potreban je izvoz logova u EU pohranu (Q-S08). | High | — | DI-24 | R-32, T-VEN-03 | — (operativno) |

## 10. Lanac opskrbe, isporuka i operacije (SUP, OPS, VEN, PRIV)
| ID | Zahtjev | Prioritet | FR / dozvole | DI | Rizik / T | Test |
|---|---|---|---|---|---|---|
| SR-SUP-01 | Pinane verzije i lockfile; automatsko skeniranje ovisnosti; nove ovisnosti zahtijevaju pregled (licence, održavanje, install skripte). | High | — | — | R-17, T-SUP-01 | ST-OPS-03 |
| SR-SUP-02 | Instalacijske skripte paketa onemogućene po zadanom gdje je izvedivo; iznimke popisane. | Medium | — | — | T-SUP-01 | ST-OPS-03 |
| SR-SUP-03 | OTA ažuriranja mobilne aplikacije potpisana su (code signing) i aplikacija odbija nepotpisana ažuriranja; objava ažuriranja na produkcijski kanal zahtijeva odobrenje. | High | — | — | R-29, T-SUP-02 | ST-OPS-04 |
| SR-SUP-04 | Secret scanning u CI-u i pre-commit; service/secret ključevi nikad u klijentu, repozitoriju, logovima ni `NEXT_PUBLIC_*` varijablama. | Critical | — | AS-05 | R-16, T-PRV-04, T-API-07 | ST-OPS-01 |
| SR-OPS-01 | Produkcijske migracije samo kroz CI pipeline sa zaštićenom granom, pregledom i ručnim odobrenjem; nema ručnih izmjena sheme na produkciji. | High | — | — | T-SUP-03 | ST-OPS-05 |
| SR-OPS-02 | Tajne u upravitelju tajni dobavljača/CI-a s najmanjim opsegom; odvojene tajne za staging i produkciju. | High | — | AS-05 | T-PRV-04 | ST-OPS-01 |
| SR-OPS-03 | Pristup konzolama dobavljača (Supabase, hosting, Expo, e-pošta, Sentry, GitHub) samo imenovanim osobama s MFA; popis se pregledava (Q-S05). | Critical | — | sve | R-31, T-PRV-02 | ST-OPS-02 |
| SR-OPS-04 | Procedura za operativni pristup produkcijskim podacima: razlog, odobrenje druge osobe, vremensko ograničenje, zapis; obavijest vrtiću prema dogovoru (Q-S06 ⚖️). | High | FR-09-5 | sve | R-31, T-PRV-02 | ST-OPS-02 |
| SR-OPS-05 | Dokumentirana i uvježbana rotacija svih ključeva (API ključevi, JWT signing, ključevi dobavljača) — playbook u incidentnom planu. | High | — | AS-05 | T-PRV-04 | IRP vježba |
| SR-OPS-06 | Domena za e-poštu ima SPF, DKIM i DMARC (politika `reject` nakon prijelaznog razdoblja). | Medium | FR-01-2 | — | T-MAIL-02, T-AUTH-07 | — (operativno) |
| SR-VEN-01 | Za svakog dobavljača: DPA, lokacija podataka, kontakt za sigurnosne incidente, rok obavještavanja — zapis u registru podizvršitelja (Faza 2, ⚖️). | High | — | sve | R-03, T-VEN-01 | — |
| SR-VEN-02 | Dobavljači dobivaju najmanji mogući skup podataka (push bez sadržaja, monitoring bez PII, e-pošta bez podataka o djeci). | High | FR-08-2 | DI-07, 25 | T-VEN-01 | ST-PUSH-01, ST-LOG-01 |
| SR-PRIV-01 | Platform admin u proizvodu nema pristup tablicama s podacima djece, članovima ni sadržaju (osim prvog administratora koji je sam pozvao). | Critical | FR-02-1, FR-09-5 | DI-09…19 | T-AZ-07 | ST-PRIV-02 |
| SR-PRIV-02 | Platform admin ne može sebi dodijeliti članstvo u vrtiću kroz proizvod; svaka radnja platform admina je auditirana i vidljiva upravi vrtića za njihovu organizaciju. | High | FR-02-1 | DI-03, 22 | T-PRV-05 | ST-PRIV-04 |

## 11. Obvezni negativni testovi izolacije podataka
Ovi testovi su **uvjet za merge** koda modula na koji se odnose (Critical). Detalji i koraci: [security-test-plan.md](security-test-plan.md).

| ID | Negativni test | ST |
|---|---|---|
| NEG-01 | Korisnik vrtića Alfa ne može čitati, mijenjati, brisati ni referencirati nijedan zapis Bete — za **svaku** tablicu i operaciju | ST-TEN-01…04 |
| NEG-02 | Korisnik s članstvom u Alfi i Beti ne dobiva miješane podatke ni pod kojim kontekstom | ST-TEN-05 |
| NEG-03 | Skrbnik ne vidi dijete bez skrbničke veze (ID, popis, pretraga, izvedeni resursi) i ne doznaje njegovo postojanje | ST-GRD-01…03 |
| NEG-04 | Skrbnik bez zastavice ne izvodi radnju (npr. prijava izostanka bez `can_report_absence`) | ST-GRD-04 |
| NEG-05 | Skrbnik s aktivnim ograničenjem nema pristup; drugi skrbnik ne vidi ograničenje | ST-GRD-05 |
| NEG-06 | Skrbnik nakon isteka veze nema pristup | ST-GRD-06 |
| NEG-07 | Odgojitelj ne vidi djecu izvan svojih skupina | ST-EDU-01 |
| NEG-08 | Odgojitelj nakon kraja rasporeda/zamjene i nakon premještaja djeteta nema pristup | ST-EDU-02…04 |
| NEG-09 | Opozvan korisnik (deaktivacija, promjena uloge) gubi pristup na sljedećem zahtjevu, prije isteka JWT-a | ST-REV-01…05 |
| NEG-10 | Platform admin ne čita podatke djece | ST-PRIV-02 |
| NEG-11 | Korisnik ne mijenja vlastitu ulogu, članstvo ni skrbničke zastavice | ST-PRIV-03 |
| NEG-12 | Storage objekt drugog vrtića/osobe nije dohvatljiv ni s pogođenom putanjom; istekao potpisani URL ne radi | ST-STO-02…04 |
| NEG-13 | Audit se ne može izmijeniti ni obrisati, a uprava vidi samo audit svoje organizacije | ST-AUD-03, ST-AUD-04 |
| NEG-14 | Viewovi, RPC-ovi, Realtime i Edge Functions provode ista pravila kao tablice | ST-TEN-06, ST-TEN-08, ST-EF-01…03 |
| NEG-15 | Neautentificirani (`anon`) korisnik ne dohvaća nijedan tenant zapis | ST-TEN-02 |

## 12. Mapiranje na okvire (nacrt)
Detaljna kontrolna lista ASVS L2 / MASVS ostaje backlog stavka P2-20. Približno mapiranje skupina:
TEN/AUTHZ → ASVS V8 (Authorization), API Top 10 API1/API3/API5; AUTHN/SESS → ASVS V6/V7, MASVS-AUTH; API/EF → ASVS V4/V13,
API Top 10 API4/API8; STO → ASVS V12; MOB → MASVS-STORAGE/PLATFORM; WEB → ASVS V3/V14; AUD/LOG → ASVS V16; SUP/OPS → ASVS V15, MASVS-CODE.
Brojevi poglavlja ASVS-a razlikuju se između verzija — **provjeriti prema verziji koja se usvoji** (Faza 2, P2-20).
