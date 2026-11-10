# Kriteriji prihvaćanja MVP modula (Given / When / Then)

**Verzija:** 0.1 · **Datum:** 2026-11-10 · **Status:** nacrt; vrijedi uz [functional-specs.md](functional-specs.md).
Svaki kriterij navodi zahtjeve koje pokriva (`FR-…`). Kriteriji označeni **[NEG]** su negativni testovi
autorizacije — obvezni su prije implementacije modula i kasnije postaju pgTAP / e2e testovi.

## Sintetički testni svijet (jedini dopušteni podaci)
| Oznaka | Opis |
|---|---|
| Vrtić **Alfa**, Vrtić **Beta** | Dvije organizacije (tenanta) |
| Objekt **A1** (Alfa) · skupine **S1**, **S2** u pedagoškoj godini **PG-1** | |
| Djeca **D1**, **D2** (S1), **D3** (S2) u Alfi; **D9** u Beti | |
| Skrbnik **G1** (D1, sve zastavice), **G2** (D1, `can_view` = da, `can_report_absence` = ne), **G3** (D2), **G9** (D9 u Beti) | |
| Odgojitelj **E1** (raspored S1), **E2** (raspored S2), **E3** (zamjena na S1 samo dan T) | |
| **U1** = `org_admin` Alfe, **U9** = `org_admin` Bete, **P1** = `platform_admin` | |
| Ovlaštena osoba **O1** za D1 | |
| **T** = današnji lokalni datum vrtića | |

---

## FS-01 Pozivnice, prijava, sesije, račun
**AC-01-1 — Pozivnica za skrbnika** (FR-01-1, FR-01-2)
- **Given** U1 je unio skrbničku vezu G1 ↔ D1
- **When** U1 pošalje pozivnicu na e-poštu G1
- **Then** e-pošta sadrži naziv vrtića i jednokratni kod, a **ne** sadrži ime djeteta, naziv skupine ni druge osobne podatke
- **And** pozivnica ima rok valjanosti i u auditu postoji zapis "pozivnica kreirana"

**AC-01-2 — Iskorištena/istekla pozivnica** (FR-01-2)
- **Given** pozivnica je već prihvaćena ili joj je istekao rok
- **When** netko je pokuša ponovno iskoristiti
- **Then** prijava ne uspijeva s generičkom porukom i ne nastaje nova veza ni račun

**AC-01-3 — OTP ograničenje** (FR-01-3)
- **Given** korisnik je unio pogrešan OTP najveći dopušteni broj puta
- **When** pokuša ponovno
- **Then** daljnji pokušaji su privremeno blokirani, a odgovor ne otkriva postoji li račun za tu e-poštu

**AC-01-4 — Postojeći račun dobiva novo članstvo** (FR-01-4)
- **Given** G1 već ima račun u Alfi
- **When** Beta pošalje pozivnicu na istu e-poštu i G1 je prihvati
- **Then** G1 ima jedan račun s dva članstva, a u kontekstu Bete ne vidi ništa iz Alfe i obrnuto

**AC-01-5 — Obavijest o privatnosti** (FR-01-5)
- **Given** G1 se prvi put prijavljuje u Alfu
- **When** prijava uspije
- **Then** prikazuje se obavijest o privatnosti Alfe prije prvog prikaza podataka i bilježi se potvrda čitanja s verzijom teksta
- **And** potvrda nije zabilježena kao privola

**AC-01-6 — MFA za upravu** (FR-01-6)
- **Given** U1 nema postavljen TOTP
- **When** se prijavi
- **Then** ne može otvoriti nijedan ekran s podacima o djeci ili djelatnicima dok ne postavi MFA

**AC-01-7 [NEG] — Deaktivacija članstva odmah ukida pristup** (FR-01-8)
- **Given** E1 je prijavljen i ima valjan pristupni token
- **When** U1 deaktivira članstvo E1
- **Then** sljedeći zahtjev E1 za bilo koji podatak Alfe je odbijen, iako token još nije istekao

