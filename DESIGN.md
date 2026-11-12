---
name: VrtićOS
description: Mirna, topla i pouzdana platforma za vrtiće — zid garderobe kao svakodnevni registar.
colors:
  bg-canvas: "#F6F5F1"
  bg-surface: "#FFFFFF"
  bg-sunken: "#EEECE6"
  text-primary: "#22251F"
  text-secondary: "#565A50"
  text-tertiary: "#63665D"
  text-on-accent: "#FFFFFF"
  text-accent: "#1F5A3D"
  border-subtle: "#DCD8CE"
  border-control: "#857F72"
  border-focus: "#1F5A3D"
  accent: "#2B6E4D"
  accent-pressed: "#1F5A3D"
  accent-soft: "#E3F0E6"
  state-expected-bg: "#FFFFFF"
  state-expected-fg: "#22251F"
  state-expected-border: "#857F72"
  state-present-bg: "#E3F0E6"
  state-present-fg: "#1F5A3D"
  state-present-border: "#2B6E4D"
  state-departed-bg: "#ECEAE4"
  state-departed-fg: "#565A50"
  state-absent-bg: "#F6EBCF"
  state-absent-fg: "#7A5A12"
  state-absent-border: "#9A7420"
  danger-bg: "#F7E3DD"
  danger-fg: "#9B3522"
  info-bg: "#E2ECF3"
  info-fg: "#2E5470"
  warning-bg: "#F6EBCF"
  warning-fg: "#7A5A12"
  inverse-bg: "#22251F"
  inverse-fg: "#F6F5F1"
  inverse-action: "#8CCBA4"
  demo-bg: "#2E5470"
  demo-fg: "#FFFFFF"
  dark-bg-canvas: "#141613"
  dark-bg-surface: "#1C1F1B"
  dark-bg-sunken: "#232722"
  dark-text-primary: "#ECEDE7"
  dark-text-secondary: "#B5B8AE"
  dark-text-tertiary: "#9A9E93"
  dark-text-on-accent: "#141613"
  dark-text-accent: "#8CCBA4"
  dark-border-subtle: "#343931"
  dark-border-control: "#7D8378"
  dark-border-focus: "#8CCBA4"
  dark-accent: "#8CCBA4"
  dark-accent-pressed: "#CDEBD6"
  dark-accent-soft: "#1E3B2B"
  dark-state-expected-bg: "#1C1F1B"
  dark-state-expected-fg: "#ECEDE7"
  dark-state-expected-border: "#7D8378"
  dark-state-present-bg: "#1E3B2B"
  dark-state-present-fg: "#CDEBD6"
  dark-state-present-border: "#8CCBA4"
  dark-state-departed-bg: "#232722"
  dark-state-departed-fg: "#B5B8AE"
  dark-state-absent-bg: "#3A2F14"
  dark-state-absent-fg: "#E2C27A"
  dark-state-absent-border: "#E2C27A"
  dark-danger-bg: "#45231B"
  dark-danger-fg: "#F0A08E"
  dark-info-bg: "#1D3445"
  dark-info-fg: "#9CC2DE"
  dark-warning-bg: "#3A2F14"
  dark-warning-fg: "#E2C27A"
  dark-inverse-bg: "#ECEDE7"
  dark-inverse-fg: "#141613"
  dark-inverse-action: "#1F5A3D"
  dark-demo-bg: "#9CC2DE"
  dark-demo-fg: "#141613"
typography:
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  footnote:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  body-strong:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  title3:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  title2:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.2px"
  title1:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.4px"
rounded:
  sm: "6px"
  segment: "8px"
  md: "10px"
  tag: "12px"
  lg: "14px"
  bubble: "16px"
  sheet: "20px"
  pill: "999px"
spacing:
  s0: "0px"
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
  s12: "48px"
  s16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-on-accent}"
    rounded: "{rounded.md}"
    height: "48px"
  button-primary-pressed:
    backgroundColor: "{colors.accent-pressed}"
  attendance-tag-expected:
    backgroundColor: "{colors.state-expected-bg}"
    textColor: "{colors.state-expected-fg}"
    rounded: "{rounded.tag}"
    height: "72px"
  attendance-tag-present:
    backgroundColor: "{colors.state-present-bg}"
    textColor: "{colors.state-present-fg}"
    rounded: "{rounded.tag}"
  attendance-tag-departed:
    backgroundColor: "{colors.state-departed-bg}"
    textColor: "{colors.state-departed-fg}"
    rounded: "{rounded.tag}"
  attendance-tag-absent:
    backgroundColor: "{colors.state-absent-bg}"
    textColor: "{colors.state-absent-fg}"
    rounded: "{rounded.tag}"
