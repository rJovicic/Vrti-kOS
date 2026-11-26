# Testni plan: stvarni iPhone Safari (staging web) — pre-pilot

Stanje: **pripremljeno 2026-11-26, nije izvedeno.** Izvodi vlasnik na fizičkom iPhoneu; operater (Claude sesija) daje
kodove za prijavu i prati tragove. Rezultati se upisuju u [pre-pilot-findings.md](pre-pilot-findings.md).
Okruženje: samo staging i izmišljeni podaci. Nativni protokol (Expo Go) ostaje zaseban:
[iphone-test-protocol.md](iphone-test-protocol.md). Ovaj plan pokriva R-44 (web dio) i R-55 (Safari).

## 0. Što je već provjereno automatski (prije ručnog testa, 2026-11-26)

| Provjera | Rezultat |
|---|---|
| CI #88 (`c45ca65`) | **Otkazan** (zamijenio ga #89); 3 joba zelena, DB job prekinut |
| CI #89 (`0911f1b`) | **3/4 zeleno, DB job pao**: mobile-web e2e „guardian: sees own children only” — utrka u testu (Auth odbije drugi kod unutar intervala, aplikacija od `5679336` nastavlja bez novog koda, test pročita već iskorišten kod). Nije greška proizvoda. Popravak `48cafc5` |
| CI #90 (`48cafc5`) | **4/4 zeleno** (lint/typecheck/unit; database/pgTAP/integration/admin e2e/mobile-web e2e/concurrency/demo reset; admin build + exports + secret scan; gitleaks + audit) |
| Railway `admin` | `/api/health` 200, `appEnv: staging`, Supabase host staging |
| Railway `mobile-web` | `/health` 200, `app: mobile-web`, `appEnv: staging` |
| Hostana konfiguracija (`hosted-config check`) | **44 ok, 0 drift**, 0 unknown; 3 otvorene odluke (e-mail limit, SSL, mreže — poznato), 2 ručne |
| Session limiti | 38 migracija (zadnja `20261126100000`), hook uključen, tablica s RLS-om; zamrznuti limiti u stvarnim sesijama: uprava 7 d / 8 h, djelatnici 30 / 30 d, skrbnici 30 / 14 d |
| Izolacija Alfa/Beta (API, 6 računa × 25 tablica) | **PASS** — nijedan račun ne vidi redak vrtića u kojem nema ulogu; `roditelj.oba` vidi oba (ispravno) |

## 1. Priprema (5 minuta)

1. iPhone: **Safari**, običan (ne privatni) prozor. Isključi blokatore sadržaja za ovu stranicu ako ih imaš.
2. Računalo: preglednik (Chrome/Safari/Edge) za admin.
3. Otvori na iPhoneu: **https://mobile-web-staging-ba0c5e13.up.railway.app**
   - Mora pisati **„STAGING (web): izmišljeni podaci, samo za testiranje”**. Ako ne piše — stani.
4. **Kodovi za prijavu** (e-pošta na `.test` adrese ne stiže):
   1. U aplikaciji upiši adresu → **„Pošalji kod”** → pojavi se polje „Kod iz e-pošte”.
   2. **Tek tada** napiši u ovu sesiju: `kod <adresa>` (npr. `kod odgojitelj.alfa.1`). Dobit ćeš 6 znamenki.
   3. Upiši kod unutar 10 minuta, **ne diraj ponovno „Pošalji kod”** (novi zahtjev poništava dani kod).
   Može i više odjednom: `kod odgojitelj.alfa.1, roditelj.alfa.1`.
5. **Svaka kartica Safarija = zasebna prijava.** Za dva korisnika na istom iPhoneu otvori dvije kartice.
   Zatvaranje kartice = odjava (namjerno na webu, nije greška).

### Računi

