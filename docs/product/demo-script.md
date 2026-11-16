# Skripta prezentacije VrtićOS-a (demo, sintetički podaci)

> **Sve u demu je izmišljeno.** Vrtići „Alfa” i „Beta”, djeca, roditelji i djelatnici su sintetički (generirani u
> `packages/test-fixtures`). Ne unositi stvarne podatke ni na jednom koraku. Demo radi samo lokalno (ADR-0009); push
> obavijesti se ne šalju (D-40 nije aktiviran), e-pošta ostaje u lokalnom Mailpitu.

Trajanje: oko 25 minuta. Tri uloge, tri zaslona: **uprava** (preglednik, administracija), **odgojiteljica** i
**roditelj** (mobilna aplikacija, Expo Go na dva telefona ili jedan telefon uz odjavu između uloga).

## 0. Priprema (10 minuta prije)

| Korak | Radnja | Očekivani rezultat |
|---|---|---|
| 0.1 | `pnpm demo` (pokreće bazu, **vraća demo u početno stanje**, administraciju i Expo) | Ispis s adresama: administracija `http://localhost:3000`, Mailpit `http://127.0.0.1:54324`, QR kod za Expo |
| 0.2 | Otvoriti Mailpit u zasebnoj kartici | Prazan sandučić; ovdje stižu kodovi za prijavu |
| 0.3 | Na telefonu(ima) otvoriti Expo Go i skenirati QR kod (isti Wi-Fi) | Aplikacija se otvara; na vrhu traka **„DEMO: izmišljeni podaci”** |
| 0.4 | Otvoriti `docs/architecture/demo-accounts.md`, odjeljak „D5 presentation scenario” | Imena djece skupine Galebovi i stanje svakog djeteta za danas |
| 0.5 | Provjera ponovljivosti (po želji): `pnpm demo:verify` | Test prolazi: demo se nakon izmjena vraća u isto početno stanje |

**Uvjet prije prezentacije vrtiću:** mobilni dio još nije provjeren na stvarnom uređaju (R-44, R-55; vlasnik je
testiranje na uređaju odgodio). Prije prve prezentacije proći cijelu skriptu jednom na telefonu.

Prijave (kod iz Mailpita za svaku):
- uprava: `uprava.alfa@demo.vrtic.test` (prvi put traži postavljanje MFA aplikacije — pripremiti autentifikator)
- odgojiteljica skupine Galebovi: `odgojitelj.alfa.1@demo.vrtic.test`
- roditelj (dijete 1 skupine Galebovi): `roditelj.alfa.1@demo.vrtic.test`

## 1. Uprava — „vrtić na jednom mjestu” (preglednik, ~7 min)

| Korak | Radnja | Očekivani rezultat | Što naglasiti |
|---|---|---|---|
| 1.1 | Prijava kao uprava, kod iz Mailpita, MFA | Pregled vrtića Alfa | Uprava uvijek s dvostrukom potvrdom (MFA) |
| 1.2 | **Djeca i skrbnici** → dijete 1 Galebova | Skrbnici s pravima po vezi, dvije ovlaštene osobe za preuzimanje | Prava su po vezi (pregled, izostanci, poruke), ne po osobi |
| 1.3 | **Dolasci** → skupina Galebovi, danas | 3 u vrtiću, 1 izostanak, 1 očekuje se; uz dijete 1 „Predao/la: …” | Svaki unos ima trag; ispravak traži razlog, izvorni zapis ostaje |
| 1.4 | **Obavijesti** → dvije objavljene (sastanak, izlet) | Popis s publikom i datumom | Publika se računa pri čitanju: premještaj djeteta mijenja tko vidi |
| 1.5 | Nova obavijest: naslov „Promjena radnog vremena u petak”, tekst po želji, publika **Cijeli vrtić · Skrbnici**, *Spremi nacrt* → *Objavi* | Upozorenje „Ne navodite imena djece…”; poruka „Obavijest je objavljena…” | Nema privitaka ni oznake „hitno”; aplikacija nije kanal za hitne slučajeve |

## 2. Odgojiteljica — dan u skupini (telefon, ~8 min)

