# Protokol ručnog testiranja na iPhoneu (staging, D-43)

Stanje: **pripremljeno, nije izvedeno.** R-44 i R-55 ostaju otvoreni dok vlasnik ne potvrdi rezultate.
Okruženje: staging (samo izmišljeni podaci; nije produkcija) — [architecture/staging.md](../architecture/staging.md).

## 1. Priprema (jednom)

**Potrebno:** iPhone s aplikacijom **Expo Go** (App Store), računalo s Node 22 i Gitom, oba na istoj Wi-Fi mreži;
preglednik na računalu za admin.

Zašto je Expo Go dovoljan: aplikacija koristi Expo SDK 58 (trenutačna stabilna verzija, `expo@latest` = 58.0.26) i
samo module koje Expo Go sadrži, u verzijama koje SDK 58 očekuje (expo-router, expo-secure-store, expo-localization,
expo-constants, expo-linking, expo-status-bar, react-native-screens, react-native-safe-area-context); ostalo je čisti
JavaScript (supabase-js, i18next). Development build nije potreban. Push je isključen (nema Expo Push, APNs ni FCM).

1. `git clone https://github.com/rJovicic/Vrti-kOS.git`, `cd Vrti-kOS`, `git checkout claude/vrtricos-master-init-zv9c14`,
   `corepack enable`, `pnpm install`.