| Uloga | Račun | Vrtić / što vidi (staging podaci) |
|---|---|---|
| Odgojitelj | `odgojitelj.alfa.1@demo.vrtic.test` (Sara Marković) | Alfa, skupina **Galebovi**: Ana Vuković, Dario Zgrablić, Đurđica Kovačević, Šime Ivančić, Tomislav Zgrablić |
| Odgojitelj (Beta) | `odgojitelj.beta.1@demo.vrtic.test` | Beta, skupina **Borovi** (Ćiril Šestan, Goran Tomić, Jelena Matić, Lana Đurić, Mia Novak) |
| Roditelj | `roditelj.alfa.1@demo.vrtic.test` (Tea Vuković) | Đurđica Kovačević (Galebovi) i Nika Zgrablić (bez skupine) |
| Drugi skrbnik | `roditelj.alfa.2@demo.vrtic.test` | Šime Ivančić; Đurđica Kovačević **bez prava prijave izostanka** |
| Roditelj (Beta) | `roditelj.beta.1@demo.vrtic.test` | Ćiril Šestan (Borovi); ovlaštena osoba Petra Mogorović |
| Roditelj u oba vrtića | `roditelj.oba@demo.vrtic.test` | Jelena Kovačić (Alfa) i Nikola Vuković (Beta) |
| Uprava | `uprava.alfa@demo.vrtic.test` (admin, računalo) | Ima **već upisan TOTP** (2026-11-19) — vidi §5.0 |
| Uprava (zamjena) | `ravnateljica.alfa@demo.vrtic.test` / `uprava.beta@demo.vrtic.test` | Nemaju TOTP; prva prijava traži upis TOTP-a u admin |

Ovlaštene osobe za preuzimanje (staging): Đurđica Kovačević → **Marija Kos, Ivan Kos**; Šime Ivančić → **Vesna Radola**;
Ćiril Šestan (Beta) → **Petra Mogorović**.

## 2. Klasifikacija nalaza

| Prioritet | Značenje | Primjeri | Postupak |
|---|---|---|---|
| **P0 — sigurnost/privatnost** | Netko vidi ili mijenja podatke koje ne smije; sesija ne završava | Dijete/poruka/obavijest drugog vrtića; skrbnik vidi tuđi razgovor; odjava sa svih uređaja ne djeluje nakon 16 min | **Odmah stani**, snimka zaslona, javi vrijeme i račun. Popravak prije svega ostalog |
| **P1 — blokira ključnu funkciju** | Osnovni tok ne radi ili ostavlja krive podatke | Prijava ne uspijeva s ispravnim kodom; dolazak se ne spremi ili se spremi dvaput; izostanak se ne može prijaviti | Zabilježi, nastavi s ostalim scenarijima. Popravak prije pilota |
| **P2 — radi uz zaobilazak** | Funkcija radi, ali loše | Promjena se vidi tek nakon osvježavanja; zbunjujuća poruka; tipkovnica prekriva polje | Zabilježi. Popravak prije pilota ako vrijedi i za nativnu aplikaciju |
| **P3 — kozmetika** | Izgled, tekst | Odrezan tekst, poravnanje, tipfeler | Zabilježi skupno |

Oznaka **[web]**: nalaz koji postoji samo u Safariju (web pregled nije pilot kanal) — prioritet se snižava za jedan
stupanj, **osim P0** koji ostaje P0.

### Ovo NISU greške (poznato ponašanje)
- Zatvaranje kartice ili Safarija odjavljuje korisnika (web čuva prijavu samo u kartici).
- „Pošalji kod” uvijek prelazi na unos koda, i za nepostojeću adresu (zaštita od otkrivanja računa, R-42).
- Uprava u mobilnoj web aplikaciji dobiva poruku „Uprava vrtića radi u web administraciji.”
- Povlačenje prstom za osvježavanje ne radi na webu (živa ažuriranja ga zamjenjuju).
- Nakon „Odjava sa svih uređaja” druga kartica/uređaj može raditi **do 15 min 30 s** (trajanje tokena).
- Računi Vrtića Beta pri prvoj prijavi vide „DEMO: ovo nije pravna obavijest” (Alfa namjerno nema obavijest).
- Nema push obavijesti (isključeno namjerno).
- Nova pozvana osoba koja se prvi put prijavi kroz web nije povezana s pozivnicom (CORS, poznato — ne testiramo).

## 3. Odgojitelj (iPhone Safari, `odgojitelj.alfa.1`)

