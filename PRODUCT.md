# Product

<!-- impeccable:product-schema 1 -->

> Izvor: vlasnikov master brief (2026-11-10) i odgovori na init intervju istog dana.
> Stavke označene **[otvoreno]** nisu potvrđene i ne smiju se tretirati kao činjenice.

## Platform

adaptive

(Jedna React Native/Expo aplikacija za iOS i Android koja poštuje konvencije svakog OS-a — navigacija,
geste, sistemski dijalozi — uz zajednički brend. Uz nju web administracija za upravu; web je desktop-first.)

## Stack

Predložio vlasnik, potvrda kroz ADR-ove: React Native + Expo, TypeScript, Next.js (admin), Supabase
(PostgreSQL, Auth, Storage, Edge Functions) u EU regiji, pnpm + Turborepo, Zod. Vidi `docs/decisions/`.

## Users

- **Odgojitelji (primarni korisnik pilota).** Rade s grupom djece, ruke su im zauzete, vrijeme oskudno, često
  u prostoriji s djecom. Posao: brzo evidentirati dolaske/odlaske, poslati kratki dnevni pregled, odgovoriti
  roditelju, objaviti obavijest grupi. Ako odgojiteljima aplikacija oduzima vrijeme umjesto da ga štedi,
  proizvod ne uspijeva.
- **Roditelji i skrbnici.** Žele znati je li dijete dobro i što se događa u vrtiću, javiti izostanak bez
  telefoniranja, dobiti važne obavijesti na vrijeme. Jedan roditelj može imati više djece, i u različitim vrtićima.
- **Ravnatelji i administratori vrtića.** Upravljaju objektima, skupinama, djelatnicima, upisanom djecom i
  obavijestima; trebaju pregled dolazaka i izvještaje.
- **Administratori platforme (VrtićOS tim).** Postavljaju organizacije, podrška; bez rutinskog pristupa
  podacima o djeci.

## Product Purpose

Pouzdana digitalna komunikacijska i operativna platforma koja povezuje roditelje, odgojitelje i upravu vrtića.
Uspjeh pilota: odgojitelji je koriste svakodnevno bez dodatnog opterećenja, roditelji joj vjeruju, a vrtić
(kao voditelj obrade) može dokazati usklađenost s GDPR-om.

## Positioning

Napravljeno za hrvatske (prvo istarske) javne vrtiće: hrvatski jezik i terminologija (skupine, pedagoška
godina, objekti), podaci u EU, privatnost djece kao temelj, a ne dodatak. **[otvoreno]** Konkurentska analiza
(međunarodni i domaći proizvodi) još nije napravljena.

## Operating Context

- Pretežno **javni vrtići** (osnivač grad/općina): vrtić je voditelj obrade, VrtićOS izvršitelj obrade;
  prodaja kroz javnu nabavu; vrtići imaju službenika za zaštitu podataka.
- Odgojitelji mogu koristiti zajedničke tablete ili osobne telefone **[otvoreno]**; Wi-Fi u objektima može
  biti nepouzdan **[otvoreno]**.
- Početni opseg: ~10 organizacija, ~1.000 djece, ~2.000–3.000 korisničkih računa.

## Capabilities and Constraints

- Uloge s različitim iskustvom u istoj mobilnoj aplikaciji (roditelj / odgojitelj); višestruka članstva.
- Moduli (prioritet se određuje u Fazi 1): organizacije i objekti, korisnici i uloge, djeca i skrbnici,
  skupine i raspored djelatnika, dolasci, izostanci, dnevni izvještaji, aktivnosti, jelovnici, obavijesti,
  poruke, fotografije, privole, kalendar, izvještaji, revizijski zapisi, obavijesti (push).
- Ograničenja: bez medicinskih podataka u MVP-u bez odobrene procjene; bez prepoznavanja lica, biometrije,
  profiliranja i AI analize slika; push obavijesti bez osjetljivog sadržaja; samo sintetički podaci u razvoju.
- Jezik: hrvatski u MVP-u; sav tekst kroz i18n kako bi se talijanski (dvojezični istarski vrtići) dodao
  bez refaktora.

## Brand Commitments

- Ime: **VrtićOS**.
- Osobnost: topao, prijateljski, pouzdan, smiren, profesionalan, pristupačan, jednostavan.
- Ne smije izgledati kao dječja igra ni kao generički AI dashboard. Mekana zelena kao primarni smjer,
  topli neutralni tonovi, zaobljeno ali suzdržano. (Vizualni sustav se definira u Fazi 4, ne ovdje.)

## Evidence on Hand

Nema. Nema potvrđenog pilot vrtića, korisničkih intervjua, svjedočanstava, logotipa ni podataka.
Ništa od toga se ne smije izmišljati u proizvodu ili marketingu.

## Product Principles

1. Štedi vrijeme odgojitelju — svaka česta radnja u nekoliko dodira, jednom rukom.
2. Privatnost djeteta je zadana postavka — najmanje podataka, najuži pristup, jasna privola.
3. Povjerenje kroz predvidljivost — jasna stanja, bez iznenađenja, bez buke u obavijestima.
4. Vrtić je vlasnik podataka — VrtićOS ih obrađuje po uputi i to se vidi u proizvodu.
5. Jednostavno prije potpunog — MVP rješava stvarne dnevne poslove, ne sve module odjednom.

## Accessibility & Inclusion

Cilj WCAG 2.2 AA (web) i ekvivalent za mobilne aplikacije. Javni vrtići su tijela javnog sektora pa se
vjerojatno primjenjuje Zakon o pristupačnosti mrežnih stranica i programskih rješenja za pokretne uređaje
tijela javnog sektora (NN 17/19, EN 301 549) — **[otvoreno]** potvrditi primjenjivost na SaaS kupljen
javnom nabavom. Roditelji različite digitalne pismenosti; podrška za povećani tekst i čitače zaslona.