---
---
---
# Design System: VrtićOS

> Frontmatter iznad generira `pnpm design:sync` iz `packages/tokens` — jedini izvor istine za vrijednosti.
> Ovaj tekst objašnjava kako se vrijednosti primjenjuju. Verzija 0.1 (Faza 4, 2026-11-11). Prototip:
> [design/prototype/](design/prototype/). Smjer: surface brief `apps/mobile/.impeccable/surfaces/`.

## Overview

**Svijet: zid garderobe.** Svaki odgojitelj svako jutro "čita" zid garderobe: red pretinaca, na svakom
pločica s imenom djeteta, kaput na kuki znači "tu je". VrtićOS taj prizor prenosi u proizvod: dnevni registar
nije tablica s kvačicama, nego zid pločica s imenima koje se pune bojom kad dijete stigne.

- **Način rada (Impeccable): Operate.** Sučelje služi zadatku; svijet daje samo četiri stvari: paletu (topli
  neutralni tonovi breze/kamena, mekana zelena), tipografiju (sistemski fontovi), gustoću (velike, mirne
  pločice) i jedan potpisni potez (pločica se puni zelenom od dna, s utisnutim vremenom dolaska).
- **Ton:** miran, topao, pouzdan, profesionalan. Nije dječji: bez ilustracija, maskota, piktograma djece i
  zaigranih fontova; bez generičkog "AI dashboarda" (gradijenti, sjaj, kartice s ikonom).
- **Platforme:** mobilna aplikacija prati iOS HIG i Material 3 (navigacija, kontrole, geste, sistemski fontovi);
  brend živi u boji, pločicama i tekstu. Admin je desktop-first web s istim tokenima.
- **Odluka o procesu:** Impeccable roll je radio degradirano (bez mreže prema impeccable.style), dodijeljen je
  kandidat 4 od 7 vlastitih ("garderoba"); intervju za vizualni svijet zamijenjen je pisanim briefom vlasnika.

## Colors

Strategija: **Restrained** — topli neutralni tonovi + jedna boja koja radi posao ("u vrtiću" = zelena), uz
stanja koja nose značenje. Boja nikad nije jedini nositelj informacije: svako stanje ima i tekst i/ili ikonu.

### Primary
- **Zelena (accent `#2B6E4D`, pressed `#1F5A3D`, soft `#E3F0E6`)** — primarne radnje i stanje *u vrtiću*.
  Bijeli tekst na accentu 6.10:1. Tekst `#1F5A3D` na soft pozadini 6.91:1.

### Neutral
- **Platno `#F6F5F1`, površina `#FFFFFF`, udubljena `#EEECE6`** — "breza i kamen", ne krem.
- **Tekst `#22251F` / sekundarni `#565A50` / tercijarni `#63665D`** — svi ≥ 4.5:1 na svim površinama.
- **Obrub kontrole `#857F72`** (≥ 3:1, WCAG 1.4.11) za granice polja i pločica *očekuje se*; dekorativni obrub `#DCD8CE`.

### Stanja (značenje, ne ukras)
| Stanje | Pozadina | Tekst | Obrub | Uporaba |
|---|---|---|---|---|
| Očekuje se | površina | primarni | kontrola (pun) | dijete upisano danas, još nije došlo |
| U vrtiću | zelena soft | zelena 700 | zelena 600 | evidentiran dolazak |
| Otišlo | kamen 150 | sekundarni | — | evidentiran odlazak |
| Javljen izostanak | oker 100 | oker 700 | oker 500 **isprekidan** | skrbnik ili uprava javili izostanak |
| Pogreška | terra 100 | terra 700 | — | stvarna pogreška (spremanje, učitavanje) |
| Informacija / izvan mreže | slate 100 | slate 700 | — | "čeka slanje", stanje veze |

### Named Rules
- **Terra rossa samo za pogreške.** Izostanak nije pogreška (oker), odlazak nije upozorenje (neutralno).
- **Kontrast se testira.** `packages/tokens/src/contrast.test.ts` provjerava 28 parova u svijetloj i tamnoj temi;
  CI pada ako par padne ispod 4.5:1 (tekst) ili 3:1 (granice).
