# Funkcionalne specifikacije MVP modula

**Verzija:** 0.1 (nacrt) · **Datum:** 2026-11-10 · **Status:** za validaciju; nije odobreno za implementaciju.
**Veze:** [prd.md](prd.md) · [acceptance-criteria.md](acceptance-criteria.md) · [roles-and-permissions.md](roles-and-permissions.md) ·
[domain-model.md](domain-model.md) · [business-rules.md](business-rules.md) · [../privacy/data-inventory.md](../privacy/data-inventory.md)

## Konvencije
- Zahtjevi: `FR-<modul>-<n>`. Kriteriji prihvaćanja: `AC-<modul>-<n>` u [acceptance-criteria.md](acceptance-criteria.md).
- **Dozvole** su ključevi iz kataloga ([roles-and-permissions.md](roles-and-permissions.md) §7). Svaka dozvola
  uvijek uključuje i relacijski uvjet (opseg); "Ogr." iz matrice znači da opseg mora proći.
- **Podaci** referenciraju retke inventara `DI-xx`.
- Oznake: **[pretpostavka A-xx]** (PRD §9), **[otvoreno Q-xx]**, **[DD-xx]** (pregled dosljednosti), ⚖️ pravno pitanje.
- Opća pravila za **sve** module (ne ponavljaju se):
  1. Svaka operacija provjerava aktivno članstvo, organizaciju i relacijski opseg na poslužitelju/bazi; skriveni UI nije kontrola.
  2. Nedopušten resurs ponaša se kao nepostojeći (bez otkrivanja postojanja; npr. isti odgovor kao "nije pronađeno").
  3. Svi zapisi nose `organization_id`; vremena u UTC, prikaz `Europe/Zagreb`, "dan" je lokalni datum vrtića.
  4. Sav tekst sučelja ide kroz i18n ključeve (hr; it kasnije).
  5. Svako stanje ekrana ima loading, empty, error, success i (gdje je relevantno) offline varijantu.
  6. Push i e-pošta ne sadrže imena djece, nazive skupina ni sadržaj (ADR-0007).
  7. Samo sintetički podaci u razvoju, testovima, demo računima i dizajnu.

## Pregled modula

| FS | Modul | Prioritet | Faza izvedbe | Glavni akteri |
|---|---|---|---|---|
| FS-01 | Pozivnice, prijava, sesije, račun | Must | 6 | svi |
| FS-02 | Struktura vrtića | Must | 6 | uprava, platform admin |
| FS-03 | Djelatnici i rasporedi | Must | 7 | uprava, odgojitelj |
| FS-04 | Djeca, upisi, skrbništvo, preuzimanje | Must | 7 | uprava, skrbnik |
| FS-05 | Dolasci i odlasci | Must | 8 | odgojitelj, skrbnik, uprava |
| FS-06 | Prijava izostanka | Must | 8 | skrbnik, odgojitelj |
| FS-07 | Obavijesti vrtića | Must | 10 | uprava, (odgojitelj), skrbnik |
| FS-08 | Push i obavijesti u aplikaciji | Must | 10 | svi |
| FS-09 | Revizijski zapis i osnovna administracija | Must | 6–12 | uprava, platform admin |
| FS-10 | Dnevni pregled skupine | Should | 9 | odgojitelj, skrbnik |
| FS-11 | Razgovori | Should | 10 | skrbnik, odgojitelj |
| FS-12 | Jelovnik | Should | 9 | uprava, svi |
| FS-13 | Kalendar događaja | Should | 9 | uprava, svi |
| FS-14 | Pregled dolazaka za upravu | Should | 12 | uprava |
| FS-15 | Prava ispitanika i retencija | Must (prije produkcije) | 12 | uprava, platform tim |

---

## FS-01 — Pozivnice, prijava, sesije, račun (Must)
**Svrha:** svaki račun nastaje iz provjerene veze vrtića s osobom; nitko se ne može sam povezati s djetetom.
**Akteri:** uprava (šalje pozivnice), skrbnik, odgojitelj, platform admin. **Ovisi o:** ADR-0008 (D-8), [DD-06].
**Dozvole:** `membership.manage` (pozivnice), vlastiti račun (bez ključa).
**Podaci:** DI-01, DI-02, DI-03, DI-05, DI-06.

