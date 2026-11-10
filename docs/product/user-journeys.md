# Korisnička putovanja — nacrt v0.1

**Status:** Faza 1 — radni nacrt, nije validiran s vrtićima.  
**Princip:** najkraći siguran put; svaka radnja mora biti razumljiva i izvediva bez posebne obuke.

## 1. Roditelj/skrbnik

### Prva aktivacija
1. Vrtić provjeri identitet skrbnika u vlastitom službenom procesu.
2. Ovlašteni djelatnik pokrene pozivnicu za točno određenu osobu i dijete.
3. Skrbnik zaprimi jednokratnu poveznicu/kod s ograničenim trajanjem.
4. Skrbnik potvrdi račun jednokratnim kodom poslanim e-poštom (ADR-0008, DD-06) i pročita obavijest o privatnosti vrtića; potvrda čitanja nije privola (FS-01).
5. Aplikacija prikaže samo dijete/djecu za koje postoji aktivna veza i dozvola.
6. Ako podaci nisu točni, korisnik vidi siguran kontakt vrtića, a ne mogućnost samostalnog preuzimanja tuđeg djeteta.

**Rubni slučajevi:** pozivnica poslana pogrešnoj osobi; već postojeći račun; dva skrbnika; više djece u različitim skupinama/vrtićima; istekla pozivnica; promjena skrbničkog statusa; sudsko ograničenje.

### Pregled dana
1. Roditelj otvori početni zaslon.
2. Odabere dijete ako ih ima više.
3. Vidi samo objavljene informacije dostupne njegovoj vezi: dnevni pregled, obavijesti, jelovnik i događaje.
4. Sadržaj koji nije objavljen ili za koji nema dozvolu nije dostupan ni preko izravne poveznice.

### Prijava izostanka
1. Roditelj odabere dijete i datum/razdoblje.
2. Unese minimalnu potrebnu informaciju; nema slobodnog polja za dijagnozu ili terapiju u MVP-u.
3. Pregleda i pošalje prijavu.
4. Dobije potvrdu zaprimanja, ne obećanje da je vrtić već obradio prijavu.
5. Ovlašteni djelatnik vidi prijavu u svojoj skupini i može je obraditi prema pravilima vrtića.

### Poruka
1. Roditelj ulazi u službeni razgovor s timom skupine/vrtića.
2. Aplikacija jasno prikazuje sudionike i očekivano radno vrijeme odgovora.
3. Poruka se šalje samo aktivnim sudionicima.
4. Nakon promjene skupine ili prestanka odnosa pristup se revidira; stari sudionik ne zadržava automatski pristup.

## 2. Odgojitelj

### Jutarnji dolazak skupine
1. Odgojitelj se prijavi na službeni ili osobni uređaj prema pravilima vrtića.
2. Aplikacija prikazuje aktivnu skupinu/e za trenutni raspored.
3. Odgojitelj odabere dijete i evidentira dolazak te po potrebi osobu koja ga je dovela.
4. Sustav sprječava dupli unos ili traži potvrdu za konflikt.
5. Evidencija je vremenski označena i auditirana.
6. Odgojitelj može ispraviti pogrešku samo ako mu pravila daju dozvolu; razlog se bilježi.

### Dnevni pregled
1. Odgojitelj otvori svoju skupinu.
2. Unosi samo polja koja je vrtić odobrio i koja su nužna.
3. Aplikacija prikazuje status nacrta/objave.
4. Objavljeni sadržaj postaje vidljiv samo ovlaštenim skrbnicima.
5. Zdravstvene i razvojne bilješke nisu dio generičkog dnevnog izvještaja.

### Zamjena
1. Ravnatelj/ovlašteni administrator dodjeljuje zamjenu s početkom i završetkom.
2. Odgojitelj vidi samo skupinu i djecu obuhvaćenu zamjenom.
3. Po isteku rasporeda pristup se ukida bez oslanjanja na osvježavanje JWT-a.

## 3. Ravnatelj / administrator

### Postavljanje pedagoške godine
1. Kreira novu pedagošku godinu i objekte/skupine.
2. Dodjeljuje djelatnike i vremenski ograničene rasporede.
3. Uvozi ili kreira djecu i upise kroz kontrolirani postupak.
4. Povezuje skrbnike nakon provjere identiteta izvan aplikacije ili integriranog odobrenog procesa.
5. Pregledava izvještaj o nepotpunim vezama, ali ne može zaobići ograničenja pristupa bez auditiranog postupka.

### Upravljanje promjenom
1. Ravnatelj premješta dijete ili završava raspored djelatnika.
2. Promjena ima efektivni datum i ostavlja povijest.
3. Pristup se računa iz aktivnih odnosa; stari djelatnik/skupina gubi pristup.
4. Sustav bilježi tko je i zašto promijenio odnos.

## 4. Neuspješni i hitni scenariji
- Aplikacija nije dostupna: vrtić nastavlja službeni rezervni postupak; aplikacija nije jedini kanal za hitne slučajeve.
- Nema interneta: lokalni unos samo za izričito odobrene funkcije, s idempotency ključem i vidljivim statusom sinkronizacije; puna offline baza nije MVP.
- Pogrešno povezano dijete: odmah blokirati pristup i pokrenuti proceduru ispravka/incidenta.
- Izgubljen uređaj: opoziv sesije i tokena, promjena vjerodajnica po potrebi.
- Spor oko skrbništva: vrtić aktivira internu proceduru; aplikacija ne odlučuje o pravnom statusu.

## 5. Mjerenje upotrebljivosti za prototip
- Odgojitelj evidentira dolazak skupine od 20 djece za manje od 30 sekundi u tipičnom toku.
- Roditelj prijavi izostanak bez više od 3 glavne interakcije, uz pregled prije slanja.
- Roditelj može pronaći današnju obavijest bez uputa.
- Korisnik razumije tko vidi poruku i fotografiju prije slanja/objave.

## 6. Otvoreno za validaciju
Učestalost i točan sadržaj dnevnog izvještaja, model poruka, način prijave izostanka, uređaji djelatnika, offline ponašanje, potvrde pročitanosti i način provjere skrbnika.