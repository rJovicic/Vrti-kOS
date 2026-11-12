# Inventar osobnih podataka — nacrt v0

**Datum:** 2026-11-10 · **Faza:** 1 (izrađen ranije od plana jer ga traži specifikacija MVP-a; dovršava se u Fazi 2)
**Izvor:** [../product/functional-specs.md](../product/functional-specs.md), [../product/domain-model.md](../product/domain-model.md)

> ⚠️ Tehnički nacrt, ne pravna procjena. **Svrhe su prijedlozi**, **pravne osnove nisu utvrđene**, a uloga
> voditelja/izvršitelja za svaki redak je ⚖️ otvorena (Q-P01). Rokovi čuvanja su namjerno navedeni kao
> **pitanja**, ne kao odluke (Q-P09). Svi primjeri u razvoju i testovima su sintetički.

## 1. Ljestvica osjetljivosti (prijedlog — temelj za `data-classification.md`)
| Razina | Naziv | Opis | Primjeri |
|---|---|---|---|
| **R1** | Interno | Nije osobni podatak ili je trivijalan poslovni podatak | struktura vrtića, jelovnik |
| **R2** | Osobni | Osobni podaci odraslih u poslovnom kontekstu | ime djelatnika, e-pošta skrbnika |
| **R3** | Osobni — dijete | Bilo koji podatak koji se odnosi na identificirano dijete | upis, dolasci, izostanci |
| **R4** | Visoko osjetljivo | Podaci čije otkrivanje može ozbiljno naštetiti djetetu/obitelji ili mogu sadržavati posebne kategorije | ograničenja pristupa (obiteljske/sudske okolnosti), sadržaj poruka |
| **R5** | Posebne kategorije (čl. 9) | Zdravlje, biometrija itd. | **isključeno iz MVP-a** (D-9) |

## 2. Inventar

Kratice pristupa: **U** = uprava (`org_admin`, `director`), **O** = odgojitelj u opsegu rasporeda, **S** = skrbnik u opsegu
skrbničke veze, **P** = platform admin, **Sys** = sustav/procesi, **Sam** = osoba sama o sebi.
Lokacija: **DB** = baza (Supabase EU, ADR-0003 — prijedlog), **Auth** = Supabase Auth, **Push** = Expo/APNs/FCM,
**Mail** = pružatelj e-pošte (ADR-0007), **Mon** = praćenje grešaka (ADR-0007).