| ID | Zahtjev |
|---|---|
| FR-01-1 | Uprava kreira pozivnicu za **konkretnu osobu i ulogu** u svojoj organizaciji; za skrbnika pozivnica referencira već unesenu skrbničku vezu (FS-04). |
| FR-01-2 | Pozivnica se šalje e-poštom; sadrži naziv vrtića i poveznicu/kod, **ne** ime djeteta. Vrijedi ograničeno (prijedlog 7 dana [otvoreno Q-T11]); jednokratna; može se opozvati i ponovno poslati. |
| FR-01-3 | Prijava e-poštom i jednokratnim kodom (OTP, 6 znamenki, kratko trajanje); ograničen broj pokušaja i zahtjeva po e-pošti i IP-u. |
| FR-01-4 | Ako e-pošta već ima račun, prihvaćanje pozivnice **dodaje članstvo** postojećem računu (jedan račun, više vrtića/uloga). |
| FR-01-5 | Pri prvoj prijavi u vrtić korisnik vidi obavijest o privatnosti **tog vrtića** (sadržaj daje vrtić ⚖️); potvrda čitanja se bilježi s verzijom teksta. To **nije privola**. |
| FR-01-6 | `org_admin`, `director` i `platform_admin` moraju postaviti TOTP MFA prije pristupa podacima; za odgojitelje MFA je [otvoreno Q-T03]. |
| FR-01-7 | Korisnik s više uloga/vrtića bira kontekst (vrtić; za mobilnu app način roditelj/odgojitelj); kontekst nije sigurnosna granica — autorizacija se računa po zahtjevu. |
| FR-01-8 | Korisnik vidi popis aktivnih sesija/uređaja i može ih odjaviti; uprava može deaktivirati članstvo (pristup prestaje odmah). |
| FR-01-9 | Korisnik može iz aplikacije **zatražiti brisanje računa** [N-21, Q-T10]; zahtjev ide u FS-15, ne briše odmah zapise vrtića koji podliježu retenciji. |
| FR-01-10 | Odjava i istek sesije brišu lokalne podatke iz predmemorije uređaja. |

**Rubni slučajevi:** pozivnica na pogrešnu e-poštu (opoziv + audit, FS-09); dva skrbnika s istom e-poštom (nije dopušteno — e-pošta je jedinstvena po računu); promjena e-pošte (samo uz ponovnu potvrdu); izgubljen pristup e-pošti (procedura vrtića [otvoreno Q-P05]).
**Izvan opsega:** samoregistracija, SMS, društvene prijave, eID (kasnije, Q-P05), lozinke za skrbnike.
**Audit:** pozivnica kreirana/opozvana/prihvaćena, MFA uključen/resetiran, članstvo deaktivirano.

## FS-02 — Struktura vrtića (Must)
**Svrha:** organizacija, objekti, pedagoška godina i skupine kao okvir za sve odnose.
**Dozvole:** platform admin: `organization.manage` (kreiranje); uprava: `location.manage`, `school_year.manage`, `group.manage`; svi članovi: `organization.read`, `group.read` (u opsegu).
**Podaci:** DI-08 (pretežno nisu osobni podaci).

| ID | Zahtjev |
|---|---|
| FR-02-1 | Platform admin kreira organizaciju (naziv, kontakt e-pošta vrtića, jezik, vremenska zona) i poziva prvog `org_admin`a. Ne vidi djecu, skupine ni članove osim pozvanog administratora. |
| FR-02-2 | Uprava kreira/uređuje/arhivira objekte (naziv, adresa objekta). |
| FR-02-3 | Uprava kreira pedagošku godinu s datumima početka/kraja; status `planirana` → `aktivna` → `zatvorena`. Najviše jedna aktivna godina po organizaciji [pretpostavka; otvoreno Q-T12]. |
| FR-02-4 | Skupina pripada objektu i pedagoškoj godini; ima naziv i opcionalni kapacitet. Arhiviranje skupine ne briše povijest. |
| FR-02-5 | Prijelaz u novu pedagošku godinu: uprava kreira nove skupine; sustav **ne** prenosi automatski upise ni rasporede — nudi pomoć "kopiraj strukturu skupina" bez djece [pretpostavka]. |

**Izvan opsega:** osnivač kao entitet [N-19], radno vrijeme po objektu, kalendar neradnih dana (FS-13 kasnije).