2. Datoteka `apps/mobile/.env.local` (ne commita se):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://hfwlfdgzgulbutnjttnq.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging publishable ključ, sb_publishable_…>
   EXPO_PUBLIC_APP_ENV=staging
   ```
   Pazi: `pnpm demo` prepisuje ovu datoteku lokalnim vrijednostima — nakon njega je ponovno postavi.
3. `pnpm --filter @vrticos/mobile start`. Na Windowsu dopusti Node.js u vatrozidu (privatna mreža). Ako telefon ne
   dosegne računalo: `pnpm --filter @vrticos/mobile start -- --tunnel`.
4. iPhone kamerom skeniraj QR kod → otvara se u Expo Go. **Na vrhu mora pisati „DEMO: izmišljeni podaci”.** Ako ne piše,
   stani: aplikacija nije spojena na staging (provjeri korak 2).
5. Kodove za prijavu (6 znamenki, vrijede 10 minuta) šalje operater (`tests/integration/src/staging/code.ts`, samo
   adrese `@demo.vrtic.test`).
6. Admin: https://admin-staging-7d208881.up.railway.app kao `uprava.alfa@demo.vrtic.test` (kod + vlastiti TOTP).

**Druga strana razgovora.** Za poruke i obavijesti potreban je drugi korisnik. Može ga voditi druga osoba na drugom
uređaju (ili Android emulatoru), ili operater izvodi radnju sintetičkog korisnika na zahtjev („pošalji poruku kao
roditelj.alfa.1”) i javlja točno vrijeme.

**Tehnički trag (za svaki scenarij):** zapiši vrijeme (sat:minuta:sekunda) i račun.
- Admin: Chrome → DevTools → Network → `live` → **EventStream**: svaki događaj je `hint` s vrstom i ID-ovima.
- Staging baza: operater provjerava `realtime.messages` (tema `user:<id>`, vrsta, vrijeme) — vidi se je li događaj
  poslan i kome; tablica se čuva nekoliko dana.
- Railway: logovi servisa `admin` (bez osobnih podataka).

## 2. Scenariji

| # | Tko se prijavljuje | Što napraviti | Očekivano | Neuspjeh znači |
|---|---|---|---|---|
| 1 | iPhone: `odgojitelj.alfa.1@demo.vrtic.test` | Upisati adresu, „Pošalji kod”, upisati kod | Otvara se aplikacija odgojitelja; DEMO traka vidljiva | Prijava ili spoj na staging ne radi (env, mreža, kod istekao) |
| 2 | iPhone: isti | Otvoriti „Danas” | Vidi skupine Galebovi (redovna) i Sunčice (zamjena), samo djecu tih skupina; nijedno dijete Vrtića Beta | Odgojitelj vidi tuđu djecu → **sigurnosni nalaz, stani i javi** |
| 3 | iPhone: odgojitelj na ekranu „Danas” / evidencija Galebovi; računalo: `uprava.alfa` u adminu → Dolasci → Galebovi | U adminu kod djeteta „Očekuje se” → „Dolazak sada” | Na iPhoneu se status djeteta promijeni u „U vrtiću” **bez povlačenja za osvježavanje**, unutar nekoliko sekundi; obrnuto: dolazak na iPhoneu se pojavi u adminu bez osvježavanja | Nema promjene unutar 15 s: realtime ne radi na uređaju (trag: EventStream u adminu, `realtime.messages` za odgojitelja) |
| 4 | iPhone: odgojitelj, „Razgovori”; druga strana: `roditelj.alfa.1` | Roditelj pošalje poruku o svom djetetu; zatim odgojitelj odgovori | Razgovor se kod odgojitelja pojavi/osvježi sam; odgovor se pojavi kod roditelja sam | Poruka se pojavi tek nakon ručnog osvježavanja → realtime ne radi; poruka se uopće ne vidi → RLS/sudionici |
| 5 | iPhone: odgojitelj, „Obavijesti”; druga strana: `roditelj.alfa.1` | Roditelj prijavi izostanak djeteta za sutra | Nova obavijest o prijavi izostanka pojavi se sama u „Obavijesti” s oznakom „Novo” | Obavijest stiže tek nakon osvježavanja → realtime; nikad → pravila obavijesti |
| 6 | iPhone: odgojitelj, „Obavijesti”; računalo: `uprava.alfa` → Obavijesti | Napraviti objavu za skupinu Galebovi (publika: djelatnici i skrbnici) → „Objavi” | Objava se na iPhoneu pojavi sama s oznakom „Novo”; nakon „Arhiviraj” u adminu nestane sama | Ne pojavi se → realtime ili publika objave |
| 7 | iPhone: odjava → prijava `roditelj.alfa.2@demo.vrtic.test` (drugi skrbnik istog djeteta); druga strana: `roditelj.alfa.1` piše odgojitelju | Nakon slanja otvoriti „Poruke” kod `roditelj.alfa.2` | `roditelj.alfa.2` **ne vidi** razgovor ni poruku `roditelj.alfa.1` i ne dobiva nikakvu promjenu na ekranu | Vidi tuđu poruku → **sigurnosni nalaz, stani i javi** |
| 8 | iPhone: odgojitelj na „Danas”; računalo: admin | Uključiti način rada u zrakoplovu; u adminu zabilježiti dolazak drugog djeteta; nakon 30 s isključiti način rada u zrakoplovu | Nakon povratka mreže ekran se sam ponovno učita i prikaže novi dolazak (bez povlačenja) | Prikaz ostaje star dok se ručno ne osvježi → ponovno spajanje ne radi |
| 9 | iPhone: odgojitelj; računalo: admin | U načinu rada u zrakoplovu na iPhoneu zabilježiti dolazak (čeka u redu); vratiti mrežu; zatim u adminu provjeriti dijete | Dolazak je zabilježen **jednom** (admin: jedan zapis; iPhone: jedan status), bez dvostrukih unosa ili poruka | Dva zapisa za isti dodir → duplikat (trag: ID zapisa u adminu) |
| 10 | iPhone: odjava → `odgojitelj.beta.1@demo.vrtic.test` (Vrtić Beta); računalo: admin Alfa | U adminu Alfa zabilježiti dolazak i objaviti objavu | Na Beta iPhoneu se **ništa ne mijenja**; vidi samo Beta djecu i Beta obavijesti | Bilo kakva promjena ili Alfa podatak → **sigurnosni nalaz, stani i javi** |

## 3. Zapis rezultata

Za svaki scenarij: ✅ / ❌, vrijeme, račun, kratak opis, snimka zaslona ako nešto odstupa (bez stvarnih podataka — ovdje
ih ionako nema). Rezultate unosi vlasnik; tek tada se R-44 i R-55 mogu zatvoriti ili ažurirati.
