# Parent Home — specifikacija dizajna za VrtićOS

- **Verzija:** 0.1
- **Datum:** 2026-11-11
- **Status:** specifikacija za Figma razradu i lokalni demo; nije odobrenje za produkciju
- **Platforma:** mobilna aplikacija React Native + Expo
- **Referentni ekran:** Roditelj/skrbnik → Početna
- **Izvor vizualnih pravila:** DESIGN.md i packages/tokens
- **Postojeći prototip:** design/prototype/mobile.html, sekcija „3. Roditelj / skrbnik”

Ovaj dokument razrađuje postojeći Parent Home prototip, ne mijenja brand smjer, arhitekturu ni odluke D-1…D-25. Figma datoteka nije mijenjana. Svi primjeri s imenima djece i vrtića moraju ostati sintetički.

## 1. Svrha ekrana

Parent Home treba roditelju u nekoliko sekundi odgovoriti na tri pitanja:

1. **Gdje je danas moje dijete?** Status dolaska/odlaska ili prijavljeni izostanak.
2. **Trebam li nešto napraviti?** Prijava izostanka, ako je roditelj za to ovlašten.
3. **Ima li nešto novo iz vrtića?** Objavljeni dnevni pregled i službene obavijesti.

Ekran nije analitička nadzorna ploča, društveni feed ni galerija. Prioritet su jasnoća, povjerenje i mali broj dodira.

### Usklađenost sa specifikacijom

- Prikazuje samo djecu s aktivnom i dopuštenom skrbničkom vezom; ograničenja pristupa imaju prednost.
- Roditelj može imati djecu u više vrtića. Početna prikazuje svako dijete odvojeno, uz vidljiv naziv njegova vrtića, kao u postojećem prototipu.
- Podaci različitih organizacija dohvaćaju se u zasebnom organizacijskom opsegu. UI ih može složiti u jedan popis, ali se ne uvodi međuvrtićni spoj podataka.
- Statusi dolazaka prikazuju se iz evidentiranih događaja i prijava izostanka; UI ne izračunava niti pretpostavlja status koji nije vraćen iz autoriziranog izvora.
- Prijava izostanka nema razlog ni slobodno tekstualno polje.
- Dnevni pregled je objavljeni pregled skupine, ne osobni dnevnik djeteta.
- Prikazuju se samo objavljene obavijesti i sadržaj za koji roditelj trenutačno ima pristup.
- Nema fotografija, zdravstvenih podataka, alergija, lijekova, razvojnih bilješki ni AI sadržaja.
- Push obavijesti ne sadrže ime djeteta, skupinu ni sadržaj. Ovaj ekran sadržaj dohvaća tek nakon autentikacije i RLS provjere.

## 2. Hijerarhija sadržaja

Redoslijed odozgo prema dolje:

1. Demo oznaka — samo u lokalnom demo/prototip okruženju.
2. Pozdrav i današnji datum.
3. Sekcija **Moja djeca** — kartice djece, svaka s vrtićem, skupinom i današnjim statusom.
4. Sekcija **Danas** — objavljeni dnevni pregledi i najnovije relevantne obavijesti.
5. Donja navigacija: Početna, Obavijesti, Poruke, Profil.

Ne dodavati zasebnu karticu s brojem ukupno prisutne djece, grafove, metrike, kalendar na početnoj, avatar/fotografiju djeteta ni generičke ikone u karticama.

### Sadržajna skica

    [Sigurna zona]
    [DEMO: izmišljeni podaci]                 samo demo
    Dobro jutro
    srijeda, 11. studenoga 2026.

    Moja djeca

    ┌──────────────────────────────────────┐
    │ Lana Babić                 [U vrtiću] │
    │ Skupina Galebovi · Objekt Maslina    │
    │ Vrtić Alfa                           │
    │ U vrtiću od 07:42                    │
    │ [Prijavi izostanak]                  │
    └──────────────────────────────────────┘

    ┌──────────────────────────────────────┐
    │ Petar Babić          [Javljen izostanak]
    │ Skupina Borovi · Objekt Centar       │
    │ Vrtić Beta                           │
    │ Izostanak 11.–13. studenoga          │
    │ [Pregledaj izostanak]                │
    └──────────────────────────────────────┘

    Danas
    ────────────────────────────────────────
    Dnevni pregled · Galebovi
    Objavljeno u 14:20                    ›

    Roditeljski sastanak u četvrtak   [Novo]
    Vrtić Alfa · danas u 09:10            ›

    [Početna] [Obavijesti] [Poruke] [Profil]
    [Donja sigurna zona]