## FS-03 — Djelatnici i rasporedi (Must)
**Svrha:** pristup odgojitelja proizlazi isključivo iz važećeg rasporeda na skupinu.
**Dozvole:** `membership.manage`, `staff_assignment.manage` (uprava); odgojitelj čita vlastite rasporede.
**Podaci:** DI-02, DI-03, DI-04. **Odluke:** [DD-01], [DD-05].

| ID | Zahtjev |
|---|---|
| FR-03-1 | Uprava dodaje djelatnika (pozivnica FS-01) s ulogom `educator`, `director` ili `org_admin`. |
| FR-03-2 | Raspored (`staff_assignment`) veže djelatnika na skupinu s `valid_from`, opcionalnim `valid_to` i `assignment_type = regular`. |
| FR-03-3 | Zamjena = raspored s `assignment_type = substitute`, obveznim `valid_to` i `approved_by`; najkraće jedan dan. |
| FR-03-4 | Odgojitelj vidi samo skupine s rasporedom važećim **danas** (lokalni datum vrtića) i djecu aktivno upisanu u njih. |
| FR-03-5 | Završetak rasporeda ili članstva ukida pristup odmah (bez čekanja isteka tokena); povijest rasporeda ostaje. |
| FR-03-6 | Isti djelatnik može imati rasporede u više skupina i više organizacija (odvojena članstva). |

**Rubni slučajevi:** zamjena koja počinje u budućnosti (pristup tek od `valid_from`); djelatnik je ujedno skrbnik djeteta u istom vrtiću (oba konteksta postoje odvojeno; audit ne miješa uloge); preklapanje rasporeda je dopušteno.
**Izvan opsega:** smjene po satima, evidencija radnog vremena zaposlenika, uloge stručnih suradnika.
**Audit:** raspored kreiran/izmijenjen/završen, zamjena odobrena.

## FS-04 — Djeca, upisi, skrbništvo i preuzimanje (Must)
**Svrha:** minimalan zapis djeteta i provjerene veze koje određuju tko smije vidjeti dijete i tko ga smije preuzeti.
**Dozvole:** `child.read`, `child.manage`, `enrollment.manage`, `guardianship.read`, `guardianship.manage`, `pickup_person.read`, `pickup_person.manage`.
**Podaci:** DI-09, DI-10, DI-11, DI-12, DI-13. **Odluke:** [DD-02], [DD-03], [DD-08].

| ID | Zahtjev |
|---|---|
| FR-04-1 | Uprava kreira dijete s **minimalnim skupom**: ime, prezime, interna oznaka vrtića (opcionalno). Dodatna polja (datum rođenja, OIB, adresa, fotografija) **ne postoje u MVP-u** dok ih ne potvrdi Q-P03 ⚖️. |
| FR-04-2 | Upis veže dijete na skupinu s `valid_from`/`valid_to`; najviše jedan aktivan upis po djetetu u organizaciji [pretpostavka; business-rules]. Premještaj zatvara stari i otvara novi upis istog dana. |
| FR-04-3 | Ispis zatvara upis; dijete prelazi u status `ispisano`; daljnja obrada slijedi retenciju (FS-15). |
| FR-04-4 | Skrbnička veza: dijete ↔ osoba (s računom ili čeka pozivnicu) sa zastavicama `can_view`, `can_report_absence`, `receives_messages` i valjanošću. Jedno dijete može imati više skrbnika s različitim zastavicama. |
| FR-04-5 | **Ograničenje pristupa** (`access_restriction`) se unosi na skrbničku vezu s opsegom (potpuna blokada ili pojedine zastavice), valjanošću i internom referencom vrtića na dokument — **bez sadržaja sudske odluke ili razloga** u sustavu. Ograničenje ima prednost nad zastavicama i djeluje odmah. |
| FR-04-6 | Unos i promjenu ograničenja smije samo uprava; svaka promjena je auditirana; skrbnik ne vidi ograničenja drugih skrbnika. |
| FR-04-7 | Ovlaštena osoba za preuzimanje: ime, prezime, valjanost ovlaštenja po djetetu. Kontakt telefon i odnos prema djetetu **zasad se ne prikupljaju niti pohranjuju** (Q-T13 zatvoren, D-34). Ne mora imati račun. |
| FR-04-8 | Skrbnik vidi svoje dijete, njegovu trenutnu skupinu i objekt, te popis ovlaštenih osoba za preuzimanje tog djeteta (samo pregled). Popis odobrava i uređuje **isključivo uprava uz MFA**; skrbnik ne može sam dodavati, mijenjati ni brisati osobe (D-34). Prijedlog osobe od strane skrbnika moguća je buduća funkcionalnost izvan trenutačnog opsega; predložena osoba nema ovlaštenje dok je uprava izričito ne odobri. |
| FR-04-9 | Skrbnik **ne vidi** drugu djecu skupine, njihove skrbnike ni broj djece u skupini. |
| FR-04-10 | Unos djece i skrbnika moguć je ručno; **uvoz iz CSV-a** je Should [otvoreno Q-T04], uz validaciju i izvještaj grešaka bez slanja pozivnica automatski. |

