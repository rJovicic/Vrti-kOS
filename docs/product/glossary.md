# Rječnik pojmova — VrtićOS

**Status:** nacrt Faze 1 (P1-1)  
**Verzija:** 0.1  
**Jezik proizvoda:** hrvatski; talijanski jezik planiran kasnije.  
**Pravilo:** hrvatski naziv je primarni naziv u sučelju i dokumentaciji proizvoda. Engleski identifikator služi za kod, bazu i API. Ovaj rječnik ne određuje pravni status pojma.

## Organizacija i ustroj

| Hrvatski pojam | Engleski pojam / identifikator | Značenje i pravila |
|---|---|---|
| Vrtić | Kindergarten / `organization` | Organizacija koja koristi VrtićOS. U sustavu je granica tenant izolacije. |
| Osnivač | Founder / `founding_authority` | Grad, općina ili druga pravna osoba koja je osnovala vrtić. Nije automatski korisnik niti administrator vrtića. |
| Objekt | Facility / `location` | Fizička lokacija unutar vrtića. Ne poistovjećuje se s organizacijom. |
| Pedagoška godina | School year / `school_year` | Vremenski okvir rada vrtića. Datumi i pravila prijelaza potvrđuju se s vrtićima. |
| Skupina | Group / `group` | Organizacijska skupina djece unutar objekta i pedagoške godine. |
| Članstvo | Membership / `membership` | Vremenski i statusno ograničena veza korisnika s vrtićem i njegovom ulogom. |
| Raspored djelatnika | Staff assignment / `staff_assignment` | Veza djelatnika sa skupinom ili objektom s datumom početka i završetka. |
| Zamjena | Substitute assignment / `substitute_assignment` | Privremeno dodijeljena uloga ili raspored; ne daje pristup izvan zadanog opsega i vremena. |

## Osobe i odnosi

| Hrvatski pojam | Engleski pojam / identifikator | Značenje i pravila |
|---|---|---|
| Korisnik | User / `user` | Osoba s korisničkim računom. Sam račun ne daje pristup podacima vrtića ili djece. |
| Profil korisnika | User profile / `user_profile` | Minimalni podaci potrebni za prikaz i povezivanje korisnika s organizacijama. |
| Dijete | Child / `child` | Dijete evidentirano u vrtiću. Podaci su posebno zaštićeni; pristup se ne izvodi iz same pripadnosti organizaciji. |
| Skrbnik | Guardian / `guardian` | Osoba koja ima potvrđen odnos s djetetom i određene dozvole. Izraz ne pretpostavlja automatski jednaka prava svih roditelja. |
| Skrbništvo | Guardianship / `guardianship` | Evidentirani odnos korisnika i djeteta, s opsegom dozvola, valjanošću i mogućim ograničenjima. Točan model potvrđuje pravnik/DPO i vrtić. |
| Ovlaštena osoba za preuzimanje | Authorized pickup person / `pickup_person` | Osoba koju vrtić smije pustiti da preuzme dijete. Ne mora imati korisnički račun. |
| Djelatnik | Staff member / `staff_member` | Zaposlenik ili suradnik vrtića. Pristup proizlazi iz aktivnog članstva i rasporeda, ne samo iz naziva radnog mjesta. |
| Stručni suradnik | Specialist / `specialist` | Npr. pedagog ili psiholog. Konkretne dozvole i pristup osjetljivim bilješkama nisu potvrđeni. |

## Evidencija i komunikacija