- **Tamna tema postoji kao tokeni**, demo je dizajniran i provjeren u svijetloj temi. Tamna tema prije pilota
  zahtijeva vizualnu provjeru na uređajima.

## Typography

- **Mobilno:** SF Pro (iOS) i Roboto (Android) — sistemski fontovi, prate korisničku veličinu teksta (Dynamic
  Type / sp). Bez fiksnih veličina koje ne skaliraju.
- **Web:** sistemski stack (`system-ui, -apple-system, Segoe UI, Roboto, Noto Sans…`). Bez preuzimanja fontova
  s Googlea (privatnost: nema vanjskih zahtjeva iz admina) — svi fontovi u stacku pokrivaju č ć đ š ž.
- **Brojke:** `tabular-nums` za vremena i brojače (07:42 ne "skače").

### Hierarchy
| Uloga | Veličina / visina retka | Težina | Uporaba |
|---|---|---|---|
| title1 | 28/34 | 700 | naslov ekrana (velik naslov na iOS-u) |
| title2 | 22/28 | 700 | naslov sekcije u adminu |
| title3 | 18/24 | 600 | naslov kartice, ime djeteta na pregledu |
| body / bodyStrong | 16/24 | 400 / 600 | tekst, ime na pločici |
| label | 15/20 | 600 | gumbi, kartice navigacije |
| footnote | 14/20 | 400 | pomoćni tekst |
| caption | 13/18 | 500 | vrijeme na pločici, oznake stanja (minimum na mobitelu) |

### Named Rules
- **Bez kickera/eyebrowa iznad naslova** — naslov nosi sam sebe.
- **Imena se ne skraćuju na mjestu gdje se donosi odluka** (pločica: ime + inicijal prezimena; puno ime na pregledu
  djeteta i u čitaču zaslona).

## Layout