**Rubni slučajevi:** dijete s dva upisa u dvije organizacije (dva odvojena zapisa djeteta — domenski model Q1); skrbnik s djecom u dva vrtića (jedan račun, dvije organizacije, bez spajanja podataka); udomiteljstvo i socijalna skrb [otvoreno Q-P11]; dijete bez ijednog aktivnog skrbnika (dopušteno, upozorenje upravi).
**Izvan opsega:** zdravstveni podaci, posebna prehrana, fotografija djeteta, bilješke o djetetu (D-9).
**Audit:** dijete kreirano/izmijenjeno/ispisano, upis/premještaj, skrbnička veza i zastavice, ograničenje, ovlaštena osoba.

## FS-05 — Dolasci i odlasci (Must)
**Svrha:** brza i točna evidencija tko je u vrtiću, s tragom tko je dijete predao/preuzeo.
**Dozvole:** `attendance.record`, `attendance.correct`, `attendance.read`. **Podaci:** DI-14, DI-15. **Odluke:** [DD-07].

| ID | Zahtjev |
|---|---|
| FR-05-1 | Odgojitelj otvara skupinu i vidi popis aktivno upisane djece za danas sa statusom: *očekuje se*, *prijavljen izostanak*, *u vrtiću*, *otišlo*. |
| FR-05-2 | Jedan dodir evidentira dolazak; drugi (na djetetu u statusu *u vrtiću*) odlazak. Svaki unos stvara `attendance_event` (`occurred_at`, `recorded_at`, `recorded_by`, `source`, `idempotency_key`). |
| FR-05-3 | Opcionalno se bilježi osoba predaje/preuzimanja **odabirom s popisa** aktivnih skrbnika i ovlaštenih osoba djeteta; nema slobodnog teksta. |
| FR-05-4 | Ako osoba koja preuzima dijete nije na popisu, aplikacija prikazuje uputu "slijedi proceduru vrtića" i **ne nudi** unos nove osobe. |
| FR-05-5 | Poništavanje unosa u roku od 10 sekundi ("poništi") bez razloga; kasniji ispravak traži kategoriju razloga i stvara korekciju (izvorni događaj ostaje). Rok i ovlast ispravka [otvoreno, matrica §9]. |
| FR-05-6 | Nema akcije "svi prisutni" u MVP-u [pretpostavka — točnost ispred brzine; validirati H-03]. |
| FR-05-7 | Prijavljeni izostanak (FS-06) vidljiv je u popisu; evidentiranje dolaska djeteta s prijavljenim izostankom traži potvrdu. |
| FR-05-8 | Pri lošoj mreži unosi idu u lokalni red čekanja s vidljivim statusom sinkronizacije; idempotentni su; red se briše pri odjavi. Konflikt (npr. dva odgojitelja) rješava se po `occurred_at` uz prikaz upozorenja. |
| FR-05-9 | Skrbnik vidi status svog djeteta za danas (*u vrtiću od 7:42*, *otišlo u 15:10*) **bez** imena osobe koja je evidentirala unos [pretpostavka; H-05 — želi li roditelj to uopće]. |
| FR-05-10 | Evidencija za prošle dane je samo za čitanje odgojitelju nakon isteka roka ispravka. |