| ID | Kategorija | Ispitanici | Polja (MVP) | Svrha (prijedlog) | Izvor | Pristup | Osj. | Lokacija | MVP |
|---|---|---|---|---|---|---|---|---|---|
| DI-01 | Korisnički račun i autentikacija | skrbnici, djelatnici, admini | e-pošta, ID računa, MFA faktor, vrijeme prijave | identifikacija i sigurna prijava | osoba, pozivnica | Sam, Sys; U vidi e-poštu članova | R2 | Auth, Mail | Da |
| DI-02 | Profil korisnika | isto | ime, prezime, prikazno ime, jezik | prikaz u komunikaciji | uprava, osoba | Sam, U; O/S vide ime druge strane u kontekstu | R2 | DB | Da |
| DI-03 | Članstvo i uloga | isto | organizacija, uloga, status, valjanost; verzija i vrijeme potvrde čitanja obavijesti o privatnosti (FR-01-5, nije privola) | kontrola pristupa; dokaz da je obavijest prikazana | uprava | Sam, U | R2 | DB | Da |
| DI-04 | Raspored djelatnika | djelatnici | skupina, vrsta (redovni/zamjena), od–do, odobrio | kontrola pristupa, organizacija rada | uprava | Sam, U | R2 | DB | Da |
| DI-05 | Pozivnica | budući korisnici | e-pošta, ime, prezime, uloga, rok, status, tko je pozvao/opozvao; [D2] veza sa skrbnikom. Pozivnica unaprijed stvara Auth račun bez članstva (ADR-0017, R-43); obavijest e-poštom bez poveznice i bez podataka o djeci | kreiranje računa | uprava | U, Sys | R2 | DB, Auth, Mail | Da |
| DI-06 | Sesije i uređaji | korisnici | ID sesije, tip uređaja/OS, zadnja aktivnost, IP u auth logu | sigurnost računa | Sys | Sam, Sys | R2 | Auth | Da |
| DI-07 | Push token i postavke obavijesti | korisnici | token uređaja, platforma, postavke | dostava obavijesti | uređaj | Sys, Sam | R2 | DB, Push | Da |
| DI-08 | Struktura vrtića | — (pretežno nije osobni podatak) | vrtić, objekt (adresa objekta), ped. godina, skupina | organizacija rada | uprava, P | svi članovi u opsegu | R1 | DB | Da |
| DI-09 | Identifikacija djeteta | djeca | ime, prezime, interna oznaka, status (upisano/ispisano) | identifikacija djeteta u svim funkcijama | uprava | U; O (svoje skupine); S (svoje dijete) | R3 | DB | Da |
| DI-10 | Upis | djeca | skupina, od–do (premještaj zatvara stari i otvara novi upis, povijest se čuva; ispis zatvara upis, veze i ovlaštenja sa zadnjim danom — D-35) | određivanje skupine i pristupa | uprava | U; O; S | R3 | DB | Da |
| DI-11 | Skrbnička veza | djeca, skrbnici | dijete, skrbnik, zastavice dozvola, valjanost | kontrola pristupa skrbnika | uprava | U; S (vlastita veza); O (D-31: samo ime i prezime skrbnika i prava za djecu iz svojih skupina danas, bez kontakata; vidi skrbnike djece u skupini za predaju) | R3 | DB | Da |
| DI-12 | Ograničenje pristupa | djeca, skrbnici | veza, opseg ograničenja, valjanost, interna referenca na dokument | zaštita djeteta, provedba odluka | uprava | **samo U**; Sys za provedbu; O vidi samo oznaku „Ograničeno” za djecu svoje skupine danas (D-33), bez reference, razloga i autora | **R4** | DB | Da |
| DI-13 | Ovlaštena osoba za preuzimanje | treće osobe | ime, prezime, valjanost po djetetu (D2-D); **telefon i odnos se ne prikupljaju niti pohranjuju** (Q-T13 zatvoren, D-34); bez korisničkog računa | sigurno preuzimanje djeteta | uprava (na zahtjev skrbnika) | U (unos/izmjena, MFA); O (samo danas valjane osobe za djecu svoje skupine danas, D-31); S (samo pregled, danas valjane osobe, uz pravo pregleda i bez aktivnog ograničenja) | R3 | DB | Da |
| DI-14 | Dolasci i odlasci | djeca, skrbnici/ovlaštene osobe (predaja), djelatnici (akter) | vrijeme, vrsta, akter, osoba predaje (referenca), izvor | evidencija prisutnosti i sigurnost djeteta | odgojitelj | U; O; S (status svog djeteta) | R3 | DB | Da |
| DI-15 | Ispravci dolazaka | isto | izvorni događaj, kategorija razloga, akter | točnost evidencije, odgovornost | odgojitelj, uprava | U; O (svoje) | R3 | DB | Da |
| DI-16 | Prijava izostanka | djeca, skrbnici | razdoblje, prijavitelj, vrijeme, izvor, status — **bez razloga** | informiranje vrtića o izostanku | skrbnik, uprava | U; O (skupina u razdoblju); S (sa `can_view`) | R3 | DB | Da |
| DI-17 | Obavijesti vrtića | autori (djelatnici) | naslov, tekst, autor, publika, verzije | informiranje skrbnika i djelatnika | uprava (odgojitelj?) | publika obavijesti, U | R2 (R3 ako tekst spominje dijete — upozorenje autoru) | DB | Da |
| DI-18 | Dnevni pregled skupine | djeca (skupno), autor | tekst, oznake aktivnosti, datum, autor | informiranje skrbnika o danu skupine | odgojitelj | skrbnici skupine tog dana, U, O | R3 | DB | Should |
| DI-19 | Razgovori i poruke | skrbnici, djelatnici, djeca (spominjana) | sudionici, tekst, vrijeme, povučeno | komunikacija vrtić–skrbnik o djetetu | sudionici | sudionici; U [Q-T16] | **R4** (sadržaj može sadržavati bilo što, uključujući zdravlje) | DB, Push (samo generička obavijest) | Should |
| DI-20 | Jelovnik | — (autor) | obroci, jela, opći alergeni jela | informiranje | uprava | svi u opsegu objekta | R1 | DB | Should |
| DI-21 | Kalendar | — (autor) | naslov, opis, vrijeme, publika | informiranje | uprava | publika | R1/R2 | DB | Should |
| DI-22 | Revizijski zapis | svi akteri, ciljevi (ID) | akter, uloga, radnja, ID cilja, vrijeme, ishod, korelacija | odgovornost, sigurnost, dokaz | Sys | U (svoja org.), P (samo konfiguracija) | R3 (povezuje aktere i djecu preko ID-a) | DB | Da |
| DI-23 | Zahtjevi ispitanika | podnositelji, djeca | vrsta, rok, status, koraci, izvoz (privremeno) | ispunjavanje prava ispitanika | skrbnik, djelatnik | U; P samo na pisani nalog | R3 | DB, privremena pohrana izvoza | Da |
| DI-24 | Infrastrukturni i sigurnosni logovi | korisnici | IP, user agent, zahtjevi, greške pristupa | sigurnost i rad sustava | Sys | platform tim (ograničeno) | R2 | Supabase, hosting (ADR-0006) | Da |
| DI-25 | Podaci o greškama | korisnici (pseudonimno) | stack trace, uređaj/OS, verzija app — **bez PII** (scrubbing) | otklanjanje grešaka | Sys | platform tim | R2 | Mon | Da |
| DI-26 | Korisnička podrška | podnositelji upita | e-pošta, opis problema | podrška | osoba | platform tim / U | R2 (R3/R4 ako korisnik pošalje podatke o djetetu) | alat za podršku [otvoreno] | Da |
| DI-27 | Sigurnosne kopije | svi gore | kopija baze | oporavak | Sys | platform tim (ograničeno) | najviša razina sadržaja (R4) | Supabase (PITR) | Da |
| DI-28 | Bilješke s intervjua validacije | sudionici intervjua (djelatnici vrtića, roditelji) | ime/uloga sudionika, bilješke — **bez podataka o djeci** | razvoj proizvoda | sudionik | VrtićOS tim | R2 | [otvoreno — alat za bilješke] | Faza 1 |