| # | Koraci | Očekivano | Greška je… |
|---|---|---|---|
| E1 Prijava | Adresa → „Pošalji kod” → kod iz sesije → „Potvrdi” | Otvara se aplikacija, traka STAGING vidljiva, kartice: Danas, Evidencija, Obavijesti, Razgovori, Profil | Ostaje na prijavi s ispravnim kodom (**P1**); prikaže se tuđi vrtić (**P0**) |
| E2 Danas | Otvori „Danas” | Samo Galebovi i njihovih 5 djece; nijedno ime iz Bete (npr. Mia Novak, Goran Tomić) | Ime iz Bete ili druge skupine Alfe (**P0**) |
| E3 Evidencija — dolazak | „Evidencija” → dodir na dijete sa statusom „Očekuje se” | Status „U vrtiću”, poruka „… — dolazak u HH:MM”; nakon osvježavanja stranice status ostaje | Status se ne spremi ili se vrati (**P1**); dva zapisa za jedan dodir (**P1**) |
| E4 Predaja uz ovlaštenu osobu | Zadrži prst na pločici **Đurđice Kovačević** (dolazak ili odlazak) | Popis „Tko preuzima dijete …”: skrbnici + **Marija Kos, Ivan Kos** (oznaka „Ovlaštena osoba”); odabir se spremi | Na popisu osoba drugog djeteta ili vrtića (**P0**); popis prazan iako osobe postoje (**P1**); dugi pritisak u Safariju otvara izbornik teksta/povećala umjesto popisa (**P2 [web]**) |
| E5 Poništavanje | Odmah nakon dolaska (**unutar 10 s**): poništi (ponuđeno u poruci) | „Dolazak je poništen: …”, status opet „Očekuje se”; nakon 10 s poništavanje više nije ponuđeno (namjerno) | Poništavanje unutar 10 s ne radi (**P1**) |
| E6 Javljeni izostanak | Dodir na dijete s „Javljen izostanak” (ako ga ima, inače nakon P3) | Upozorenje „Za … je javljen izostanak.” s „Evidentiraj dolazak” | Dolazak se upiše bez upozorenja (**P2**) |
| E7 Uživo iz admina | Ostavi „Evidencija” otvorenu; uprava u adminu (računalo) zabilježi dolazak drugog djeteta | Status se na iPhoneu promijeni **sam unutar ~5 s** | Tek nakon osvježavanja (**P2**); nikad (**P1**) |
| E8 Pozadina | Prebaci na drugu aplikaciju 2 min; uprava u međuvremenu zabilježi dolazak; vrati se u Safari | Ekran se sam osvježi i pokaže promjenu | Ostaje stari prikaz (**P2 [web]**) |
| E9 Bez mreže | Način rada u zrakoplovu → dodir za dolazak → vrati mrežu | Unos čeka i pošalje se jednom; u adminu **jedan** zapis | Dvostruki zapis (**P1**); unos tiho nestane (**P1**) |
| E10 Razgovori | „Razgovori” → razgovor sa skrbnikom (Đurđica) → odgovori kratkom porukom | Poruka se pojavi; kod roditelja (R4) stigne sama | Vidi razgovore djece izvan svoje skupine (**P0**) |
| E11 Dnevni pregled | „Danas” → „Dnevni pregled: Galebovi” → kratki tekst bez imena → „Objavi skrbnicima” | „Dnevni pregled je objavljen skrbnicima skupine.” Upozorenje o imenima vidljivo | Objava ne uspije (**P1**); upozorenje nedostaje (**P2**) |
| E12 Obavijesti | „Obavijesti” | Prijave izostanaka i nove poruke za svoju skupinu, oznaka „Novo” | Obavijest o djetetu druge skupine/vrtića (**P0**) |
| E13 Safari specifično | Fokus na polje poruke; okreni iPhone vodoravno; povratna gesta s lijevog ruba | Tipkovnica ne prekriva polje; stranica se ne zumira sama; gesta ne odjavljuje | Zumiranje/prekriveno polje (**P3 [web]**); gesta izbaci iz aplikacije uz gubitak unosa (**P2 [web]**) |

## 4. Roditelj (iPhone Safari, nova kartica)