**AC-01-8 — Zahtjev za brisanje računa** (FR-01-9, FR-15-6)
- **Given** G3 je prijavljen
- **When** u postavkama odabere "Zatraži brisanje računa" i potvrdi
- **Then** nastaje zahtjev ispitanika u Alfi vidljiv U1, G3 dobiva potvrdu zaprimanja, a zapisi vrtića se ne brišu prije odluke prema retenciji

## FS-02 Struktura vrtića
**AC-02-1 — Platform admin kreira vrtić** (FR-02-1)
- **Given** P1 je prijavljen s MFA
- **When** kreira organizaciju Gama i pozove njezinog prvog administratora
- **Then** organizacija postoji, pozivnica je poslana i audit sadrži oba događaja

**AC-02-2 [NEG] — Platform admin ne vidi podatke djece** (FR-02-1, ADR-0005)
- **Given** P1 je prijavljen
- **When** pokuša čitati djecu, skupine, upise, dolaske ili članove Alfe kroz sučelje ili izravno kroz API
- **Then** svi zahtjevi vraćaju prazan rezultat/odbijenicu bez otkrivanja postojanja zapisa

**AC-02-3 — Jedna aktivna pedagoška godina** (FR-02-3)
- **Given** PG-1 je aktivna
- **When** U1 pokuša aktivirati PG-2
- **Then** sustav traži da se PG-1 prvo zatvori (ili ponudi zatvaranje) i ne dopušta dvije aktivne godine

**AC-02-4 — Kopiranje strukture bez djece** (FR-02-5)
- **Given** PG-1 ima skupine S1 i S2 s upisima
- **When** U1 kreira PG-2 i odabere "kopiraj strukturu skupina"
- **Then** PG-2 dobiva skupine istih naziva bez ijednog upisa i rasporeda

## FS-03 Djelatnici i rasporedi
**AC-03-1 [NEG] — Odgojitelj samo u svojoj skupini** (FR-03-4)
- **Given** E1 ima raspored samo na S1
- **When** E1 zatraži popis djece S2 ili podatke D3 (sučelje, API, pretraga, RPC)
- **Then** zahtjev je odbijen ili vraća prazan rezultat

**AC-03-2 — Zamjena vrijedi samo u svom razdoblju** (FR-03-3, FR-03-5)
- **Given** E3 ima zamjenu na S1 s `valid_from` = T i `valid_to` = T+1
- **When** E3 otvori aplikaciju na dan T
- **Then** vidi S1 i njezinu djecu
- **And when** E3 otvori aplikaciju na dan T+1 ili kasnije
- **Then** S1 i njezina djeca nisu vidljivi

**AC-03-3 — Zamjena zahtijeva kraj i odobrenje** (FR-03-3)
- **Given** U1 dodaje zamjenu
- **When** ne unese `valid_to`
- **Then** spremanje nije moguće; spremljena zamjena sadrži `approved_by` = U1 i zapis u auditu

**AC-03-4 [NEG] — Kraj rasporeda odmah ukida pristup** (FR-03-5)
- **Given** E1 je prijavljen s otvorenom skupinom S1
- **When** U1 završi raspored E1 s datumom danas
- **Then** sljedeći zahtjev E1 za podatke S1 je odbijen bez čekanja osvježavanja tokena; povijesni raspored ostaje vidljiv upravi

**AC-03-5 — Više rasporeda i organizacija** (FR-03-2, FR-03-6)
- **Given** E1 ima redovni raspored na S1 u Alfi i (sintetički) raspored u Beti
- **When** E1 otvori aplikaciju
- **Then** vidi skupine obiju organizacija odvojeno po kontekstu vrtića, a podaci se ne miješaju ni u jednom prikazu