**Rubni slučajevi:** dijete premješteno tijekom dana (dolazak ostaje vezan uz dijete i organizaciju, ne uz skupinu); zamjena počinje usred dana; dan bez rasporeda (odgojitelj ne vidi skupinu); dijete zaboravljeno odjaviti (uprava ispravlja sljedeći dan s razlogom).
**Izvan opsega:** QR/NFC prijava, samoprijava roditelja na ulazu, geolokacija, obračun naplate.
**Audit:** ispravci i poništenja nakon roka (obični unosi su sami po sebi događaji s akterom).

## FS-06 — Prijava izostanka (Must)
**Svrha:** jedan kanal za izostanke, vidljiv odgojiteljima skupine.
**Dozvole:** `absence.report` (skrbnik sa `can_report_absence`), `absence.read`, `absence.manage` (uprava). **Podaci:** DI-16.

| ID | Zahtjev |
|---|---|
| FR-06-1 | Skrbnik odabere dijete (ako ih ima više) i razdoblje (od–do, uključivo); najviše 30 dana unaprijed [pretpostavka, Q-T14]. |
| FR-06-2 | Prijava **nema polje razloga ni slobodnog teksta** u MVP-u [N-22, A-06, ⚖️ Q-P16]. |
| FR-06-3 | Prije slanja prikaz sažetka; nakon slanja potvrda "Prijava je poslana vrtiću" — ne "odobrena". |
| FR-06-4 | Skrbnik može otkazati prijavu za dane koji još nisu prošli; povijest ostaje. |
| FR-06-5 | Odgojitelji s rasporedom na skupinu djeteta u tom razdoblju i uprava vide prijavu; odgojitelji dobivaju push bez osobnih podataka (FS-08). |
| FR-06-6 | Drugi skrbnik istog djeteta vidi prijavu ako ima `can_view` [pretpostavka; Q-P11 za spornu skrb]. |
| FR-06-7 | Uprava može evidentirati izostanak u ime skrbnika (`source = staff_on_behalf`); odgojitelj [otvoreno — N-10, H-04]. |
| FR-06-8 | Rok za prijavu istog dana (npr. do 8:00 zbog prehrane) je postavka organizacije [otvoreno Q-T14]; prijava nakon roka je dopuštena uz oznaku "kasna prijava". |

**Izvan opsega:** liječničke potvrde, umanjenje cijene/naplata, kategorije bolesti.

## FS-07 — Obavijesti vrtića (Must)
**Svrha:** službene jednosmjerne obavijesti ciljanoj publici, umjesto privatnih grupa.
**Dozvole:** `announcement.publish` (uprava; odgojitelj za vlastitu skupinu [otvoreno, matrica ***]), `announcement.read`. **Podaci:** DI-17.

| ID | Zahtjev |
|---|---|
| FR-07-1 | Autor bira publiku: cijeli vrtić, objekt ili skupina(e); i ciljane uloge (skrbnici, djelatnici ili oboje). |
| FR-07-2 | Sadržaj: naslov (≤ 120 znakova) i tekst (≤ 4.000 znakova), bez privitaka u MVP-u. Upozorenje autoru da ne navodi imena djece ni zdravstvene informacije. |
| FR-07-3 | Statusi: nacrt → objavljeno → arhivirano. Izmjena nakon objave vidljiva je oznakom "uređeno"; prethodne verzije čuvaju se kao `announcement_revision` (ne u auditu — FR-09-2), a audit bilježi samo činjenicu izmjene. |
| FR-07-4 | Publika se računa **u trenutku čitanja** iz aktivnih odnosa: skrbnik vidi obavijest skupine samo dok je dijete u toj skupini; obavijesti prije početka veze nisu vidljive [pretpostavka]. |
| FR-07-5 | Objava šalje push bez sadržaja ("Nova obavijest vrtića") primateljima koji to nisu isključili (FS-08). |
| FR-07-6 | Označena "hitna" obavijest ne postoji u MVP-u — aplikacija nije kanal za hitne slučajeve (R-25). |

**Izvan opsega:** zakazana objava, potvrde pročitanosti [Q-T15], prilozi, komentari, ankete.

## FS-08 — Push i obavijesti u aplikaciji (Must)
**Svrha:** pravovremeno upozoriti na novi sadržaj bez curenja osobnih podataka.
**Dozvole:** vlastite postavke. **Podaci:** DI-07. **Odluke:** ADR-0007 (D-7).

