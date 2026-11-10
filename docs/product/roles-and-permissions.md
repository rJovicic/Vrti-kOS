# Matrica uloga i dozvola — nacrt v0

**Status:** nacrt Faze 1 (P1-2), nije odobren za implementaciju. Usklađeno 2026-11-10 (`consistency-review.md`): dodani ključevi i retci za FS-02, FS-13, FS-15; odgojitelj i izostanak → Otvoreno.  
**Ovisi o:** `docs/product/glossary.md` (P1-1), razgovorima s vrtićima i pravnoj/DPO validaciji.  
**Temeljno pravilo:** deny by default. UI prikaz nije sigurnosna kontrola; svaka dozvola mora biti provedena na poslužitelju/bazi i testirana negativnim slučajevima.

## 1. Model autorizacije

Dozvola se ne određuje samo ulogom. Svaka odluka o pristupu mora zadovoljiti sve primjenjive uvjete:

- **Identitet:** aktivan i potvrđen korisnički račun.
- **Članstvo:** aktivno članstvo u ciljnoj organizaciji, unutar `valid_from` / `valid_to`.
- **Uloga:** uloga dopušta traženu radnju.
- **Opseg:** korisnik ima vezu s konkretnim objektom, skupinom, djetetom ili razgovorom.
- **Vremenska valjanost:** upis, raspored ili zamjena vrijedi u trenutku zahtjeva.
- **Ograničenja:** skrbnička/sudska ograničenja, povučene privole, status ispisa i druga blokiranja imaju prednost nad općim dozvolama.
- **Svrha i minimalnost:** pristup podacima mora biti nužan za konkretnu funkciju.

Prijedlog: `membership` nosi organizacijsku ulogu; dodatne veze (`staff_assignment`, `enrollment`, `guardianship`, sudionici razgovora i ovlaštene osobe) su zasebne relacije. Ne stavljati dinamične dozvole u dugotrajne JWT claimove.

## 2. Uloge i opseg

| Uloga | Opseg | Osnovno pravilo |
|---|---|---|
| `platform_admin` | Platforma | Upravljanje tehničkim postavkama organizacija bez rutinskog čitanja podataka djece. Privremeni break-glass samo uz opravdan razlog, vremensko ograničenje i revizijski zapis. |
| `org_admin` | Jedna organizacija | Administracija korisnika, objekata, skupina i postavki organizacije. Ne pretpostavlja automatsko pravo uređivanja stručnih ili osjetljivih zapisa. |
| `director` | Jedna organizacija | Operativni i upravljački pregled organizacije, izvještaji i objave. Razliku u odnosu na `org_admin` treba potvrditi. |
| `educator` | Trenutno dodijeljene skupine | Pristup samo djeci upisanoj u skupine za koje ima važeći raspored/zamjenu. |
| `staff_other` | Još nije definiran | Nema pristupa djeci po zadanim postavkama. Posebne funkcije (npr. jelovnik) dobivaju zasebne dozvole. |
| `guardian` | Povezana djeca | Pristup samo djeci za koju postoji važeća i potvrđena veza skrbništva, u granicama dozvola i ograničenja. |

**Napomena:** pedagog, psiholog, zdravstveni voditelj, kuhinja i administrativni djelatnici ne smiju se automatski svrstati u jednu široku ulogu. Potrebno je validirati stvarne zadatke i odvojene dozvole.

**MVP uloge (DD-05):** `platform_admin`, `org_admin`, `director`, `educator`, `guardian`. `staff_other` i stručni suradnici nemaju račune ni pristup u MVP-u. Prijedlog A-03: u MVP-u `org_admin` i `director` imaju isti skup dozvola dok intervjui ne potvrde razliku (Q-T09). Skrbnik ima i članstvo (`role = guardian`) i skrbničku vezu; bez veze nema pristupa djetetu (DD-08).

## 3. Legenda matrice