## FS-04 Djeca, upisi, skrbništvo, preuzimanje
**AC-04-1 — Minimalni zapis djeteta** (FR-04-1)
- **Given** U1 kreira dijete
- **When** otvori obrazac
- **Then** obrazac sadrži samo ime, prezime i opcionalnu internu oznaku; ne postoje polja za OIB, datum rođenja, adresu, fotografiju ni zdravlje

**AC-04-2 [NEG] — Skrbnik ne vidi tuđe dijete** (FR-04-9)
- **Given** G1 je skrbnik samo za D1
- **When** G1 pokuša dohvatiti D2 ili D3 izravnim ID-om, pretragom, popisom skupine ili kroz obavijesti
- **Then** ne dobiva nikakav podatak o D2/D3 niti potvrdu da postoje, i ne vidi broj djece u skupini

**AC-04-3 [NEG] — Izolacija vrtića** (ADR-0004)
- **Given** U1 je `org_admin` Alfe, U9 je `org_admin` Bete
- **When** U1 pokuša čitati, mijenjati ili povezati (npr. upisati D9 u S1, povezati G9 s D1) bilo koji zapis Bete
- **Then** sve operacije su odbijene; ni kompozitni ključevi ne dopuštaju vezu zapisa dvaju vrtića

**AC-04-4 — Premještaj čuva povijest i mijenja pristup** (FR-04-2)
- **Given** D1 je u S1, E1 ima raspored na S1, E2 na S2
- **When** U1 premjesti D1 u S2 s datumom T
- **Then** od T E2 vidi D1, a E1 više ne vidi D1; dolasci D1 prije T ostaju u povijesti; audit bilježi premještaj

**AC-04-5 [NEG] — Ograničenje pristupa ima prednost** (FR-04-5, FR-04-6)
- **Given** G2 ima `can_view` za D1
- **When** U1 unese ograničenje "potpuna blokada" za G2 ↔ D1
- **Then** G2 odmah gubi pristup D1, obavijestima vezanim uz D1 i statusu dolaska; ne dobiva obavijest o razlogu; G1 ne vidi da ograničenje postoji; sustav ne sadrži tekst sudske odluke

**AC-04-6 — Zastavice skrbnika** (FR-04-4)
- **Given** G2 ima `can_report_absence` = ne
- **When** G2 pokuša prijaviti izostanak za D1 (sučelje ili API)
- **Then** prijava je odbijena, a G2 u sučelju ne vidi tu radnju

**AC-04-7 — Ovlaštena osoba bez računa** (FR-04-7, FR-04-8)
- **Given** U1 doda O1 kao ovlaštenu osobu za D1 do kraja PG-1
- **When** G1 otvori profil D1
- **Then** G1 vidi O1 u popisu (samo pregled), a G3 ne vidi O1

**AC-04-8 — Ispis djeteta** (FR-04-3)
- **Given** D2 je upisan u S1
- **When** U1 ispiše D2 s datumom T
- **Then** od T+1 E1 više ne vidi D2 u skupini, G3 vidi samo ono što retencijska pravila dopuštaju [otvoreno Q-P09], a zapisi D2 nisu obrisani prije isteka roka čuvanja

## FS-05 Dolasci i odlasci
**AC-05-1 — Brza evidencija** (FR-05-1, FR-05-2; NFR-PERF-02)
- **Given** S1 ima 20 sintetičke djece i E1 je u skupini
- **When** E1 evidentira dolazak sve djece jednim dodirom po djetetu
- **Then** svi dolasci su spremljeni s `recorded_by` = E1, a cijeli tok traje < 30 s u testu upotrebljivosti

**AC-05-2 — Idempotentnost** (FR-05-2, FR-05-8)
- **Given** isti unos dolaska je poslan dva puta s istim `idempotency_key`
- **When** poslužitelj obradi oba zahtjeva
- **Then** postoji točno jedan događaj dolaska