Skica prikazuje hijerarhiju, ne konačne dimenzije. Kartice se ponavljaju vertikalno; ne koristiti horizontalni carousel za djecu.

## 3. Layout i dimenzije

### Referentni Figma frameovi

| Frame | Dimenzije | Namjena |
|---|---:|---|
| iPhone 16 | 393 × 852 | Primarni referentni dizajn |
| Android compact | 360 × 800 | Provjera uskog zaslona i Material konvencija |
| Tablet | 768 × 1024 | Prilagodba širem zaslonu |
| Large text | 393 × 852 | Provjera povećanja teksta na 130% i 200% |

Na mobilnim uređajima sadržaj je jedna kolona i vertikalno se pomiče. Donja navigacija ostaje izvan scroll sadržaja i poštuje sigurnu zonu uređaja.

### Geometrija za primarni frame

| Element | Pravilo |
|---|---|
| Horizontalni rub sadržaja | 16 px |
| Gornji razmak nakon sigurne zone | 8–12 px |
| Pozdrav | title1, 28/34 |
| Datum | footnote, 14/20; razmak od naslova 2–4 px |
| Razmak do „Moja djeca” | 24 px |
| Naslov sekcije | title3, 18/24 |
| Razmak naslov → prva kartica | 12 px |
| Razmak između kartica djece | 12 px |
| Unutarnji padding kartice | 16 px |
| Razmak elemenata u kartici | 8–12 px |
| Radius kartice | 14 px |
| Razmak do sekcije „Danas” | 24 px |
| Visina retka sadržaja | najmanje 64 px |
| Donja navigacija | 64 px + sistemska sigurna zona |

Kartica smije narasti po visini. Ne fiksirati visinu na račun punog imena, statusa ili većeg teksta. Na uskom zaslonu status se premješta ispod imena umjesto da se ime skraćuje.

## 4. Kartica djeteta

### Sadržaj i redoslijed

1. Puno ime djeteta — title3, 18/24, weight 600.
2. Status dana — tekst i ikona, nikad samo boja.
3. Skupina i objekt — footnote, 14/20.
4. Naziv vrtića — caption ili footnote, ovisno o duljini; obavezno kad roditelj ima djecu u više vrtića.
5. Radnja — ovisno o dozvoli i stanju izostanka.

Naziv djeteta ne skraćivati. Ne koristiti fotografiju, ilustrirani avatar, emoji ili piktogram djeteta. Kartica koristi bijelu površinu, tanki suptilni obrub i jednu razinu meke sjene.

### Varijante statusa

| Stanje | Tekst | Vizual |
|---|---|---|
| Očekuje se | Očekuje se | Bijela/surface, primarni tekst, kontrolni obrub |
| U vrtiću | U vrtiću od 07:42 | Zelena soft pozadina, zeleni tekst i kvačica |
| Otišlo | Otišlo u 15:10 | Neutralna kamena pozadina i sekundarni tekst |
| Javljen izostanak | Javljen izostanak; po potrebi raspon datuma | Oker pozadina, oker tekst, ikona kalendara |
| Nedostupan status | Status trenutačno nije dostupan | Neutralna informativna varijanta; bez nagađanja |

Vrijeme je u formatu 24 sata, vremenska zona Europe/Zagreb i tablične brojke. Status mora imati čitljiv tekst čak i ako se boje ne razlikuju.

### Radnja po kartici

- Ako skrbnik ima aktivno pravo can_report_absence i nema prijave izostanka koja već pokriva današnji dan: sekundarni gumb **Prijavi izostanak**.
- Ako postoji aktivna prijava koja pokriva današnji dan ili buduće dane: sekundarni gumb **Pregledaj izostanak**, koji vodi na postojeći pregled dolazaka/izostanaka djeteta. Otkazivanje budućih dana slijedi pravila FS-06.
- Ako skrbnik nema can_report_absence: ne prikazivati gumb niti objašnjavati razlog skrivanja.
- Ako je veza skrbništva ograničena ili neaktivna: dijete se ne prikazuje. Ne prikazivati zamjensku karticu koja bi otkrila da zapis postoji.