| ID | Zahtjev |
|---|---|
| FR-08-1 | Događaji koji generiraju obavijest u MVP-u: nova obavijest (FS-07), nova prijava izostanka (odgojitelji skupine, FS-06), pozivnica (e-pošta). Should moduli dodaju svoje. |
| FR-08-2 | Push tekst je generički i ne sadrži ime djeteta, naziv skupine, ime pošiljatelja ni sadržaj; sadržaj se dohvaća nakon prijave i autorizacije. |
| FR-08-3 | Centar obavijesti u aplikaciji prikazuje popis događaja (sadržaj se učitava pod istom autorizacijom kao izvorni resurs). |
| FR-08-4 | Korisnik isključuje push po vrsti; e-pošta za pozivnice i sigurnost se ne može isključiti. |
| FR-08-5 | Tiho razdoblje za djelatnike (prijedlog 18:00–6:30, postavka organizacije) [otvoreno Q-T05]. |
| FR-08-6 | Isporuka kroz outbox s ponavljanjem; nevažeći tokeni se brišu; odjava uklanja token uređaja. |

## FS-09 — Revizijski zapis i osnovna administracija (Must)
**Svrha:** dokaz tko je što učinio s osjetljivim podacima; osnovni administratorski alati.
**Dozvole:** `audit.read` (uprava, samo vlastita organizacija), `membership.manage`. **Podaci:** DI-22.

| ID | Zahtjev |
|---|---|
| FR-09-1 | Auditiraju se najmanje: pozivnice, promjene članstava i uloga, MFA reset, rasporedi, dijete/upis/ispis, skrbničke veze, ograničenja, ovlaštene osobe, ispravci dolazaka, izvozi, zahtjevi ispitanika, promjene retencije, break-glass (ako ikad uveden). |
| FR-09-2 | Audit zapis: akter, uloga, organizacija, radnja, tip i ID cilja, vrijeme, ishod, korelacijski ID — **bez kopije sadržaja** osobnih podataka (npr. ne ime djeteta, nego ID). |
| FR-09-3 | Audit je samo za dodavanje (nema izmjene ni brisanja kroz aplikaciju); rok čuvanja [otvoreno Q-P09]. |
| FR-09-4 | Uprava pregledava audit vlastite organizacije s filtrima (razdoblje, akter, vrsta radnje). |
| FR-09-5 | Platform admin vidi samo audit radnji nad konfiguracijom organizacija; **break-glass nije u MVP-u** — podrška ide preko uprave vrtića [pretpostavka; Q-S06 za operativni pristup bazi]. |

## FS-10 — Dnevni pregled skupine (Should)
**Svrha:** roditelji znaju što je skupina radila danas, bez podataka o pojedinom djetetu. **Odluke:** [DD-04], [A-05].
**Dozvole:** `daily_report.write` (odgojitelj s rasporedom na skupinu), `daily_report.read`. **Podaci:** DI-18.

| ID | Zahtjev |
|---|---|
| FR-10-1 | Jedan pregled po skupini po danu: kratki tekst (≤ 1.000 znakova) i opcionalne oznake aktivnosti iz popisa organizacije. |
| FR-10-2 | Nacrt → objava; nakon objave izmjena uz oznaku "uređeno" isti dan. |
| FR-10-3 | Vide ga skrbnici djece upisane u skupinu **na taj dan** (s `can_view`) i uprava. |
| FR-10-4 | Upozorenje autoru: bez imena djece, zdravstvenih i razvojnih informacija; nema automatske analize teksta (bez AI). |
| FR-10-5 | Push skrbnicima je opcionalan i generički ("Novi dnevni pregled"). |

## FS-11 — Razgovori (Should; ovisi o D-10)
**Svrha:** službeni kanal skrbnik ↔ odgojitelji djeteta umjesto osobnih brojeva. **Odluke:** [A-07].
**Dozvole:** `conversation.read`, `conversation.send`, `conversation.manage` (uprava). **Podaci:** DI-19.