**Napomena o DI-28:** ovdje je VrtićOS vrlo vjerojatno samostalni voditelj obrade (nije obrada po uputi vrtića) ⚖️ —
vidi pravila u [../product/validation-plan.md](../product/validation-plan.md) §6.

## 3. Izvan MVP-a (ne prikupljati)
| ID | Kategorija | Razlog |
|---|---|---|
| DI-F1 | Fotografije i mediji djece | MVP opseg; zahtijeva model privola (D-15) i Fazu 11 |
| DI-F2 | Privole | nema svrhe temeljene na privoli u MVP-u (D-15) |
| DI-F3 | Zdravlje, alergije, posebna prehrana, lijekovi | D-9; posebna kategorija (R5) |
| DI-F4 | Razvojne bilješke, procjene, opažanja o djetetu | Q-P13; mogući DPIA kriterij "evaluacija" |
| DI-F5 | OIB, datum rođenja, adresa djeteta | Q-P03 — dok vrtić i pravnik ne potvrde nužnost |
| DI-F6 | Vrsta odnosa skrbnika (roditelj/udomitelj/skrbnik po rješenju) | može otkriti obiteljske/socijalne okolnosti (R4); Q-P11 |
| DI-F7 | Biometrija, lokacija, analitika ponašanja | zabranjeno briefom / ADR-0007 |

## 4. Pitanja o rokovima čuvanja (⚖️ Q-P09 — odluku donosi voditelj obrade)
| ID | Pitanje |
|---|---|
| DI-01–03 | Koliko dugo nakon prestanka zadnjeg članstva račun ostaje? Briše li se račun automatski kad skrbnik nema više nijedno aktivno dijete? |
| DI-04 | Čuva li se povijest rasporeda kao dokaz tko je imao pristup djetetu — koliko dugo (veza s auditom)? |
| DI-05 | Neprihvaćene/istekle pozivnice — brisati nakon X dana? (prijedlog: kratko, npr. 30 dana) |
| DI-06, DI-24 | Rok auth i infrastrukturnih logova — ovisi o pružatelju i sigurnosnim potrebama. |
| DI-09–11, DI-13 | Što se čuva nakon ispisa djeteta i koliko? Je li dio evidencije propisan pravilnikom o pedagoškoj dokumentaciji ili arhivskim propisima (Q-P10)? |
| DI-12 | Ograničenja pristupa — čuvati koliko i odluka vrijedi + dokazni rok? |
| DI-14–16 | Dolasci i izostanci — postoji li zakonski rok (evidencija prisutnosti, financijska dokumentacija vrtića)? Ili samo tekuća + jedna godina? |
| DI-17, DI-18 | Obavijesti i dnevni pregledi — do kraja pedagoške godine + X? |
| DI-19 | Poruke — kratko (npr. kraj ped. godine) ili duže zbog dokaza komunikacije? |
| DI-22 | Audit — mora nadživjeti podatke na koje se odnosi? Koliko (prijedlog za raspravu: 1–3 godine)? |
| DI-23 | Evidencija zahtjeva ispitanika — dokaz ispunjavanja obveza; izvozi se brišu nakon preuzimanja/kratkog roka. |
| DI-27 | Rok sigurnosnih kopija (PITR prozor) i kako brisanje djeluje na kopije. |
| DI-28 | Bilješke s intervjua — prijedlog: do kraja Faze 4, zatim samo anonimizirani sažeci. |

## 5. Otvorena pitanja iz inventara
- Je li skrbniku potrebno prikazati ime djelatnika (DI-02) ili je dovoljna uloga ("odgojiteljica skupine")?
- Vidi li odgojitelj sve skrbnike djeteta ili samo one s pravom preuzimanja (DI-11)?
- Smije li tekst obavijesti spominjati dijete (DI-17)? Prijedlog: ne; upozorenje autoru.
- Koji alat se koristi za korisničku podršku i bilješke s intervjua i gdje su podaci (DI-26, DI-28)?
- Jesu li podaci o djelatnicima (rasporedi) obrada u svrhu radnog odnosa za koju vrtić treba zasebnu obavijest zaposlenicima? ⚖️