Gumb je visine 48 px, radius 10 px i puni širinu kartice. Koristiti sekundarni stil kako bi status ostao vizualno važniji od radnje. Jedan primarni gumb po ekranu nije potreban.

Kartica nije jedna velika pressable površina s gumbom u sebi. Gornji blok (ime + metapodaci + status) zasebno je dostupan kao poveznica na pregled djeteta; gumb za izostanak zasebna je kontrola. Time se izbjegavaju ugniježđene dodirne mete.

## 5. Sekcija „Danas”

Sekcija je jednostavan popis redaka, ne niz velikih kartica s ikonama.

### Dnevni pregled

- Naslov: **Dnevni pregled · Galebovi**
- Podnaslov: **Objavljeno u 14:20**
- Strelica na kraju retka.
- Prikazati samo ako postoji objavljeni dnevni pregled relevantne skupine.
- Dodir otvara postojeći ekran dnevnog pregleda za grupu i datum.
- Ne prikazivati nacrte, tekst koji nije objavljen ni osobne bilješke o djetetu.

### Obavijest

- Naslov obavijesti u jednoj ili dvije linije, bez rezanja smisla.
- Podnaslov: naziv vrtića/skupine i datum objave.
- Oznaka **Novo** samo ako aplikacija ima stvarno stanje nepročitanosti.
- Dodir otvara detalj obavijesti.
- Prikazati najviše dvije najnovije relevantne obavijesti na početnoj. Ostatak je u tabu Obavijesti.
- Publika se računa iz trenutnih odnosa; premještaj ili prestanak veze ne smije ostaviti stari pristup.

Ako nema dnevnog pregleda ni obavijesti, prikazati jednu mirnu poruku: **Za danas još nema novih objava.** Ne ostavljati prazan bijeli blok.

## 6. Navigacija i interakcije

### Donja navigacija

Četiri odredišta, redom:

1. Početna
2. Obavijesti
3. Poruke
4. Profil

Aktivna stavka koristi tekstAccent i jasnu oznaku aktivnog stanja. Ikona i tekst ostaju zajedno; ne koristiti samo ikone. Cilj dodira najmanje 44 pt na iOS-u i 48 dp na Androidu. Ne dodavati peti tab bez izmjene odobrene navigacijske specifikacije.

### Interakcije

| Element | Interakcija | Rezultat |
|---|---|---|
| Gornji blok kartice djeteta | Dodir | Pregled djeteta |
| Prijavi izostanak | Dodir | Obrazac FS-06 za to dijete |
| Pregledaj izostanak | Dodir | Pregled dolazaka/izostanaka djeteta |
| Redak dnevnog pregleda | Dodir | Objavljeni dnevni pregled skupine |
| Redak obavijesti | Dodir | Detalj obavijesti |
| Povlačenje sadržaja prema dolje | Pull to refresh | Ponovno dohvaćanje dostupnih podataka |
| Tab u donjoj navigaciji | Dodir | Prijelaz na pripadajući tab |

Prijava izostanka ne sprema se offline jer je offline red predviđen samo za mutacije evidencije dolazaka. Ako uređaj nema vezu, objasniti da je za slanje potrebna internetska veza; ne prikazivati lažnu potvrdu.

## 7. Responsive ponašanje

### Telefon: 320–599 px

- Jedna kolona.
- Rubovi 16 px; na izrazito uskom zaslonu mogu se smanjiti na 12 px samo ako je potrebno.
- Kartice djece jedna ispod druge.
- Status se smije prelomiti ispod imena.
- Gumbi su puni širine kartice.
- Donja navigacija ostaje pri dnu, s nazivima odredišta.

### Tablet: 600–959 px

- Sadržaj centrirati, maksimalna širina 720 px.
- Ako postoje najmanje dvije kartice djece i širina dopušta, kartice mogu biti u dvije kolone; sekcija „Danas” ostaje jedna kolona pune širine.
- Na Android tabletima primijeniti navigacijsku rail konvenciju iz DESIGN.md; na iPadu zadržati platformsku navigaciju koju koristi aplikacijski shell.
- Ne širiti tekst preko cijelog zaslona.