- **Da** — predloženo dopuštenje unutar opsega uloge i svih relacijskih uvjeta.
- **Ogr.** — dopušteno samo za vlastiti opseg ili eksplicitno dodijeljene resurse.
- **Ne** — zadano zabranjeno.
- **Otvoreno** — odluka zahtijeva validaciju; do tada tretirati kao **Ne**.

## 4. Matrica po funkcionalnom području

| Funkcionalno područje / radnja | Platform admin | Org admin | Ravnatelj | Odgojitelj | Ostali djelatnici | Skrbnik |
|---|---:|---:|---:|---:|---:|---:|
| Kreirati/konfigurirati organizaciju | Da | Ne | Ne | Ne | Ne | Ne |
| Pregledati sadržaj profila djeteta | Ne* | Ogr. | Ogr. | Ogr. | Ne | Ogr. |
| Kreirati/urediti osnovni zapis djeteta | Ne | Ogr. | Ogr. | Ne | Ne | Ne |
| Upravljati upisom i premještajem | Ne | Ogr. | Ogr. | Ne | Ne | Ne |
| Upravljati objektima i skupinama | Ne | Da | Ogr. | Ne | Ne | Ne |
| Upravljati članstvima i pozivnicama | Ne | Da | Ogr. | Ne | Ne | Ne |
| Dodijeliti raspored/zamjenu djelatniku | Ne | Ogr. | Da | Ne | Ne | Ne |
| Pregledati dolaske/odlaske | Ne* | Ogr. | Ogr. | Ogr. | Ne | Ogr. |
| Evidentirati dolazak/odlazak | Ne | Ogr. | Ogr. | Ogr. | Ne | Ne |
| Prijaviti izostanak | Ne | Ogr. | Ogr. | Otvoreno | Ne | Ogr. |
| Urediti/poništiti evidenciju dolaska | Ne | Ogr. | Ogr. | Ogr.** | Ne | Ne |
| Pisati dnevni pregled | Ne | Ogr. | Ogr. | Ogr. | Ne | Ne |
| Čitati dnevni pregled | Ne | Ogr. | Ogr. | Ogr. | Ne | Ogr. |
| Objaviti jelovnik | Ne | Ogr. | Ogr. | Ne | Otvoreno | Ne |
| Čitati jelovnik | Ne | Da | Da | Da | Ogr. | Da |
| Objaviti obavijest | Ne | Da | Da | Ogr.*** | Ne | Ne |
| Čitati obavijest | Ne | Ogr. | Ogr. | Ogr. | Ogr. | Ogr. |
| Slati/čitati poruke | Ne* | Ogr. | Ogr. | Ogr. | Ne | Ogr. |
| Dodavati/čitati fotografije | Ne* | Ogr. | Ogr. | Ogr. | Ne | Ogr. |
| Upravljati privolama | Ne | Ogr. | Ogr. | Ne | Ne | Ogr. |
| Upravljati osobama za preuzimanje | Ne | Ogr. | Ogr. | Ogr.**** | Ne | Ogr. |
| Upravljati kalendarom događaja | Ne | Da | Da | Ne | Ne | Ne |
| Čitati kalendar | Ne | Ogr. | Ogr. | Ogr. | Ne | Ogr. |
| Pregledati izvještaje organizacije | Ne | Da | Da | Ne | Ne | Ne |
| Upravljati zahtjevima ispitanika i retencijom | Ne* | Da | Da | Ne | Ne | Ne |
| Pregledati revizijske zapise | Ne* | Ogr. | Ogr. | Ne | Ne | Ne |
| Upravljati postavkama platforme | Da | Ne | Ne | Ne | Ne | Ne |

* Platform admin nema rutinski pristup sadržaju djece, porukama, fotografijama ili revizijskim detaljima; zahtjeve ispitanika izvršava samo na pisani nalog vrtića (FS-15). Break-glass je zaseban, vremenski ograničen i auditiran postupak, ne redovna dozvola.  
** Ispravak evidencije samo uz razlog, audit i pravila vrtića; opseg treba potvrditi.  
*** Odgojitelj samo za vlastitu skupinu, ako vrtić potvrdi potrebu.  
**** Odgojitelj može evidentirati provjeru preuzimanja, ali ne nužno samostalno mijenjati popis ovlaštenih osoba.