| Hrvatski pojam | Engleski pojam / identifikator | Značenje i pravila |
|---|---|---|
| Dolazak/odlazak | Attendance event / `attendance_event` | Događaj dolaska ili odlaska djeteta s vremenom i osobom koja ga je evidentirala. |
| Izostanak | Absence report / `absence_report` | Obavijest o planiranom ili nastalom izostanku. Ne smije postati slobodno polje za zdravstvene podatke bez odobrene svrhe. |
| Dnevni izvještaj | Daily report / `daily_report` | Sažetak dana namijenjen ovlaštenim skrbnicima; sadržaj i granularnost tek treba potvrditi. |
| Aktivnost | Activity / `activity` | Aktivnost skupine ili djeteta. Ne znači automatski razvojno opažanje ili procjenu. |
| Jelovnik | Menu / `menu` | Objavljeni plan obroka za objekt ili skupinu. Posebna prehrana može otkriti zdravstvene podatke i nije automatski dio MVP-a. |
| Obavijest | Announcement / `announcement` | Jednosmjerna informacija koju objavljuje ovlašteni djelatnik određenoj publici. |
| Razgovor | Conversation / `conversation` | Kontekst razmjene poruka s definiranim sudionicima i opsegom. Model 1:1 ili roditelj–tim skupine ostaje za validaciju. |
| Poruka | Message / `message` | Pojedinačna poruka u razgovoru. Pristup se provjerava za svakog sudionika i svaku operaciju. |
| Medijska datoteka | Media asset / `media_asset` | Fotografija ili druga datoteka pohranjena privatno. Prikaz zahtijeva provjeru dozvola i privola svih identificiranih/tagiranih djece. |
| Privola | Consent / `consent_record` | Evidencija odluke za određenu svrhu, verziju teksta i dijete. Povlačenje se bilježi kao novi događaj, ne prepisivanjem povijesti. |
| Događaj | Event / `event` | Događaj u kalendaru vrtića ili skupine. |

## Pristup, privatnost i tehnički pojmovi

| Hrvatski pojam | Engleski pojam / identifikator | Značenje i pravila |
|---|---|---|
| Uloga | Role / `role` | Skup dozvola u određenom organizacijskom opsegu. Uloga sama nije dovoljna za pristup konkretnom djetetu. |
| Dozvola | Permission / `permission` | Konkretna radnja nad resursom, npr. `attendance.read`. Zadano je odbijanje ako nije izričito dopušteno. |
| Opseg pristupa | Access scope / `scope` | Organizacija, objekt, skupina, dodijeljena djeca ili vlastito dijete, ovisno o ulozi i odnosu. |
| Ograničenje pristupa | Access restriction / `access_restricted` | Evidentirano ograničenje koje može suziti ili blokirati pristup. Ne zamjenjuje pravnu/sudsku dokumentaciju ni proceduru vrtića. |
| Voditelj obrade | Controller | Subjekt koji određuje svrhe i sredstva obrade za konkretan tok. Uloga se utvrđuje po svrsi, ne pretpostavlja globalno. |
| Izvršitelj obrade | Processor | Subjekt koji obrađuje podatke prema dokumentiranim uputama voditelja. Ugovorni i stvarni odnos treba pravno potvrditi. |
| Podizvršitelj | Subprocessor | Pružatelj kojeg izvršitelj angažira za dio obrade. Mora biti evidentiran i ugovorno pokriven. |
| Osobni podatak | Personal data | Informacija koja se odnosi na identificiranu ili identificirljivu osobu. |
| Podatak o zdravlju | Health data | Posebna kategorija osobnih podataka. Ne uključivati u MVP bez zasebne procjene i odobrenja. |
| RLS | Row Level Security / `RLS` | PostgreSQL kontrola pristupa redovima. Obvezna je za izložene tablice; nije zamjena za testiranje dozvola. |
| Tenant | Tenant / `organization` | Organizacija čiji su podaci logički izolirani od drugih organizacija. U korisničkom sučelju koristiti „vrtić”, ne „tenant”. |
| Revizijski zapis | Audit log / `audit_log` | Zaštićen zapis o važnoj radnji, akteru, vremenu i ishodu. Ne smije nepotrebno kopirati sadržaj osobnih podataka. |
| Sintetički podaci | Synthetic data | Umjetno generirani podaci bez stvarnih osoba; jedini dopušteni podaci u razvoju i testiranju. |

## Pravila uporabe rječnika

1. Ne koristiti „roditelj” kao sinonim za „skrbnik” u pravilima pristupa.
2. Ne koristiti „zaposlenik” kao dokaz da osoba smije vidjeti svu djecu u vrtiću.
3. Ne poistovjećivati objekt, skupinu i organizaciju.
4. Ne zaključivati dozvole iz skrivenih elemenata sučelja, naziva radnog mjesta ili korisničkih metapodataka.
5. Svaki novi pojam koji utječe na pristup, privatnost ili poslovni proces mora biti definiran prije implementacije.
6. Pravne definicije i uloge voditelja/izvršitelja potvrđuju se za svaki tok s DPO-om/pravnikom.