### Veliki zaslon i landscape

- Ograničiti širinu sadržaja na 720 px.
- Zadržati čitljiv vertikalni redoslijed.
- Scroll sadržaj ne smije ulaziti ispod navigacije.
- Pri Dynamic Type / velikom tekstu (130–200%) vratiti kartice u jednu kolonu i pustiti visinu sadržaja da raste.
- Nema horizontalnog scrolla, skraćivanja imena ni skrivanja statusa.

## 8. Stanja ekrana

### Učitavanje

- Zadržati pozdrav i datum ako su lokalno poznati.
- Prikazati dvije skeleton kartice istih vanjskih dimenzija kao stvarne kartice.
- Skeleton redaka „Danas” zadržava njihov raspored.
- Bez animiranog shimmera koji odvlači pažnju; blaga statična/suptilna animacija samo ako je već standardizirana.
- Poštovati reduced motion.

### Prazno — nema dostupne djece

Naslov: **Trenutačno nema podataka dostupnih za ovaj račun.**

Tekst: **Ako očekujete drugačiji prikaz, obratite se vrtiću.**

Ne koristiti tekst „Vaše dijete nije upisano” ili „Niste skrbnik” jer bi mogao otkriti ili pogrešno protumačiti stanje odnosa. Ne nuditi samostalno povezivanje djeteta.

### Prazno — nema novih objava

Tekst: **Za danas još nema novih objava.**

Kartice djece i njihovi statusi ostaju vidljivi.

### Pogreška učitavanja

Naslov: **Početnu nije moguće učitati.**

Tekst: **Provjerite vezu i pokušajte ponovno.**

Gumb: **Pokušaj ponovno**

Prikazati kratki correlation ID samo ako ga postojeći error envelope vraća. Ne prikazivati SQL, nazive tablica, identifikatore djece ni sadržaj odgovora.

Kod djelomične pogreške jednog organizacijskog dohvaćanja zadržati sigurno učitane podatke drugih organizacija i prikazati neutralnu poruku: **Neki podaci trenutačno nisu dostupni. Pokušajte ponovno.** Ne imenovati organizaciju ili dijete iz neuspjelog odgovora.

### Izvan mreže

Info banner na vrhu sadržaja:

**Nema internetske veze. Prikazujemo posljednje učitane podatke.**

- Prikazati samo podatke koji su već sigurno dostupni u memoriji.
- Sadržaj je samo za čitanje.
- Prijava izostanka ne može se poslati; gumb je onemogućen uz objašnjenje da je potrebna veza.
- Ne stvarati lokalni red za izostanke.
- Nakon odjave, promjene organizacije ili 401/403 očistiti predmemoriju prema postojećoj arhitekturi.

### Uspjeh nakon prijave izostanka

Snackbar: **Prijava izostanka poslana vrtiću.**

To potvrđuje samo zaprimanje, ne i obradu od strane vrtića. Ne prikazivati „Izostanak odobren”.

### Nedovoljan pristup

Koristiti neutralnu poruku **Sadržaj nije dostupan.** Ne potvrđivati postoji li traženi zapis. Ne nuditi ponovni pokušaj pristupa drugim ID-em.

## 9. Boje, tipografija i vizualni jezik

Ne uvoditi nove boje ili fontove za Parent Home. Koristiti postojeće semantičke tokene iz packages/tokens.

| Uloga | Postojeći token | Vrijednost |
|---|---|---|
| Pozadina ekrana | light.bgCanvas | #F6F5F1 |
| Površina kartice | light.bgSurface | #FFFFFF |
| Sekundarna površina | light.bgSunken | #EEECE6 |
| Primarni tekst | light.textPrimary | #22251F |
| Sekundarni tekst | light.textSecondary | #565A50 |
| Tercijarni tekst | light.textTertiary | #63665D |
| Primarna akcija | light.accent | #2B6E4D |
| Tekst na zelenoj | light.textOnAccent | #FFFFFF |
| Zelena statusna površina | light.statePresentBg | #E3F0E6 |
| Oker statusna površina | light.stateAbsentBg | #F6EBCF |
| Neutralni status odlaska | light.stateDepartedBg | #ECEAE4 |
| Suptilni obrub | light.borderSubtle | #DCD8CE |
| Obrub kontrole | light.borderControl | #857F72 |
| Pogreška | light.dangerBg / dangerFg | #F7E3DD / #9B3522 |
| Informacija | light.infoBg / infoFg | #E2ECF3 / #2E5470 |