Ova je matrica namjerno konzervativna. Oznaka „Ogr.” nije samostalna dozvola: uvijek znači da dodatna provjera odnosa i opsega mora proći.

## 5. Relacijski uvjeti koji su obvezni

### Skrbnik → dijete
Pristup postoji samo ako:
- korisnik je potvrđeni skrbnik djeteta;
- veza je aktivna na datum zahtjeva;
- tražena dozvola postoji (npr. `can_view`, `can_report_absence`, `receives_messages`);
- ne postoji aktivno ograničenje pristupa;
- dijete i veza pripadaju istoj organizaciji/opsegu podataka.

Ne pretpostavljati da jedan skrbnik može mijenjati dozvole drugog skrbnika. Postupak za sudske odluke, udomiteljstvo i sporove mora definirati vrtić uz pravni savjet.

### Odgojitelj → skupina → dijete
Pristup postoji samo ako:
- djelatnik ima aktivno članstvo i važeći raspored ili zamjenu;
- raspored pokriva ciljnu skupinu i trenutni datum/vrijeme;
- dijete je aktivno upisano u tu skupinu u relevantnom razdoblju;
- tražena radnja pripada dozvolama odgojitelja.

Završetak zamjene ili premještaj djeteta mora odmah ukinuti pristup izvan novog opsega, bez čekanja osvježavanja JWT-a.

### Organizacija → podaci
Svaki red organizacijski vezanog podatka mora biti izoliran s `organization_id`, RLS-om i odgovarajućim relacijskim pravilima. Kompozitni strani ključevi sprječavaju povezivanje zapisa različitih organizacija.

## 6. Privole, mediji i osjetljivi podaci

- Privola je po djetetu, svrsi i verziji teksta; povlačenje se evidentira kao novi zapis.
- Fotografija s više djece može se prikazati samo ako su ispunjeni uvjeti za svako dijete koje se može identificirati.
- Skrbnik vidi samo medije dopuštene za njegovo dijete; ne smije dobiti metapodatke ili oznake druge djece.
- Zdravstveni podaci, alergije, lijekovi i posebne prehrane ostaju izvan MVP-a dok se ne odobre svrha, pravna osnova, pristup, retencija i DPIA.
- Slobodna tekstualna polja ne smiju biti prečac za prikupljanje zdravstvenih ili razvojnih podataka.

## 7. Predloženi permission ključevi

Ključevi su kandidati za stabilni katalog dozvola, ne konačni API ugovor.

| Permission key | Resurs | Radnja |
|---|---|---|
| `organization.read` | Organizacija | Čitanje osnovnih podataka |
| `location.read` / `location.manage` | Objekt | Pregled / upravljanje objektima |
| `school_year.manage` | Pedagoška godina | Kreiranje, aktivacija, zatvaranje |
| `organization.manage` | Organizacija | Upravljanje postavkama |
| `membership.read` / `membership.manage` | Članstvo | Pregled / upravljanje članstvima |
| `group.read` / `group.manage` | Skupina | Pregled / upravljanje skupinama |
| `staff_assignment.manage` | Raspored | Dodjela / završetak rasporeda |
| `child.read` / `child.manage` | Dijete | Pregled / upravljanje osnovnim zapisom |
| `enrollment.manage` | Upis | Upis, premještaj, ispis |
| `guardianship.read` / `guardianship.manage` | Skrbništvo | Pregled / administracija veze |
| `pickup_person.read` / `pickup_person.manage` | Preuzimanje | Pregled / upravljanje ovlaštenim osobama |
| `attendance.read` / `attendance.record` / `attendance.correct` | Dolasci | Pregled / evidentiranje / ispravak |
| `absence.read` / `absence.report` / `absence.manage` | Izostanci | Pregled / prijava / administracija |
| `daily_report.read` / `daily_report.write` | Dnevni pregled | Čitanje / pisanje |
| `menu.read` / `menu.publish` | Jelovnik | Čitanje / objava |
| `announcement.read` / `announcement.publish` | Obavijest | Čitanje / objava |
| `conversation.read` / `conversation.send` / `conversation.manage` | Razgovor | Čitanje / slanje / upravljanje |
| `media.read` / `media.upload` / `media.delete` | Medij | Čitanje / upload / brisanje |
| `consent.read` / `consent.record` / `consent.withdraw` | Privola | Pregled / bilježenje / povlačenje |
| `report.read` / `report.export` | Izvještaj | Pregled / izvoz |
| `audit.read` | Revizija | Pregled revizijskih zapisa |
| `event.read` / `event.manage` | Kalendar | Pregled / upravljanje događajima |
| `dsr.manage` | Zahtjevi ispitanika | Evidencija i izvršenje zahtjeva |
| `retention.manage` | Retencija | Postavljanje rokova čuvanja (odluka voditelja ⚖️) |