- **Razmaci:** ljestvica od 4 (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Više prostora iznad naslova nego ispod.
- **Mobilno:** jedna kolona, rubovi 16; zid pločica u **2 stupca**, razmak 8; pri velikom tekstu (≥ 1.3×) i na
  uskim ekranima **1 stupac**. Sigurne zone uvijek poštovane; donja traka kartica (iOS tab bar / Material
  navigation bar, 3–5 odredišta). Na tabletima (≥ 600) 3–4 stupca pločica i navigacijska traka sa strane (Android rail).
- **Admin:** bočna navigacija 248 px + radna površina do 1280 px; tablice s ljepljivim zaglavljem; obrasci u
  jednoj koloni do 640 px. Prijelomne točke: 600 / 960 / 1280.
- **Dodirni ciljevi:** 44 pt (iOS), 48 dp (Android), pločica dolaska ≥ 72 visine; razmak između ciljeva ≥ 8.

> **Stanje implementacije (2026-11-12):** aplikacijska ljuska ([D1-10](docs/backlog.md)) ima donju traku kartica na
> telefonima i navigacijsku traku sa strane od 600 dp (Material rail na Androidu). Kartice zasad imaju samo natpise,
> bez ikona. Izgled na simulatoru ili uređaju još nije provjeren (R-44). Vidi
> [docs/architecture/mobile-app.md](docs/architecture/mobile-app.md) §1.

## Elevation & Depth

Dvije razine, obje s pomakom i mekim zamućenjem neutralne tinte: **raised** (`0 1px 3px rgba(34,37,31,.08)`) za
kartice i pločice, **overlay** (`0 8px 24px -4px rgba(34,37,31,.18)`) za donje listove i dijaloge. Na Androidu
se dubina iskazuje tonski (Material surface levels) uz istu logiku. Bez staklenih efekata, bez sjaja, bez
tvrdih pomaknutih sjena.

## Shapes

Zaobljeno, ali suzdržano: `sm 6` (oznake), `md 10` (gumbi, polja), `lg 14` (kartice, listovi), `tag 12` (pločice),
`pill` samo za brojače. **Potpisni detalj pločice:** malo "uho" — kružni izrez 6 px u gornjem lijevom kutu, kao
rupica na viseću pločicu s imenom. Jedini ukrasni oblik u sustavu.

## Components

Komponente se **ne dijele** između React Nativea i weba (nema React DOM koda u mobilnoj aplikaciji); dijele se
tokeni, i18n tekstovi, validacija i ova pravila. Svaka komponenta ima stanja: zadano, pritisnuto/hover, fokus,
onemogućeno, učitavanje, pogreška.

### Pločica dolaska (potpisna komponenta)
- **Sadržaj:** ime + inicijal prezimena (bodyStrong), redak stanja (caption): *Očekuje se* · *U vrtiću od 07:42*
  · *Otišlo u 15:10* · *Javljen izostanak*; ikona stanja (kvačica, sat, strelica) — boja nikad sama.
- **Dodir:** očekuje se → dolazak; u vrtiću → odlazak (otvara list "Tko preuzima dijete?"); javljen izostanak →
  potvrda prije dolaska; otišlo → bez akcije (ispravak samo kroz izbornik i s razlogom).
- **Potpisni pokret:** pozadina se puni od dna prema vrhu (320 ms, ease-out), vrijeme se upisuje; poništavanje je
  obrnuto. Uz *smanjeno kretanje* promjena je trenutna.
- **Dodatne oznake:** *Čeka slanje* (sat, slate) kad je unos u redu izvan mreže; *Nije poslano* (terra) kad ga
  poslužitelj odbije; *Ispravljeno* kad postoji korekcija.
- **Pristupačnost:** `accessibilityRole="button"`, oznaka "Ana K., očekuje se. Dvaput dodirnite za dolazak.",
  `accessibilityState`; najava promjene stanja (live region).

### Ostalo
| Komponenta | Pravilo |
|---|---|
| Gumb primarni / sekundarni / tekstualni | 48 visine, radius md; jedan primarni po ekranu |
| Snackbar s "Poništi" | 10 s (FR-05-5), iznad trake kartica, ne prekriva pločice u fokusu |
| Donji list (sheet) | izbor osobe pri predaji, ispravak s razlogom; uvijek "Odustani" |
| Traka stanja veze | vrh sadržaja: *Nema internetske veze — promjene se spremaju na uređaj* (slate) |
| Prazno stanje | naslov koji kaže što se događa + jedna rečenica što učiniti; bez ilustracija |
| Pogreška učitavanja | poruka + "Pokušaj ponovno" + oznaka pogreške (correlation ID) |
| Nema pristupa | neutralan tekst; ne otkriva postoji li sadržaj (SR-API-04) |
| Demo traka | uvijek vidljiva u demu: "DEMO: izmišljeni podaci" (R-37) |
| Admin tablica | ljepljivo zaglavlje, sortiranje, tipkovnica, prazno/učitavanje/pogreška u tijelu tablice |
| Admin mini-zid | u pregledu vrtića svaka skupina prikazuje male pločice stanja (inicijali) — isti jezik kao mobilni zid |

### Stanja ekrana evidencije dolazaka (obvezna)
Učitavanje (kostur pločica) · prazno (*Danas nemate dodijeljenu skupinu*) · uspješno spremljeno (pločica +
snackbar) · pogreška (spremanje: pločica *Nije poslano*; učitavanje: ekran s ponovnim pokušajem) · izvan mreže
(traka + *Čeka slanje*) · nedovoljna prava (*Nemate pristup ovoj skupini* — raspored završio) · poništeno /
ispravljeno (snackbar *Dolazak je poništen*; oznaka *Ispravljeno*). Sva su u prototipu.

## Do's and Don'ts

**Do**
- Pisati jezikom vrtića: *skupina, objekt, skrbnik, pedagoška godina, javljen izostanak*.
- Nazivati radnju na gumbu (*Prijavi izostanak*, ne *Pošalji*); pogreška kaže problem i izlaz.
- Prikazivati vrijeme u zoni vrtića (Europe/Zagreb), 24 h, tablične brojke.
- Testirati velik tekst (200 %), VoiceOver/TalkBack, kontrast (automatski), tipkovnicu u adminu.

**Don't**
- Dječji crteži, maskote, piktogrami djece, zaigrani fontovi, pastelna duga.
- Fotografije djece u MVP-u (D-15); zdravstveni podaci u bilo kojem polju (D-9).
- Kicker iznad naslova, gradijentni tekst, staklo, sjaj, obojeni lijevi rub kartica, kartice s ikonom kao struktura.
- Skupno "Svi prisutni" (FR-05-6); crvena za izostanak; push s imenom djeteta.
- Emoji ili Unicode znakovi kao ikone — ikone su crtane (SF Symbols / Material Symbols u aplikaciji, SVG u webu).