### Tipografija

- Pozdrav: title1 28/34, 700.
- Ime djeteta i naslov kartice: title3 18/24, 600.
- Tekst i nazivi skupina: body 16/24 ili footnote 14/20.
- Gumbi: label 15/20, 600.
- Status i kratke oznake: caption 13/18, 500.
- Datum i vrijeme: tablične brojke.
- Mobilno koristiti sistemski font SF Pro / Roboto i podržati Dynamic Type; web koristi postojeći sistemski stack.

### Razmaci, radijusi i dubina

- Razmaci iz postojeće ljestvice: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Kartica: radius 14 px; gumb: 10 px; statusna oznaka: 6–12 px prema postojećim pravilima.
- Kartica koristi samo shadow.raised; bez tvrdih sjena, gradijenata, sjaja ili staklenih efekata.
- Pokreti: 120–200 ms za male povratne informacije; 320 ms samo za smislen prijelaz. Uz reduced motion promjena je trenutna.
- Tamna tema postoji kao tokeni, ali nije vizualno potvrđena na uređajima; ovaj Figma referentni ekran prvo razraditi u svijetloj temi.

## 10. Figma struktura

### Frameovi

U stranici Parent App dodati:

- Parent Home / iPhone 16 / Default
- Parent Home / Android 360 / Compact
- Parent Home / Tablet 768 / Default
- Parent Home / Loading
- Parent Home / Empty children
- Parent Home / Empty content
- Parent Home / Error
- Parent Home / Offline
- Parent Home / Partial error

U stranici Components dodati ili povezati:

- Mobile / Guardian / ChildSummaryCard
- Mobile / Guardian / AttendanceStatus
- Mobile / Shared / ContentRow
- Mobile / Shared / InlineBanner
- Mobile / Shared / EmptyState
- Mobile / Shared / Button
- Mobile / Guardian / BottomNavigation

### Auto Layout

- Screen: vertical, fill container, clip samo na okviru uređaja.
- Scroll content: vertical, gap 24 px između glavnih sekcija, horizontal padding 16 px.
- Children list: vertical, gap 12 px; na tabletu responsive grid s dvije kolone.
- Child card: vertical, padding 16 px, gap 8–12 px, width fill.
- Card header: horizontal, space-between, wrap allowed.
- Content row: horizontal, padding 12–16 px, min-height 64 px; naslov i meta u vertikalnom auto-layoutu.
- Tab bar: četiri jednake kolone, tekst i ikona centrirani.

### Komponentna svojstva

- ChildSummaryCard: status = expected / present / absent / departed / unavailable.
- ChildSummaryCard: action = report / review / hidden / disabled-offline.
- ContentRow: type = daily-report / announcement.
- ContentRow: readState = read / new (samo ako postoji stvarno stanje).
- InlineBanner: type = offline / info / error / success.
- EmptyState: type = no-children / no-content / load-error / unavailable.
- Button: style = primary / secondary / text; state = default / pressed / disabled / loading.

Komponente moraju koristiti varijante, ne kopije s ručno promijenjenim bojama. Imena i sadržaj ostaju tekstualna svojstva, ne ugrađeni u komponentu.

### Figma stilovi i varijable

Mapirati postojeće tokene u Figma Variables / Text Styles s istim semantičkim imenima:

- Color / Background / Canvas, Surface, Sunken
- Color / Text / Primary, Secondary, Tertiary, Accent
- Color / Status / Expected, Present, Departed, Absent
- Color / Feedback / Info, Warning, Danger, Success
- Space / 1, 2, 3, 4, 5, 6, 8, 10, 12, 16
- Radius / SM, MD, Tag, LG, Sheet
- Type / Title 1, Title 2, Title 3, Body, Body Strong, Label, Footnote, Caption
- Shadow / Raised, Overlay

Figma vrijednosti moraju odgovarati packages/tokens. Ne stvarati paralelnu paletu u Figmi.

## 11. Plan izvođenja tokena i komponenti

### Korak 1 — Provjera izvora