| Korak | Radnja | Očekivani rezultat | Što naglasiti |
|---|---|---|---|
| 2.1 | Prijava kao odgojiteljica | Kartice Danas · Evidencija · Obavijesti · Razgovori · Profil | Vidi samo skupine dodijeljene danas |
| 2.2 | **Evidencija** | Zid pločica Galebova: 3 „U vrtiću od …”, 1 „Javljen izostanak”, 1 „Očekuje se” | Jedan dodir po djetetu, bez „svi prisutni” |
| 2.3 | Dodir na dijete 5 (očekuje se) | Pločica „U vrtiću od …”, traka s **Poništi** (10 s) | Poništi bez razloga samo odmah; kasnije samo ispravak s razlogom |
| 2.4 | Dodir na **Poništi** | Dijete se vraća na „Očekuje se” | — |
| 2.5 | **Dugi pritisak** na dijete 1 (u vrtiću) | „Tko preuzima dijete …?” — popis skrbnika i ovlaštenih osoba; „Osoba nije na popisu” | Nema slobodnog unosa osobe; ograničeni skrbnik bio bi označen „Ograničeno” (D-38) |
| 2.6 | Odabrati ovlaštenu osobu | Odlazak zabilježen uz osobu | — |
| 2.7 | **Obavijesti** | Prijava izostanka djeteta 3 i obavijesti vrtića s oznakom „Novo” | Obavijest ne nosi sadržaj; sadržaj se učitava uz provjeru prava |
| 2.8 | **Danas** → „Dnevni pregled: Galebovi”: napisati 2–3 rečenice, označiti „Boravak vani”, *Objavi skrbnicima* | Upozorenje o imenima i zdravlju; „Objavljeno u …” | Pregled je na razini skupine, nikad o pojedinom djetetu |
| 2.9 | **Razgovori** → dijete 1, razgovor sa skrbnicom (roditelj.alfa.1) | Zaseban razgovor za svakog skrbnika; „Razgovor vide: …”, jučerašnja poruka roditelja i odgovor | Svaki skrbnik ima svoj razgovor (D-42); uprava ne čita razgovore |

## 3. Roditelj — što vidi obitelj (telefon, ~7 min)

| Korak | Radnja | Očekivani rezultat | Što naglasiti |
|---|---|---|---|
| 3.1 | Prijava kao roditelj | **Početna**: dijete 1 — „Otišlo u …” (nakon koraka 2.6) ili „U vrtiću od 07:42” | Bez imena djelatnika koji je evidentirao |
| 3.2 | Odjeljak **Danas** | „Dnevni pregled: Galebovi · Objavljeno u …” (iz 2.8) i obavijest „Novo” | — |
| 3.3 | Otvoriti dnevni pregled | Tekst, oznaka aktivnosti, „Objavile odgojiteljice skupine u …”, prethodni dani | Roditelj vidi samo dane kad je njegovo dijete bilo u skupini |
| 3.4 | **Obavijesti** → obavijest iz 1.5 | Puni tekst; oznaka „Novo” nestaje | — |
| 3.5 | **Poruke** → dijete 1 | „Razgovor vide: vi, odgojitelji skupine Galebovi” | Drugi skrbnik istog djeteta (roditelj.alfa.2) ima zaseban razgovor i ne vidi ovaj (D-42) |
| 3.6 | Napisati poruku i poslati; zatim *Povuci poruku* | Poruka se pojavi; nakon povlačenja „Poruka je uklonjena.” | Povlačenje samo 5 minuta |
| 3.7 | Početna → dijete 1 → **Prijavi izostanak** za sutra | Sažetak, zatim „Prijava izostanka poslana vrtiću.” | Bez razloga i slobodnog teksta (zdravstveni podaci se ne skupljaju) |
| 3.8 | **Profil** → Push obavijesti | Postavke po vrsti i napomena da vrtić push još nije uključio | Push ne sadrži imena ni sadržaj (D-40) |

## 4. Zatvaranje (~3 min)

| Korak | Radnja | Očekivani rezultat |
|---|---|---|
| 4.1 | Uprava → **Dolasci** (osvježiti) | Odlazak djeteta 1 uz osobu predaje; izostanak za sutra u popisu |
| 4.2 | Pitanja; jasno reći: demo, izmišljeni podaci, nije produkcija; pilot traži ugovor o obradi, DPIA i odluke (Q-T05, Q-T15, Q-T16) | — |
| 4.3 | **Vraćanje u početno stanje:** `pnpm demo:reset` (ili ponovno `pnpm demo`) | Baza je ponovno u stanju iz odjeljka „D5 presentation scenario”; ručni popravci nisu potrebni |

## Što demo namjerno ne prikazuje
Fotografije i medije, privole, zdravstvene podatke, izvještaje i izvoze, stvarno slanje push obavijesti i e-pošte,
potvrde pročitanosti, objavljivanje obavijesti od strane odgojitelja (sve su ili kasnije faze ili otvorene odluke).