| # | Koraci | Očekivano | Greška je… |
|---|---|---|---|
| R1 Prijava | `roditelj.alfa.1` | Početna: **Đurđica Kovačević** i **Nika Zgrablić**; ništa drugo | Bilo koje drugo dijete (**P0**) |
| R2 Status dana | Nakon E3 (dolazak Đurđice) | Na kartici djeteta status „U vrtiću” (sam ili nakon povratka na ekran) | Krivi status (**P1**) |
| R3 Ovlaštene osobe | Otvori Đurđicu → „Ovlaštene osobe za preuzimanje” | Marija Kos, Ivan Kos; napomena „Popis vodi vrtić…”; **nema** gumba za izmjenu | Vidi Vesnu Radolu ili Petru Mogorović (**P0**); može mijenjati popis (**P0**) |
| R4 Poruke | „Poruke” → razgovor o Đurđici → pošalji poruku; čekaj odgovor iz E10 | Poruka poslana; odgovor odgojitelja stigne sam; „Razgovor vide: …” navodi sudionike | Odgovor tek nakon osvježavanja (**P2**); vidi razgovor drugog skrbnika (**P0**) |
| R5 Prijava izostanka | Đurđica → „Prijavi izostanak” → sutra → „Pošalji vrtiću” | „Prijava izostanka poslana vrtiću.”; u „Prijavljeni izostanci” vidi sutrašnji dan; odgojitelj (E12) dobije obavijest | Ne šalje (**P1**); odgojitelj ne dobije obavijest (**P2**) |
| R6 Otkazivanje izostanka | Na prijavi iz R5 → „Otkaži” → „Otkaži prijavu” | „Prijava je otkazana.”; dan nestane s popisa | Ne može otkazati (**P1**) |
| R7 Pravo prijave | Odjava → `roditelj.alfa.2` → Đurđica | **Nema** „Prijavi izostanak” za Đurđicu (samo za Šimu) | Može prijaviti izostanak za Đurđicu (**P0** — pravo prekoračeno) |
| R8 Tuđi razgovor | `roditelj.alfa.2` → „Poruke” | **Ne vidi** razgovor `roditelj.alfa.1` o Đurđici | Vidi tuđu poruku (**P0**) |
| R9 Objave | Nakon M4 (objava uprave) | Objava se pojavi s oznakom „Novo” | Ne pojavi se (**P2**); pojavi se Beta roditelju (**P0**) |
| R10 Dnevni pregled | Nakon E11 | Pregled Galebova vidljiv `roditelj.alfa.1`, ne `roditelj.beta.1` | Vidljiv izvan skupine (**P0**) |

## 5. Uprava (admin na računalu; kratka provjera i u iPhone Safariju)

### 5.0 MFA — ne mijenjati
`uprava.alfa` ima jedan potvrđeni TOTP iz 2026-11-19. **Ništa se ne resetira ni briše.**
- Ako u aplikaciji za autentifikaciju imaš unos za `uprava.alfa` → koristi njega.
- Ako nemaš → koristi `ravnateljica.alfa` (Alfa, bez TOTP-a: prva prijava traži upis TOTP-a — to je redovni tok
  proizvoda i ne dira `uprava.alfa` ni MFA pravila). Problem `uprava.alfa` ostaje za zasebnu dijagnozu.
- Zabilježi točno što admin prikaže na koraku TOTP-a (tekst, snimka) — to je ulaz za tu dijagnozu.

| # | Koraci | Očekivano | Greška je… |
|---|---|---|---|
| M1 Prijava | https://admin-staging-7d208881.up.railway.app → adresa → kod iz sesije → TOTP | Admin s DEMO trakom; bez TOTP-a nema pristupa podacima | Pristup podacima bez TOTP-a (**P0**); ispravan TOTP odbijen (**P1** — zapiši poruku) |
| M2 Dolasci | „Dolasci” → Galebovi → „Dolazak sada” za dijete | Red se promijeni; iPhone (E7) se ažurira sam | Ne sprema (**P1**) |
| M3 Ovlaštene osobe | Djeca → Đurđica Kovačević → ovlaštene osobe | Marija Kos, Ivan Kos. **Ne dodavati/uklanjati** u ovom krugu (samo pregled) | Prikaz osoba drugog djeteta (**P0**) |
| M4 Objava | Obavijesti → nova objava za Galebovi (djelatnici i skrbnici) → „Objavi” → poslije „Arhiviraj” | Pojavi se kod E12/R9 sama; nakon arhiviranja nestane | Pojavi se u Beti (**P0**); ne pojavi se (**P2**) |
| M5 Izolacija | U adminu Alfa potraži bilo koje Beta ime (npr. „Mia Novak”) | Nema rezultata | Pronađe Beta dijete (**P0**) |
| M6 iPhone Safari | Isti admin URL u Safariju, prijava, „Dolasci” | Upotrebljivo (admin nije optimiziran za mobitel) | Ne može se prijaviti (**P2 [web]**); ostalo P3 |