| ID | Zahtjev |
|---|---|
| FR-11-1 | Razgovor je vezan uz dijete. Sudionici se računaju iz aktivnih odnosa: skrbnici s `receives_messages` i odgojitelji s važećim rasporedom na skupinu djeteta. |
| FR-11-2 | Svaki prikaz razgovora navodi tko ga može vidjeti i očekivano vrijeme odgovora vrtića. |
| FR-11-3 | Samo tekst (≤ 2.000 znakova) u MVP-u; bez privitaka i fotografija. |
| FR-11-4 | Nakon premještaja/kraja rasporeda bivši odgojitelj gubi pristup cijelom razgovoru [pretpostavka; Q-T05 za povijest]. |
| FR-11-5 | Pošiljatelj može povući poruku 5 minuta nakon slanja (prikazuje se "poruka uklonjena"). |
| FR-11-6 | Pristup uprave sadržaju razgovora [otvoreno Q-T16 — privatnost vs. nadzor]; do odluke: uprava **ne** čita razgovore. |
| FR-11-7 | Push bez sadržaja ("Nova poruka"); tiho razdoblje za djelatnike vrijedi. |

## FS-12 — Jelovnik (Should)
**Dozvole:** `menu.publish` (uprava), `menu.read`. **Podaci:** DI-20.
| ID | Zahtjev |
|---|---|
| FR-12-1 | Tjedni jelovnik po objektu: po danu obroci (doručak, užina, ručak — popis obroka je postavka). |
| FR-12-2 | Uz jelo se mogu navesti **opće** oznake alergena jela (informacija o hrani, ne o djetetu). |
| FR-12-3 | Nema personalizacije po djetetu ni posebnih prehrana (D-9). |
| FR-12-4 | Vide ga članovi s vezom na objekt (skrbnici djece upisane u skupine objekta, djelatnici). |

## FS-13 — Kalendar događaja (Should)
**Dozvole:** `event.manage` (uprava), `event.read`. **Podaci:** DI-21.
| ID | Zahtjev |
|---|---|
| FR-13-1 | Događaj: naslov, opis, datum/vrijeme, publika (vrtić/objekt/skupina) — ista pravila publike kao FS-07. |
| FR-13-2 | Neradni dani vrtića mogu se označiti; ne utječu automatski na evidenciju u MVP-u. |
| FR-13-3 | Bez prijava na događaje i podsjetnika u MVP-u. |

## FS-14 — Pregled dolazaka za upravu (Should)
**Dozvole:** `report.read` (uprava). **Podaci:** agregati iz DI-14, DI-16.
| ID | Zahtjev |
|---|---|
| FR-14-1 | Danas: po skupini broj očekivane djece, prisutnih, prijavljenih izostanaka i neevidentiranih. |
| FR-14-2 | Mjesečni pregled po skupini (dani prisutnosti po djetetu) samo na ekranu. |
| FR-14-3 | **Izvoz nije u MVP-u**; kad se uvede (`report.export`), auditira se i daje kratkotrajnu poveznicu. |

## FS-15 — Prava ispitanika i retencija (Must prije produkcije)
**Svrha:** omogućiti vrtiću (pretpostavljenom voditelju ⚖️ Q-P01) da ispuni zahtjeve ispitanika i rokove čuvanja.
**Dozvole:** `dsr.manage`, `retention.manage` (uprava). **Podaci:** DI-23 i svi retci s rokom čuvanja.

| ID | Zahtjev |
|---|---|
| FR-15-1 | Uprava evidentira zahtjev ispitanika (vrsta: pristup, ispravak, brisanje, ograničenje, prigovor), rok i status; svi koraci auditirani. |
| FR-15-2 | Za zahtjev pristupa sustav generira strukturirani izvoz podataka o osobi/djetetu u opsegu organizacije (JSON + čitljiv PDF/HTML [otvoreno format]); poveznica kratkotrajna. U pilotu dopuštena **dokumentirana ručna procedura** platform tima na pisani nalog vrtića [pretpostavka]. |
| FR-15-3 | Brisanje/anonimizacija izvodi se po pravilima retencije, ne kaskadnim brisanjem; audit zapisi i zakonski obvezni zapisi se zadržavaju prema odluci voditelja ⚖️. |
| FR-15-4 | Rokovi čuvanja su **postavka organizacije po kategoriji podataka** (inventar DI-xx); VrtićOS predlaže zadane vrijednosti, vrtić ih potvrđuje ⚖️ Q-P09. Bez potvrđenih rokova nema produkcije. |
| FR-15-5 | Dnevni posao briše/anonimizira istekle zapise i bilježi broj obrađenih zapisa (bez sadržaja). |
| FR-15-6 | Zahtjev za brisanje računa (FR-01-9) stvara zahtjev u ovom modulu za svaku organizaciju korisnika. |