**AC-05-3 — Osoba predaje samo s popisa** (FR-05-3, FR-05-4)
- **Given** D1 ima skrbnike G1, G2 i ovlaštenu osobu O1
- **When** E1 evidentira odlazak D1 i otvori izbor osobe
- **Then** ponuđeni su samo G1, G2 (ako nisu ograničeni) i O1 te opcija "osoba nije na popisu — slijedi proceduru vrtića"; nema polja za slobodan unos

**AC-05-4 — Poništavanje i ispravak** (FR-05-5)
- **Given** E1 je evidentirao dolazak D2
- **When** E1 dodirne "poništi" unutar 10 s
- **Then** unos je poništen bez razloga
- **And given** je prošlo više od 10 s
- **When** E1 ispravi unos
- **Then** mora odabrati kategoriju razloga, izvorni događaj ostaje, nastaje korekcija i audit zapis

**AC-05-5 — Rad pri lošoj mreži** (FR-05-8)
- **Given** uređaj E1 nema vezu
- **When** E1 evidentira dolaske triju djece
- **Then** unosi su vidljivi kao "čeka slanje", a nakon povratka veze sinkroniziraju se bez duplikata
- **And when** se E1 odjavi prije sinkronizacije
- **Then** aplikacija upozorava da postoje neposlani unosi prije brisanja lokalnog reda

**AC-05-6 — Prikaz skrbniku** (FR-05-9)
- **Given** D1 je evidentiran kao prisutan u 7:42
- **When** G1 otvori aplikaciju
- **Then** vidi "U vrtiću od 7:42" bez imena djelatnika koji je unio podatak; G3 ne vidi ništa o D1

**AC-05-7 — Prijavljeni izostanak u popisu** (FR-05-7)
- **Given** G1 je prijavio izostanak D1 za dan T
- **When** E1 pokuša evidentirati dolazak D1 na dan T
- **Then** aplikacija traži potvrdu i nakon potvrde bilježi dolazak

**AC-05-8 — Bez skupnog označavanja i zaključani prošli dani** (FR-05-6, FR-05-10)
- **Given** E1 je u skupini S1
- **Then** ne postoji radnja "svi prisutni"
- **And when** E1 otvori evidenciju za dan prije isteka roka ispravka
- **Then** evidencija je samo za čitanje, a ispravak može napraviti samo uprava s razlogom

## FS-06 Prijava izostanka
**AC-06-1 — Prijava bez razloga** (FR-06-1, FR-06-2, FR-06-3)
- **Given** G1 ima `can_report_absence` za D1
- **When** odabere razdoblje T+1 do T+3 i pošalje
- **Then** obrazac nije imao polje razloga ni slobodnog teksta, G1 vidi potvrdu "poslano vrtiću", a E1 vidi izostanak D1 za ta tri dana

**AC-06-2 — Obavijest odgojiteljima bez osobnih podataka** (FR-06-5, FR-08-2)
- **Given** E1 ima raspored na S1 za T+1
- **When** G1 prijavi izostanak D1
- **Then** E1 dobiva push s generičkim tekstom ("Nova prijava izostanka"), bez imena djeteta i skupine; E2 ne dobiva obavijest

**AC-06-3 [NEG] — Prijava za tuđe dijete** (FR-06-1)
- **Given** G3 je skrbnik samo za D2
- **When** G3 pošalje prijavu izostanka za D1 izravno kroz API
- **Then** zahtjev je odbijen i ništa nije spremljeno

**AC-06-4 — Otkazivanje** (FR-06-4)
- **Given** postoji prijava za T+1 do T+3
- **When** G1 otkaže prijavu na dan T+2
- **Then** otkazuje se samo T+2 i T+3 (ili cijela prijava ako još nije počela), a povijest otkazivanja ostaje

**AC-06-5 — Prijava u ime skrbnika** (FR-06-7)
- **Given** G1 je telefonom javio izostanak
- **When** U1 evidentira izostanak za D1
- **Then** prijava ima izvor "unio djelatnik u ime skrbnika" i autora U1