## 6. Izolacija Alfa ↔ Beta (iPhone, zasebne kartice)

| # | Koraci | Očekivano | Greška je… |
|---|---|---|---|
| I1 | `odgojitelj.beta.1`: Danas, Evidencija, Razgovori, Obavijesti | Samo Borovi; nijedno ime iz Galebova | **P0** |
| I2 | Dok je I1 otvoren, uprava Alfa zabilježi dolazak i objavi objavu (M2, M4) | Na Beta ekranu **ništa se ne mijenja** | Bilo kakva promjena (**P0**) |
| I3 | `roditelj.beta.1`: početna, ovlaštene osobe | Samo Ćiril Šestan; samo Petra Mogorović | **P0** |
| I4 | `roditelj.oba`: početna | Jelena Kovačić (Alfa) i Nikola Vuković (Beta), jasno odvojeni; poruke/objave Alfe samo uz Jelenu | Miješanje vrtića uz krivo dijete (**P1**); podaci treće osobe (**P0**) |
| I5 | U Beta kartici ručno upiši `/attendance`, `/messages`, `/profile` | Samo Beta podaci | **P0** |

## 7. Odjava i odjava sa svih uređaja

| # | Koraci | Očekivano | Greška je… |
|---|---|---|---|
| S1 Odjava | Profil → „Odjava” | Ekran prijave; „Natrag” u Safariju i osvježavanje ne vraćaju podatke | Podaci vidljivi nakon odjave (**P0**) |
| S2 Neposlani unosi | Način rada u zrakoplovu → dolazak → Profil → „Odjava” | Upozorenje „Na uređaju ima neposlanih unosa dolazaka.” | Tiha odjava uz gubitak (**P2**) — vrati mrežu prije potvrde |
| S3 Sve uređaje | Kartica A i kartica B, obje `odgojitelj.alfa.1` (dva koda). U A: Profil → „Odjava sa svih uređaja”. Zapiši vrijeme | A odmah na prijavi. B: **najkasnije 15 min 30 s** kasnije, pri sljedećoj radnji/osvježavanju, vraćena na prijavu | B radi i nakon **16 min** (**P0**) |
| S4 Uprava sve uređaje | Admin na računalu i u iPhone Safariju (isti račun) → „Odjava sa svih uređaja” na jednom | Drugi najkasnije za 15 min 30 s traži prijavu | Radi nakon 16 min (**P0**) |
| S5 Ponovna prijava | Nakon S3 prijavi se opet u B | Prijava uspije normalno | Račun blokiran (**P1**) |

## 8. Redoslijed izvođenja (~90 min)

1. E1–E2, R1, I1, I3 (prijave i izolacija čitanjem) — 15 min
2. M1 (paralelno na računalu) — 5 min
3. E3–E7, M2, R2, I2 (evidencija i uživo) — 15 min
4. E10, R4, R7–R8 (razgovori i prava) — 10 min
5. R5–R6, E12, E6 (izostanci) — 10 min
6. M4, R9, I2, E11, R10 (objave i dnevni pregled) — 10 min
7. R3, E4, M3 (ovlaštene osobe) — 5 min
8. E8–E9, E13, I4–I5 — 10 min
9. S1–S5 (odjava; S3/S4 traju 16 min — čekaj uz ostalo) — 20 min

Za svaki ❌ upiši u [pre-pilot-findings.md](pre-pilot-findings.md): ID scenarija, vrijeme (hh:mm:ss), račun, što je
prikazano, snimka. Za P0 odmah javi u ovu sesiju — operater provjerava trag (`realtime.messages`, audit, Auth logovi).