Svaki ključ treba imati: opis, vlasnika, dopuštene uloge, relacijski uvjet, organizacijski opseg, osjetljivost, audit zahtjev i testne scenarije.

## 8. Obvezni negativni testovi prije implementacije

1. Skrbnik A ne može pročitati, izmijeniti, pretražiti, izvesti ili zaključiti postojanje djeteta B.
2. Skrbnik ne može pristupiti djetetu nakon prestanka veze ili uz aktivno ograničenje.
3. Odgojitelj ne može pristupiti djetetu izvan dodijeljene skupine.
4. Odgojitelj gubi pristup odmah po završetku zamjene ili rasporeda.
5. Korisnik organizacije A ne može čitati ili povezati zapis organizacije B.
6. Org admin ne može pristupiti drugoj organizaciji samo zato što ima istu ulogu.
7. Platform admin ne može rutinski čitati sadržaj djece.
8. Skrbnik bez odgovarajuće privole ne može otvoriti fotografiju; grupna fotografija provjerava svu prikazanu djecu.
9. Povučena privola blokira buduću obradu/prikaz u skladu s definiranim pravilima, bez brisanja audit povijesti.
10. Neautentificirani i deaktivirani korisnici nemaju pristup.
11. Promjena organizacije, skupine ili uloge ne smije ostaviti stari pristup kroz zastarjeli token.
12. Direktni API, Storage, Realtime, RPC, izvoz i pretraga provode ista pravila kao sučelje.

## 9. Otvorene odluke za validaciju

| Pitanje | Potrebna potvrda |
|---|---|
| Razlika `org_admin` i `director` | Vlasnik + ravnatelj |
| Uloge pedagoga, psihologa, zdravstvenog voditelja i kuhinje | Vrtić + DPO |
| Tko smije ispravljati dolaske i u kojem roku | Odgojitelji + ravnatelj |
| Tko smije objavljivati obavijesti | Ravnatelj + odgojitelji |
| Model razgovora i sudionici | Roditelji + odgojitelji |
| Upravljanje skrbničkim vezama i sudskim ograničenjima | Vrtić + DPO/pravnik |
| Posebna prehrana i zdravstveni podaci | Vrtić + DPO/pravnik |
| Pristup nakon ispisa djeteta | Vrtić + DPO/pravnik |
| Break-glass podrška platforme | Vlasnik + DPO |
| Opseg izvještaja i izvoza | Ravnatelj + DPO |

## 10. Kriterij prihvaćanja P1-2

- Svaka MVP radnja ima imenovanog korisnika, dozvolu, opseg i relacijski uvjet.
- Sve oznake „Otvoreno” imaju vlasnika i plan validacije.
- Ravnatelj/odgojitelj i DPO pregledali su dijelove koji se odnose na njihove odgovornosti.
- Matrica je jedini izvor istine za kasnije RLS i API testove.
- Nema implementacije autorizacije dok matrica ne bude odobrena.