Prije dizajna provjeriti packages/tokens/src/palette.ts, theme.ts, scale.ts i css.ts. To je izvor vrijednosti; DESIGN.md opisuje njihovu uporabu. Ne prepisivati vrijednosti u novi paket.

### Korak 2 — Figma varijable

Uvesti postojeće semantičke boje, tipografiju, spacing, radius i shadow u Figma Variables / Styles. Provjeriti najmanje parove kontrasta koji su već definirani u contrast.test.ts. Figma ne smije postati drugi izvor istine.

### Korak 3 — Osnovne mobilne komponente

Izraditi redom:

1. Button
2. AttendanceStatus
3. ChildSummaryCard
4. ContentRow
5. InlineBanner
6. EmptyState
7. GuardianBottomNavigation

Sve komponente ostaju u mobilnoj aplikaciji. Ne dijeliti React Native komponente s Next.js adminom. Dijele se samo tokeni, i18n, validacija, tipovi i čista domenska logika.

### Korak 4 — Parent Home kompozicija

Složiti ekran iz komponenti, provjeriti redoslijed, vertikalni scroll, sigurnu zonu, više djece i više vrtića. U ovoj fazi koristiti samo sintetičke fixture podatke.

### Korak 5 — Stanja i pristupačnost

Izraditi sva stanja iz odjeljka 8. Testirati čitač zaslona, fokus, tekst 130–200%, kontrast i ciljeve dodira na iOS/Androidu.

### Korak 6 — Vizualna provjera

Usporediti Expo prikaz s Figma frameom na iPhone i Android dimenzijama. Impeccable koristiti za kritiku hijerarhije i kontrasta, ne kao automatski izvor odluka. UI UX Pro Max koristiti kao referencu za platformsku dosljednost, ne za zamjenu postojećeg brand sustava.

## 12. Implementacijski plan za Claude Code

Ovo je zadatak za UI/demo sloj, ne za novi backend modul. Claude Code mora prvo pregledati postojeći monorepo, stvarne rute i komponente. Putanja ispod je ciljna prema docs/architecture/mobile-app.md; prilagoditi je postojećoj strukturi umjesto stvaranja paralelnog stabla.

Predložena organizacija:

    apps/mobile/
      app/(app)/(guardian)/index.tsx
      src/features/guardian-home/
        GuardianHomeScreen.tsx
        components/
          ChildSummaryCard.tsx
          AttendanceStatus.tsx
          ContentRow.tsx
          InlineBanner.tsx
          EmptyState.tsx
        hooks/
          useGuardianHome.ts
        model/
          guardian-home.types.ts
          mapGuardianHome.ts

### Redoslijed zadataka

**P0 — Inspekcija bez izmjena**
- Pregledati postojeći app shell, guardian rute, bottom tabs, i18n način, tokens import, test runner i demo fixture.
- Provjeriti postoji li već komponenta statusa, gumba, banner-a ili empty statea; ne duplicirati.
- Potvrditi kako se označava demo okruženje i gdje se prikazuje demo banner.
- Ispisati kratak plan i popis datoteka koje će se mijenjati.

**P1 — View model i sintetički podaci**
- Definirati tipove za karticu djeteta i objavljeni sadržaj.
- Koristiti postojeći packages/test-fixtures; ako treba dopuna, dodati isključivo sintetičke zapise.
- Primjer modela kartice: childId, organizationId, childName, organizationName, locationName, groupName, attendanceStatus, recordedAt, absenceRange, canReportAbsence.
- Primjer sadržaja: id, organizationId, type, title, publishedAt, groupName/organizationName, isNew.
- Ne stvarati SQL tablice, migracije, Edge Functions ni nove integracije.

**P2 — Tokenizirane komponente**
- Sve boje, razmaci, tipografija, radijusi i sjene uzeti iz packages/tokens.
- Sav tekst ide kroz postojeći i18n paket, hrvatski je obvezan.
- Komponente moraju biti prezentacijske i dobivati podatke kroz props.
- Ne dodavati React DOM niti zajednički UI paket.

**P3 — Složiti ekran**
- Implementirati Parent Home prema redoslijedu iz odjeljka 2.
- Djecu iz više vrtića prikazati odvojeno, s nazivom organizacije na svakoj kartici.
- Podatke dohvaćati po organizacijskom opsegu; ako stvarni moduli još ne postoje, koristiti demo fixture, ne izmišljati API.
- Za navigaciju koristiti samo postojeće rute. Ne prikazivati aktivnu radnju koja vodi na nepostojeći ekran.