**AC-06-6 — Vidljivost drugom skrbniku i kasna prijava** (FR-06-6, FR-06-8)
- **Given** G1 je prijavio izostanak D1, a rok za isti dan u Alfi je 8:00
- **When** G2 (s `can_view`) otvori profil D1
- **Then** vidi prijavu
- **And given** G1 prijavi izostanak za danas u 9:15
- **Then** prijava je zaprimljena s oznakom "kasna prijava"

## FS-07 Obavijesti vrtića
**AC-07-1 — Ciljana publika** (FR-07-1, FR-07-4)
- **Given** U1 objavi obavijest za skupinu S1, publika "skrbnici"
- **When** G1, G3 i G9 otvore obavijesti
- **Then** G1 (D1 u S1) i G3 (D2 u S1) vide obavijest, G9 ne vidi; E2 ne vidi

**AC-07-2 — Publika se računa iz trenutnih odnosa** (FR-07-4)
- **Given** obavijest za S1 objavljena je prije premještaja D1 u S2
- **When** G1 nakon premještaja otvori obavijesti
- **Then** obavijest za S1 više nije vidljiva G1 [pretpostavka — potvrditi u validaciji]

**AC-07-3 — Uređivanje nakon objave** (FR-07-3)
- **Given** obavijest je objavljena
- **When** U1 izmijeni tekst
- **Then** primatelji vide oznaku "uređeno", prethodna verzija je spremljena u povijest verzija obavijesti (vidljivu upravi), a audit sadrži zapis o izmjeni bez kopije teksta

**AC-07-4 — Push bez sadržaja** (FR-07-5, FR-08-2)
- **When** se obavijest objavi
- **Then** push sadrži samo generički tekst; automatizirani test payloada ne pronalazi naslov, tekst, naziv skupine ni ime

**AC-07-5 — Sadržaj obavijesti** (FR-07-2, FR-07-6)
- **When** U1 piše obavijest
- **Then** naslov je ograničen na 120 i tekst na 4.000 znakova, nema privitaka ni oznake "hitno", a prije objave prikazuje se upozorenje da se ne navode imena djece ni zdravstveni podaci

## FS-08 Push i obavijesti u aplikaciji
**AC-08-1 — Isključivanje vrste obavijesti** (FR-08-4)
- **Given** G1 je isključio push za obavijesti vrtića
- **When** U1 objavi obavijest
- **Then** G1 ne dobiva push, ali obavijest je vidljiva u centru obavijesti

**AC-08-2 — Tiho razdoblje** (FR-08-5)
- **Given** tiho razdoblje Alfe je 18:00–6:30
- **When** G1 prijavi izostanak u 21:00
- **Then** E1 ne dobiva push do 6:30, a prijava je odmah vidljiva u aplikaciji

**AC-08-3 — Odjava uklanja token** (FR-08-6)
- **When** G1 se odjavi na uređaju
- **Then** taj uređaj više ne prima push za G1

## FS-09 Revizijski zapis i administracija
**AC-09-1 — Sadržaj audit zapisa** (FR-09-1, FR-09-2)
- **Given** U1 promijeni zastavice skrbničke veze G2 ↔ D1
- **When** U1 otvori audit
- **Then** zapis sadrži aktera, ulogu, radnju, ID cilja, vrijeme i ishod, ali ne ime djeteta ni skrbnika kao kopiju teksta

**AC-09-2 [NEG] — Audit je nepromjenjiv** (FR-09-3)
- **When** bilo koji korisnik (uključujući U1 i P1) pokuša izmijeniti ili obrisati audit zapis kroz API
- **Then** operacija je odbijena

**AC-09-3 [NEG] — Audit samo vlastite organizacije** (FR-09-4)
- **When** U1 filtrira audit
- **Then** vidi samo zapise Alfe; zapisi Bete nisu dostupni ni izravnim ID-om

