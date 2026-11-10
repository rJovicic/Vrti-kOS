# Poslovna pravila i rubni slučajevi — nacrt v0.1

**Status:** prijedlog za validaciju; nije pravni ni operativni pravilnik vrtića.

## Organizacija i vrijeme
1. Svaki zapis koji pripada vrtiću ima nepromjenjivu vezu s `organization_id`.
2. Objekt pripada jednoj organizaciji; skupina pripada organizaciji, objektu i pedagoškoj godini.
3. Pedagoška godina ima eksplicitne datume početka/kraja i status.
4. Upisi, članstva, skrbničke veze i rasporedi imaju vremensku valjanost.
5. Promjene se ne modeliraju destruktivnim prepisivanjem povijesti ako su potrebne za audit ili dokazivanje pristupa.
6. Vremenske zone pohranjuju se dosljedno (UTC u bazi, prikaz Europe/Zagreb); lokalni datumi poput dana prisutnosti imaju jasno definiranu semantiku.

## Dijete i upis
1. Dijete je zaseban zapis od upisa; jedno dijete može imati više povijesnih upisa.
2. Aktivni upis određuje skupinu u određenom razdoblju.
3. Ne smije postojati preklapanje aktivnih upisa u istom opsegu ako ga vrtić nije izričito dopustio.
4. Premještaj zatvara stari upis i stvara novi; povijest ostaje.
5. Ispis ne znači automatsko trenutno brisanje svih zapisa; retencija ovisi o svrsi i pravnoj obvezi, što određuje voditelj uz pravni savjet.
6. U MVP-u prikuplja se samo minimalni identifikacijski skup koji vrtić potvrdi; OIB, adresa i datum rođenja nisu pretpostavljeni.

## Skrbništvo i preuzimanje
1. Skrbnička veza i ovlaštenje za preuzimanje dvije su različite relacije.
2. Skrbnik može imati različite dozvole; ne pretpostavljati da svaki skrbnik može vidjeti, slati poruke, prijaviti izostanak ili upravljati privolama.
3. Aplikacija ne utvrđuje sudsko skrbništvo. Ovlašteni djelatnik vrtića unosi odluku prema provjerenoj dokumentaciji i proceduri.
4. Ograničenje pristupa ima prednost nad općom dozvolom.
5. Ovlaštena osoba za preuzimanje može biti bez računa; pohranjuju se samo nužni podaci.
6. Evidencija preuzimanja treba potvrditi identitet prema proceduri vrtića; aplikacija ne zamjenjuje fizičku provjeru.

## Djelatnici
1. Djelatnik ima aktivno članstvo u organizaciji i jedan ili više vremenski ograničenih rasporeda.
2. Zamjena mora imati početak, kraj, opseg i osobu koja ju je odobrila.
3. Završetak zaposlenja/članstva ili rasporeda odmah uklanja pristup izvan preostalih aktivnih veza.
4. Djelatnik ne dobiva pristup svim skupinama samo zato što radi u organizaciji.
5. Posebne uloge (pedagog, psiholog, zdravstveni voditelj, kuhinja, administracija) ne dobivaju pristup dok se ne definiraju zasebne dozvole.

## Dolasci i izostanci
1. Evidencija dolaska/odlaska je događaj, ne samo promjenjivo polje statusa.
2. Svaki događaj bilježi vrijeme, dijete, organizaciju, aktera, izvor i eventualni razlog ispravka.
3. Dupli zahtjevi moraju biti idempotentni.
4. Ispravak ne briše izvorni događaj; stvara korekciju s razlogom i audit zapisom.
5. Prijava izostanka u MVP-u sadrži samo datum/razdoblje, bez razloga i slobodnog teksta (FS-06; razlog "bolest" mogao bi biti zdravstveni podatak — ⚖️ Q-P16).
6. U MVP-u ne tražiti dijagnozu, simptome, lijekove ili druge zdravstvene detalje u slobodnom tekstu.
7. Aplikacija ne smije biti jedini kanal za obavještavanje u hitnim situacijama.

## Dnevni sadržaj i komunikacija
1. Dnevni izvještaj mora imati definiranu publiku, svrhu, autora, status nacrta/objave i rok čuvanja.
2. Ne uvoditi ocjene, razvojne profile ili slobodne stručne bilješke bez zasebne procjene.
3. Poruke imaju jasno navedene sudionike i radno vrijeme odgovora.
4. Pristup razgovoru ovisi o aktivnoj vezi s djetetom/skupinom i pravilima nakon premještaja/ispisa.
5. Obavijest je odvojena od privatne poruke i ima eksplicitnu ciljnu publiku.
6. Jelovnik je informacija; personalizirana prehrana/alergeni mogu otkriti zdravstvene podatke i zahtijevaju zasebnu odluku.

## Fotografije i privole
0. Fotografije i mediji su **izvan MVP-a** (mvp-scope). Pravila niže vrijede kad uđu u opseg (Faza 11, D-15).
1. Fotografije se ne objavljuju javno.
2. Svaka fotografija ima organizaciju, autora, svrhu, datum i poveznice na prikazanu djecu samo ako je nužno.
3. Prikaz grupne fotografije zahtijeva provjeru pravila za svako identificirano dijete.
4. Privola se ne koristi kao univerzalna pravna osnova za sve funkcije aplikacije.
5. Privola je specifična za svrhu, verziju teksta, dijete i osobu koja ju je dala; povlačenje se bilježi.
6. Točan pravni temelj za fotografije i interni prikaz potvrđuje pravnik/DPO.

## Obavijesti i sigurnost
1. Push payload ne sadrži ime djeteta, skupinu, sadržaj poruke, fotografiju ni zdravstvene podatke.
2. Sadržaj se dohvaća tek nakon autentikacije i autorizacije.
3. Sve tenant operacije moraju provjeriti organizaciju i relacijski opseg.
4. Izvoz, break-glass, promjene skrbništva, ispravci dolazaka i promjene dozvola su auditirani.
5. Greške i telemetrija ne sadrže osobne podatke ni sadržaj poruka.
6. Sve nejasne dozvole tretiraju se kao zabranjene dok se ne potvrde.

## Otvorene odluke
- Pravila za dnevni izvještaj, poruke, potvrdu pročitanosti, izostanke i jelovnike.
- Pravila preuzimanja i dokazivanja identiteta.
- Rokovi čuvanja i arhivska klasifikacija.
- Pravna osnova i uloga voditelja/izvršitelja po pojedinom toku.