**P4 — Stanja**
- Implementirati loading, no children, no content, error, partial error, offline, success i unavailable.
- U offline stanju prijava izostanka nije dostupna i ne stavlja se u red čekanja.
- U demo okruženju uvijek prikazati oznaku „DEMO: izmišljeni podaci”.

**P5 — Testovi**
- Unit testovi za mapiranje statusa i datuma u Europe/Zagreb.
- Komponentni testovi za sve statusne varijante i prikaz/skrivanje radnje prema canReportAbsence.
- Testovi za loading, prazno, pogrešku, offline i povećani tekst.
- Test da kartica ne prikazuje dijete bez dopuštenog view modela.
- Provjeriti da logovi i error poruke ne sadrže ime djeteta ili sadržaj obavijesti.
- Pokrenuti lint, typecheck, Vitest i Expo export.

**P6 — Pregled**
- Priložiti screenshotove sintetičkog Parent Home ekrana na 393 px i 360 px.
- Usporediti ih s Figma frameom i DESIGN.md.
- Pokrenuti Impeccable critique i ručno razriješiti nalaze.
- Ažurirati docs/phase-status.md samo ako je stvarno dovršen dogovoreni opseg.
- Zaustaviti se i prijaviti datoteke, testove, screenshotove, odstupanja i preostale blokade.

### Granice opsega

- Ne mijenjati Supabase shemu, RLS, autorizacijske funkcije ni migracije.
- Ne stvarati staging ili produkcijske račune i ne deployati.
- Ne koristiti stvarne podatke, fotografije, e-poštu ni identifikatore djece.
- Ne implementirati poruke, obavijesti, dnevne preglede ili izostanke kao backend funkcije samo zato što ih Home prikazuje. UI koristi fixture dok odgovarajući moduli ne postoje.
- Ne uključivati analitiku, session replay ni telemetry sadržaja.
- Ne mijenjati Next.js admin; on koristi iste tokene, ali vlastite web komponente.

## 13. Kriteriji prihvaćanja Parent Home dizajna

- [ ] Na prvom pogledu jasno se vidi pozdrav, datum i sekcija Moja djeca.
- [ ] Svaka kartica jasno razlikuje dijete i njegov vrtić/skupinu.
- [ ] Prisutnost, očekivanje, odlazak i izostanak razumljivi su bez oslanjanja samo na boju.
- [ ] Radnja izostanka prikazuje se samo kada postoji dozvola; već prijavljeni izostanak vodi na pregled.
- [ ] Objavljeni dnevni pregled i obavijesti imaju jasnu hijerarhiju i ne prikazuju nacrte.
- [ ] Nema fotografija, zdravstvenih podataka, slobodnog teksta ni dječjih ilustracija.
- [ ] Telefon od 360 px nema horizontalni scroll ni skraćivanje imena.
- [ ] Tekst se može povećati do 200% bez gubitka radnji ili informacija.
- [ ] Dodirne mete zadovoljavaju iOS/Android ciljeve.
- [ ] Loading, empty, error, partial error, offline i success stanja su dizajnirana.
- [ ] Sve vrijednosti dolaze iz packages/tokens; nema paralelnih stilova.
- [ ] Demo koristi samo sintetičke podatke i vidljivu demo oznaku.

## 14. Ovisnosti i granica demo/MVP

Faza 4 i D0 su označene kao završene u docs/phase-status.md. Ovaj dokument precizira referentni ekran i priprema provedbu u lokalnom demu. Trenutačni D1 opseg je prijava, MFA uprave, pozivnice i struktura vrtića. Djeca/skrbnici, dolasci/izostanci i objavljeni sadržaj pripadaju kasnijim modulima.

Zato:
- Figma dizajn može prikazati cijeli Parent Home koristeći sintetičke podatke.
- Lokalni UI demo može koristiti fixture podatke i jasno označenu DEMO traku.
- Povezivanje s pravim podacima čeka implementaciju pripadajućih modula i njihove RLS testove.
- Ovaj dokument ne zaključava MVP i ne mijenja postojeće odluke ili pravne pretpostavke.