## FS-10 Dnevni pregled skupine (Should)
**AC-10-1 — Vidljivost** (FR-10-3)
- **Given** E1 objavi dnevni pregled S1 za T
- **Then** G1 i G3 ga vide; G2 ga vidi samo ako ima `can_view`; skrbnici djece iz S2 ga ne vide

**AC-10-2 [NEG] — Samo odgojitelj skupine** (FR-10-1)
- **When** E2 pokuša napisati dnevni pregled za S1
- **Then** zahtjev je odbijen

## FS-11 Razgovori (Should)
**AC-11-1 — Sudionici iz odnosa** (FR-11-1, FR-11-2)
- **Given** G1 ima `receives_messages`, G2 nema
- **When** G1 otvori razgovor o D1
- **Then** prikazano je da razgovor vide G1 i odgojitelji S1 (E1, i E3 na dan T); G2 ne vidi razgovor

**AC-11-2 [NEG] — Bivši odgojitelj gubi pristup** (FR-11-4)
- **Given** E3 je sudjelovao u razgovoru o D1 na dan T
- **When** E3 pokuša otvoriti razgovor na dan T+1
- **Then** pristup je odbijen

**AC-11-3 — Uprava ne čita razgovore do odluke** (FR-11-6)
- **When** U1 pokuša otvoriti razgovor o D1
- **Then** pristup sadržaju je odbijen dok Q-T16 nije odlučeno

## FS-12 Jelovnik (Should)
**AC-12-1 — Bez personalizacije** (FR-12-2, FR-12-3)
- **When** U1 unosi jelovnik
- **Then** može navesti opće alergene jela, ali ne postoji polje ni veza na pojedino dijete

## FS-13 Kalendar (Should)
**AC-13-1 — Publika kao kod obavijesti** (FR-13-1)
- **Given** događaj je objavljen za objekt A1
- **Then** vide ga skrbnici djece upisane u skupine objekta A1 i djelatnici s rasporedom u A1; G9 ga ne vidi

## FS-14 Pregled dolazaka (Should)
**AC-14-1 — Dnevni pregled uprave** (FR-14-1)
- **Given** u S1 su 2 djeteta evidentirana, 1 izostanak prijavljen
- **When** U1 otvori pregled za T
- **Then** vidi brojke po skupini i može otvoriti popis djece samo vlastite organizacije

**AC-14-2 — Nema izvoza** (FR-14-3)
- **Then** u MVP-u ne postoji radnja izvoza ni API krajnja točka za izvoz

## FS-15 Prava ispitanika i retencija
**AC-15-1 — Zahtjev pristupa** (FR-15-1, FR-15-2)
- **Given** G1 zatraži kopiju podataka
- **When** U1 evidentira zahtjev i pokrene izvoz za G1 i D1
- **Then** izvoz sadrži samo podatke Alfe o G1 i D1 (ne o G2 ni drugoj djeci), poveznica kratko vrijedi, a svi koraci su auditirani

**AC-15-2 — Retencija bez potvrđenih rokova blokira produkciju** (FR-15-4)
- **Given** organizacija nema potvrđene rokove čuvanja za sve kategorije iz inventara
- **Then** kontrolna lista spremnosti za produkciju (Faza 14) za tu organizaciju nije zadovoljena

**AC-15-3 — Retencijski posao** (FR-15-5)
- **Given** rok čuvanja za dolaske iznosi X i postoje sintetički zapisi stariji od X
- **When** se izvrši dnevni retencijski posao
- **Then** zapisi su obrisani/anonimizirani prema pravilu, a log posla sadrži samo broj zapisa

**AC-15-4 — Brisanje ne briše dokaze** (FR-15-3)
- **Given** zahtjev za brisanje podataka G3 je odobren u Alfi
- **When** se izvrši brisanje
- **Then** podaci G3 obrisani su ili anonimizirani prema pravilima retencije, audit zapisi ostaju (s ID-om, bez kopije sadržaja), a zapisi koje voditelj označi kao zakonski obvezne se zadržavaju ⚖️
