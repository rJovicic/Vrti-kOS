# Sigurnosne odluke prije fizičkog testiranja i pilota

- Datum: 2026-11-25 · Grana: `claude/vrtricos-master-init-zv9c14` · Status: **prijedlozi — odluke donosi vlasnik projekta**
  (uz voditelja obrade / DPO-a / pravnika gdje je navedeno)
- Opseg: sesije (SR-SESS-04), e-pošta (ADR-0010), izravne veze na bazu, SSL i mrežna ograničenja, retencija i brisanje
  identiteta (Q-P09/Q-P10), završni sigurnosni pregled
- Ništa u ovom dokumentu nije uključeno na stagingu ni u produkciji. Nisu otvoreni računi ni pretplate, nisu mijenjana
  mrežna pravila, certifikati ni veze, ništa nije obrisano. Rokovi čuvanja su **prijedlozi za raspravu**, ne pravni rokovi.

Oznake dokaza: **[test]** automatski test u repozitoriju, **[mjereno]** izmjereno ovom prilikom, **[kod]** pregled koda,
**[dok.]** dokumentacija pružatelja (stanje na datum dokumenta; provjeriti na dan odluke), **[nije mjereno]**.

---

## 0. Sažetak za vlasnika

| # | Tema | Stanje | Najvažniji rizik | Preporuka | Tko odlučuje |
|---|---|---|---|---|---|
| 1 | Sesije | Access token 15 min; refresh token bez isteka; odjava na jednom uređaju; **novo: odjava sa svih uređaja** | Ukraden refresh token vrijedi neograničeno; ponovna uporaba ne gasi sesiju (nalaz PP-S1) | **Opcija B (uravnotežena)** — izvedivo i na besplatnom planu kroz Auth hook | vlasnik (+ ravnatelj za UX) |
| 2 | E-pošta | Samo Mailpit lokalno; staging bez SMTP-a (2 poruke/h) | Bez pružatelja nema pilota; dijeljeni IP limit uprave (nalaz PP-S2) | **Scaleway TEM** (EU), alternativa Brevo; testirati isporučivost prije odluke | vlasnik + DPO (ugovor o obradi) |
| 3 | Baza: veze, SSL, mreža | Nitko ne koristi izravnu vezu; SSL nije prisiljen; mreža otvorena `0.0.0.0/0` | Lozinka baze je jedina zaštita izravnog pristupa | Uključiti SSL i zatvoriti mrežu (plan u §3.4) — **uz odobrenje**, kratki restart | vlasnik |
| 4 | Retencija i brisanje | Ništa se ne briše; baza odbija brisanje osobe/djeteta sa zapisima | Nema postupka za zahtjev za brisanje; nema rokova | Odluka po kategoriji (§4.3), anonimizacija umjesto brisanja zapisa | vrtić (voditelj obrade) + DPO + pravnik |
| 5 | Sigurnosni pregled | Bez kritičnih nalaza u autorizaciji; 3 nalaza (§5.3) | — | Jedan popravljen (SR-SESS-03), dva traže odluku | — |

---

## 1. Sesije (SR-SESS-02/03/04, Q-S10)

### 1.1 Trenutno stanje

| Što | Vrijednost | Dokaz |
|---|---|---|
| Prijava | samo e-mail kod (6 znamenki, 10 min); lozinke odbijene u Auth hooku | [kod] `auth_hooks.custom_access_token`, [test] `auth-password.test.ts` |
| Access token (JWT) | 900 s (15 min) lokalno i na stagingu | `config.toml`, `supabase/hosted/staging.json` (`auth.jwt_exp`), [test] `sessions.test.ts` |
| Refresh token | rotacija uključena, interval ponovne uporabe 10 s, **bez isteka** | staging spec; [dok.] Supabase: refresh tokeni ne istječu |
| Najdulje trajanje / neaktivnost | **nije postavljeno** (`sessions_timebox`, `sessions_inactivity_timeout` = 0) | staging spec; [dok.] te postavke su **samo na Pro planu** |
| Uprava (web) | sesija u httpOnly kolačićima (`SameSite=Lax`, `Secure` izvan localhosta); MFA (AAL2) obavezan; JWT se provjerava potpisom (`getClaims`) | [kod] `apps/admin/src/lib/supabase/options.ts`, `dal.ts` |
| Mobilna aplikacija | sesija u Keychainu/Keystoreu (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), automatsko osvježavanje | [kod] `apps/mobile/src/lib/supabase.ts` |
| Odjava | lokalna (ovaj uređaj); mobilna briše sesiju, red dolazaka i push token | [kod], [test] `sessions.test.ts` |
| **Odjava sa svih uređaja** | **novo u ovom paketu** (SR-SESS-03): gumb u administraciji i na profilu u aplikaciji | [test] `sessions.test.ts` (globalna odjava gasi sve refresh tokene) |
| Suspenzija člana | trenutačno ukida pristup podacima (RLS čita stanje u bazi pri svakom upitu) | [test] `membership-suspension.test.ts`, ST-REV-01 |

### 1.2 Izmjereno ponašanje (lokalno, GoTrue v2.197; staging v2.198 — [nije mjereno] na stagingu)

`tests/integration/src/sessions.test.ts` (5 testova, prolaze):

1. Svaka prijava je zasebna sesija; JWT nosi `session_id` (preduvjet za SR-SESS-04).
2. Lokalna odjava gasi samo taj uređaj; drugi uređaj nastavlja.
3. Globalna odjava gasi refresh tokene svih uređaja.
4. **Access token izdan prije odjave vrijedi do isteka** (do 15 min) — za REST, Realtime i SSE. To je prozor koji
   SR-SESS-04 zatvara.
5. **Nalaz PP-S1:** ponovna uporaba već iskorištenog refresh tokena je odbijena, ali **ne poništava sesiju** — najnoviji
   token iste sesije i dalje radi. Ako napadač prvi osvježi ukradeni token, on zadržava sesiju, a pravi korisnik je
   „odjavljen”. Dokumentacija Supabasea opisuje detekciju ponovne uporabe; ponašanje koje smo izmjerili ne štiti od tog
   scenarija. Dodatno: dok novi token nije iskorišten, stari token vraća **isti** novi token (pravilo za istovremena
   osvježavanja).

**Posljedica:** danas ukraden refresh token (npr. s otključanog telefona ili kopije uređaja) vrijedi **neograničeno**,
dok ga ne ugasi odjava sa svih uređaja, suspenzija članstva ili ručni zahvat operatera. RLS ograničava štetu (napadač vidi
samo ono što vidi žrtva), ali ne skraćuje prozor.

### 1.3 Što se događa nakon isteka, promjene i opoziva

| Događaj | Uprava (web + SSE) | Mobilna (REST + Realtime) |
|---|---|---|
| Istek access tokena | proxy osvježi kolačić pri sljedećem zahtjevu; SSE tok se sam zatvara najkasnije 60 s prije isteka i ponovno spaja kroz proxy (`/api/live`, najviše 10 min po toku) | supabase-js osvježava token i prosljeđuje ga Realtimeu; kanal ostaje |
| Opoziv sesije (odjava, globalna odjava) | sljedeće osvježavanje ne uspije → preusmjeravanje na prijavu; SSE dobiva 401 i `EventSource` staje; postojeći tok traje do svog kraja (≤ isteka tokena) | REST vraća grešku isteka → aplikacija briše sesiju (`signOut('expired')`); Realtime prekida vezu kada JWT istekne bez novog |
| Suspenzija članstva | podaci nestaju odmah (RLS); događaji se više ne šalju (primatelji se računaju pri slanju, D-43) | isto |
| Promjena lozinke | **ne primjenjuje se** — lozinke su isključene (ADR-0017) | isto |
| Promjena/uklanjanje MFA faktora | [nije mjereno] utječe li na druge AAL2 sesije; prijedlog testa u §1.6 | MFA nije obavezan u mobilnoj aplikaciji |
| Promjena e-adrese | aplikacija je ne nudi; Auth traži potvrdu na staroj i novoj adresi (`double_confirm_changes`) | isto |

### 1.4 Tri prijedloga (trajanja su primjeri za odluku, ne preporuka brojeva)

| | **A — strože** | **B — uravnoteženo (preporuka)** | **C — fleksibilno** |
|---|---|---|---|
| Najdulje trajanje sesije | uprava 12 h, osoblje 7 dana, skrbnici 30 dana | uprava 7 dana, osoblje 30 dana, skrbnici 90 dana | bez ograničenja (kao danas) |
| Neaktivnost | uprava 30 min, ostali 7 dana | uprava 8 h, ostali 30 dana | bez ograničenja |
| Odjava djeluje na access token (SR-SESS-04) | da — provjera `session_id` u bazi pri svakom upitu | da — provjera u Auth hooku pri osvježavanju + JWT 15 min (prozor ≤ 15 min) | ne; prozor = trajanje JWT-a |
| Sigurnosna posljedica | ukradena sesija vrijedi najviše sate/dane; odjava trenutna | ukradena sesija vrijedi do isteka roka; odjava ≤ 15 min | ukradena sesija vrijedi neograničeno (današnji rizik) |
| UX | uprava se često prijavljuje (kod + TOTP); osoblje tjedno; više poziva podrške | uprava tjedno, osoblje mjesečno, roditelji rijetko | najmanje trenja |
| Tehnički zahtjev | provjera sesije u RLS-u (dodatni upit po zahtjevu; `auth.sessions` treba pravo čitanja za uloge klijenata ili `security definer` funkciju) + rokovi | Auth hook čita `auth.sessions` (`created_at`, `refreshed_at`) i odbija osvježavanje nakon roka — **radi na besplatnom planu**; ili Pro plan (`sessions_timebox`, `sessions_inactivity_timeout`) | ništa |
| Može li današnja implementacija? | da, uz migraciju i testove performansi (RLS na svakoj tablici) | da: `supabase_auth_admin` već ima `SELECT` na `auth.sessions` [mjereno]; hook već postoji | da |
| Rizik izvedbe | najveći: dodatni upit u svakoj politici, rizik regresije | mali: jedna funkcija, testabilna lokalno | — |

Napomene:
- Uloga u hooku (uprava/osoblje/skrbnik) čita se iz članstva; osoba s više uloga dobiva **najstroži** rok.
- Pro plan postavke vrijede za sve korisnike jednako (bez razlike po ulozi) [dok.]; zato je hook fleksibilniji.
- Nalaz PP-S1 opcija B ublažava rokom; potpuno ga rješava samo kratka sesija ili provjera „uređaja”, što MVP ne radi.
- „Zaključavanje aplikacije” (biometrija pri otvaranju, Q-S12) je zasebna odluka i nije uključena.

### 1.5 Potrebna odluka vlasnika
1. Opcija (A/B/C) i konkretni rokovi po ulozi (s ravnateljem: koliko često uprava smije tražiti ponovnu prijavu).
2. Prihvaća li se prozor do 15 min nakon odjave (B) ili se traži trenutni opoziv (A).
3. Pro plan (trošak) ili rješenje u hooku (bez troška, naš kod).

### 1.6 Izvedivo bez daljnjeg odobrenja
- ✅ Odjava sa svih uređaja (SR-SESS-03) — **napravljeno**.
- ✅ Testovi ponašanja sesija — **napravljeno** (`sessions.test.ts`).
- Test „uklanjanje MFA faktora i druge AAL2 sesije” (samo mjerenje).
- Priprema hooka za opciju B iza zastavice bez rokova (rokovi su odluka) — tek nakon odluke o opciji.

---

## 2. E-pošta i SMTP (ADR-0010)

### 2.1 Što e-pošta radi u sustavu
- **Kodovi za prijavu** (Supabase Auth, SMTP): jedini faktor za roditelje i osoblje; uprava dodatno TOTP.
- **Pozivnice** (Edge Function `invite-member`, `_shared/email.ts`): danas samo Mailpit; za svaki drugi transport
  funkcija odbija slanje (fail-closed) — za pilot treba mali zahvat u kodu (adapter za odabranog pružatelja).

### 2.2 Zaštite danas

| Zaštita | Stanje | Dokaz |
|---|---|---|
| Kod: 6 znamenki, 10 min, jednokratan | ✅ | staging spec (`mailer_otp_length`, `mailer_otp_exp`) |
| Bez prijave novih računa; kod samo za postojeće (`shouldCreateUser: false`) | ✅ | `config.toml`, [kod] |
| Zaštita od nabrajanja adresa: isti odgovor za poznatu i nepoznatu adresu | ✅ u sučelju; preostala razlika u vremenu/API-ju (R-42) | [kod] `sign-in/actions.ts` |
| Ograničenja po IP-u (Auth): prijave 30 / 5 min, provjere koda 30 / 5 min, osvježavanja 150 / 5 min | ✅ lokalno; staging: zadane vrijednosti platforme | `config.toml` |
| Ograničenje po adresi: razmak između kodova (`max_frequency`) | ✅ | `config.toml` |
| Slanje e-pošte po satu (`rate_limit_email_sent`) | staging **2/h** (ugrađeni mailer, nije za pilot) | staging spec |
| Ograničenje pozivnica po vrtiću | ✅ R-50 (baza, s auditom odbijanja) | [test] `invitation-limit.test.ts` |
| Kod se ne zapisuje u logove | ✅ Edge Functions logiraju samo ID-ove i kodove grešaka (SR-LOG-02); Auth logove drži platforma | [kod] `_shared/http.ts` |
| Sadržaj bez podataka o djeci | ✅ predložak koda; pozivnica bez poveznice i tokena | `supabase/templates/login-code.html`, [kod] |

### 2.3 Nalaz PP-S2 — dijeljeni IP limit za upravu
Administracija šalje zahtjev za kod i provjeru koda **sa servera** (Railway), pa Auth vidi IP servera, ne korisnika.
Svi ravnatelji i administratori dijele jedan „spremnik” od 30 zahtjeva u 5 minuta. Posljedice:
- jedna osoba koja ponavlja zahtjeve na stranici prijave može **blokirati prijavu svim upravama** (uskraćivanje usluge);
- ograničenje ne razlikuje napadača od korisnika.

Mobilna aplikacija ide izravno na Auth i nema ovaj problem. [kod]; [nije mjereno] na stagingu.

| Opcija | Što | Posljedica |
|---|---|---|
| a) `Sb-Forwarded-For` | Auth broji po IP-u korisnika [dok.] | zahtijeva **tajni ključ na serveru administracije** — mijenja pravilo „administracija ima samo javne ključeve” (SR-SUP-04); odluka o arhitekturi |
| b) Ograničenje u administraciji | serverska akcija broji zahtjeve po IP-u klijenta (iz zaglavlja Railwayeva proxyja) i po adresi prije poziva Autha | bez tajnih ključeva; jedna instanca (memorija) ili trajni brojač; treba provjeriti da Railway postavlja pouzdano zaglavlje |
| c) Prihvatiti za pilot | uprava ima malo korisnika; podrška ručno | rizik ostaje; R-62 |

**Preporuka:** (b) prije pilota; (a) samo ako se prihvati tajni ključ na serveru administracije.

### 2.4 Potreban kapacitet (procjena za raspravu)
10 vrtića × ~100–150 djece × ~1,5 skrbnika + osoblje ≈ 2 000–3 000 računa. Pri uvođenju jedna pozivnica i nekoliko
kodova po osobi (≈ 10 000 poruka u prvom mjesecu, vršno nekoliko stotina na dan po vrtiću). Kasnije ovisi o roku sesije
(§1): kod opcije B ≈ 1 kod po osobi mjesečno → ≈ 3 000 poruka mjesečno. Pilot (1 vrtić): < 1 000 mjesečno.
Pružatelj zato mora podnijeti **vršni dan od ~1 000+ poruka** bez dnevne kvote koja blokira prijave.

### 2.5 Usporedba pružatelja ([dok.] stanje 2026-11-25 — cijene i uvjete provjeriti na dan odluke)

| Pružatelj | Sjedište / podaci | Cijena (približno) | Ograničenja | Vlastita domena, SPF/DKIM/DMARC | Integracija | Napomena |
|---|---|---|---|---|---|---|
| **Scaleway TEM** | FR (EU), podatkovni centri u EU | 300 poruka/mj. besplatno, zatim ≈ €0,25 / 1 000; plan „Scale” €80/mj. (SLA) | zadano 10 000 / mj. (može se povećati) | da / da | SMTP (Auth) + API (pozivnice) | najbolji omjer EU + cijena; SLA samo na skupljem planu |
| **Brevo** | FR (EU) | besplatno 300/dan; plaćeni od ≈ $9/mj. bez dnevne kvote | dnevna kvota na besplatnom planu **blokirala bi vršni dan uvođenja** | da / da | SMTP + API; službeni vodič za Supabase | dobra alternativa; dio paketa je marketing |
| **Mailjet (Sinch)** | FR, matica izvan EU | besplatno 200/dan; plaćeni od ≈ $9/mj. | dnevna kvota na besplatnom | da / da | SMTP + API | lokacija podataka provjeriti u DPA-u |
| **Amazon SES** (eu-central-1) | SAD (AWS), regija Frankfurt | ≈ $0,10 / 1 000 (+ planovi s mjesečnom naknadom) | početni sandbox: samo potvrđene adrese, 200/dan | da / da | SMTP + API | najjeftiniji pri volumenu; prijenos SAD (procjena prijenosa) |
| **Postmark** | SAD, bez EU hostinga | ≈ $15 / 10 000 mj. | — | da / da | SMTP + API | najbolja reputacija isporučivosti; podaci u SAD-u |
| **Resend** | SAD; slanje iz EU (Irska), logovi u SAD-u | besplatno 3 000/mj. (100/dan); Pro ≈ $20 / 50 000 | dnevna kvota na besplatnom | da / da | SMTP + API | podaci računa u SAD-u |

Supabase: s vlastitim SMTP-om zadani limit je 30 poruka/h i podiže se u postavkama (Rate Limits) [dok.] — vrijednost se
bira prema §2.4 i upisuje u `supabase/hosted/staging.json` (ADR-0018).

### 2.6 Preporuka
**Scaleway TEM** za staging i pilot: EU pravna osoba i podaci, plaćanje po potrošnji (pilot ≈ €0), SMTP za Auth i API za
pozivnice, DKIM/SPF/DMARC na zasebnoj poddomeni (npr. `mail.<domena>`). **Brevo** (plaćeni plan) je zamjena ako test
isporučivosti prema Gmailu/Outlooku/hrvatskim pružateljima (T-Com, Iskon) bude lošiji. Odluka nije donesena; prije nje:
ugovor o obradi (DPA), popis podobrađivača, test isporučivosti na 3–4 pružatelja pošte, domena.

### 2.7 Potrebna odluka vlasnika
1. Pružatelj (i otvaranje računa — **vlasnik**, ne Claude).
2. Domena pošiljatelja i tko upravlja DNS-om.
3. Limit `rate_limit_email_sent` za staging/pilot.
4. PP-S2: opcija (a), (b) ili (c).

### 2.8 Izvedivo bez daljnjeg odobrenja
- Adapter za pozivnice prema sučelju koje odabrani pružatelj nudi (SMTP ili HTTP), iza `EMAIL_TRANSPORT`, testiran na
  Mailpitu — nakon izbora pružatelja.
- PP-S2 opcija (b) s testovima (nakon potvrde da je ograničenje u administraciji prihvatljivo kao poslovno pravilo).

---

## 3. Izravne veze na bazu, SSL i mrežna ograničenja

### 3.1 Inventura veza

| Tko | Kako pristupa | Izravna veza na Postgres? | Vjerodajnice | Dokaz |
|---|---|---|---|---|
| Administracija (Railway) | HTTPS: PostgREST, Auth, Realtime (javni ključ + JWT korisnika) | **ne** | samo `NEXT_PUBLIC_*` varijable; nema lozinke baze ni tajnog ključa | [mjereno] Railway varijable |
| Mobilna aplikacija | HTTPS (javni ključ + JWT) | ne | javni ključ | [kod] |
| Edge Functions | HTTPS prema PostgREST/Auth (tajni ključ samo za Auth admin i servisne RPC-ove) | ne — `SUPABASE_DB_URL` platforma daje, **kod ga ne koristi** | platforma | [kod] `grep` |
| GitHub Actions (CI) | samo lokalni Supabase u runneru (`127.0.0.1:54322`) | samo lokalno | nema tajni hostanog projekta | [kod] `.github/workflows/ci.yml` |
| GitHub Actions (`hosted-config.yml`) | HTTPS (javni ključ; Management API samo ako se doda tajna — nije dodana) | ne | nema | [kod] |
| Operater (vlasnik/Claude) | Management API (HTTPS, osobni PAT) za migracije, postavke, provjeru | ne | PAT (opoziva se nakon testa na iPhoneu, R-59) | `docs/architecture/staging.md` |
| Skripte `run-rls-spike`, `run-concurrency-checks` | izravno, **samo lokalni stack** | lokalno | lokalna zadana lozinka | [kod] |

**Zaključak:** nijedna komponenta ne treba izravnu vezu na hostanu bazu. Pooler (transakcijski način) postoji, ali se ne
koristi.

### 3.2 Stanje na stagingu [mjereno 2026-11-25, Management API, samo čitanje]
- SSL enforcement: **isključen** (`database: false`) — klijent se može spojiti bez TLS-a.
- Mrežna ograničenja: dopušteno **`0.0.0.0/0` i `::/0`** (cijeli internet); značajka je dostupna na planu.
- Pooler: transakcijski, SCRAM autentifikacija.
- Jedina zaštita izravnog pristupa je lozinka baze (postavljena pri izradi projekta, nije u repozitoriju ni na Railwayu).

### 3.3 Rizik
Lozinka baze daje `postgres` ulogu (zaobilazi RLS). Ako procuri (npr. kopirana u alat ili skriptu), napadač se može
spojiti s bilo koje adrese, i to bez TLS-a. Vjerojatnost je mala jer se lozinka ne koristi, ali je posljedica potpuna.

### 3.4 Plan najmanjeg pristupa (**ništa nije primijenjeno — traži odobrenje**)

| Korak | Što | Utjecaj | Povrat |
|---|---|---|---|
| 1 | Uključiti **SSL enforcement** | kratki restart baze (sekunde do minuta [dok.]); HTTPS API-ji nepromijenjeni | isključiti istom postavkom |
| 2 | **Mrežna ograničenja**: ukloniti `0.0.0.0/0` i `::/0`; dopustiti ništa ili samo operaterov IP kada je potreban | HTTPS API-ji, Edge Functions i supabase-js **nisu pogođeni** [dok.]; vrijedi i za pooler | vratiti CIDR |
| 3 | Lozinku baze promijeniti i ne pohranjivati (generirati pri potrebi) | nijedna komponenta je ne koristi | — |
| 4 | Upisati očekivano stanje u `supabase/hosted/staging.json` (ADR-0018) i provjeravati alatom `check` | otkrivanje odstupanja | — |
| 5 | Isto za produkciju od prvog dana | — | — |

Redoslijed: 4 (spec) → 1 → 2 → provjera `check` + smoke (81 provjera). Procjena: 30 min uz vlasnika.

### 3.5 Potrebna odluka vlasnika
1. Odobrenje koraka 1–3 na stagingu (restart baze).
2. Treba li ikome izravan pristup (npr. alat za izvješća)? Ako da — samo s fiksne adrese i preko SSL-a.

### 3.6 Izvedivo bez daljnjeg odobrenja
- Ovaj popis i plan (gotovo).
- Priprema promjene specifikacije (`expected` za SSL i CIDR) **bez primjene** — u istom zahvatu kao i primjena.

---

## 4. Retencija, deaktivacija i brisanje identiteta (Q-P09, Q-P10)

Nadovezuje se na [data-retention.md](data-retention.md) (inventura, dokazi, `realtime.messages`). **Rokovi su prijedlozi
za raspravu**; zakonske rokove (pedagoška dokumentacija, financije, arhivsko gradivo) utvrđuje pravnik vrtića.

### 4.1 Pet radnji — razlike

| Radnja | Što se događa | Što ostaje | Tko pokreće | Danas |
|---|---|---|---|---|
| **Uklanjanje pristupa** | osoba ne vidi podatke (kraj članstva, rasporeda, veze s djetetom) | račun, profil, svi zapisi | uprava | ✅ trenutačno kroz RLS |
| **Deaktivacija** | osoba se ne može prijaviti / ne dobiva pristup (suspenzija; zabrana računa) | račun, profil, zapisi | uprava; zabranu računa operater | ⚠️ suspenzija ✅; zabrana računa ručno |
| **Brisanje identiteta** | brišu se prijavni podaci (e-pošta, Auth račun, MFA, sesije) | profil i zapisi ako se profil anonimizira | operater na zahtjev vrtića | ❌ blokirano vezama (samo račun bez profila) |
| **Anonimizacija** | ime i kontakt u profilu/skrbniku/ovlaštenoj osobi zamijene se oznakom („Bivši korisnik #…”) | zapisi (dolasci, poruke…) bez identiteta | operater na odluku vrtića | ❌ nije izvedena |
| **Brisanje poslovnog zapisa** | fizičko uklanjanje dolaska, poruke… | ništa | samo nakon isteka roka, odlukom | ❌ namjerno nemoguće (klijenti nemaju `DELETE`; baza odbija) |

### 4.2 Načelo prijedloga
Kod zahtjeva za brisanje: **ukloniti pristup odmah**, **izbrisati identitet** (Auth račun) i **anonimizirati** profil
kada zapisi moraju ostati; poslovne zapise brisati tek po isteku roka koji odredi vrtić, i to grupno (ne po zahtjevu).
Nikakvo automatsko brisanje bez odluke i testa na kopiji.

### 4.3 Tablica odluka po kategoriji

| Kategorija | Svrha | Prijedlog roka (za raspravu) | Ako čuvamo | Ako brišemo | Anonimizacija | Veze | Prava osobe | Potpis |
|---|---|---|---|---|---|---|---|---|
| Dijete (ime, upis, skupina) | identifikacija u svim funkcijama | do kraja ped. godine ispisa + rok pedagoške dokumentacije (⚖️) | vrtić dokazuje tko je bio upisan | gube se dolasci, poruke, ispravci (veze) | ime → oznaka; zapisi ostaju | dolasci, izostanci, veze, razgovori, ispravci | pristup, ispravak; brisanje ograničeno zakonskom obvezom | vrtić + pravnik + DPO |
| Skrbnik i veza s djetetom | kontrola pristupa | kraj veze + 1 ped. godina (prijedlog) | dokaz tko je imao pravo pristupa | gubi se trag tko je vidio/predao dijete | ime, e-pošta → oznaka | veze, razgovori, predaje | pristup, ispravak, brisanje identiteta | vrtić + DPO |
| Račun i e-pošta (Auth) | prijava | do kraja zadnjeg članstva + 30 dana (prijedlog); neprihvaćene pozivnice 30 dana | moguća prijava i nakon odlaska (bez pristupa) | nemoguća prijava; zapisi ostaju preko profila | — (brisanje je ispravna radnja) | profil (`RESTRICT`) | brisanje | vrtić + DPO |
| Dolasci, odlasci, ispravci | evidencija prisutnosti, sigurnost | ⚖️ zakonski/financijski rok (pravnik) | potrebno za obračun i dokaz | gubi se dokaz prisutnosti | ime predavatelja i aktera → oznaka nakon roka identiteta | dijete, osobe, ispravci | pristup | vrtić + pravnik |
| Izostanci | informiranje | kraj ped. godine + 1 (prijedlog) | pregled povijesti | — | prijavitelj → oznaka | dijete | pristup | vrtić + DPO |
| Ograničenja pristupa | zaštita djeteta | trajanje odluke + dokazni rok (⚖️ Q-P11) | dokaz da je vrtić postupio | gubi se dokaz | ne preporučuje se dok traje rok | veza | pristup (ograničeno) | vrtić + pravnik |
| Ovlaštene osobe | sigurno preuzimanje | kraj valjanosti + 1 ped. godina (prijedlog) | dokaz tko je smio preuzeti | gubi se uz predaje | ime → oznaka | predaje | pristup, ispravak | vrtić + DPO |
| Poruke i razgovori | komunikacija | kraj ped. godine + 1 (prijedlog) | dokaz dogovora | gubi se dokaz; manje izloženosti | tekst → prazno, pošiljatelj → oznaka | dijete, skrbnik, pošiljatelj | pristup, brisanje (uz iznimke) | vrtić + DPO |
| Obavijesti u aplikaciji | dojava | 90 dana (prijedlog) | nema poslovne vrijednosti | ništa se ne gubi | — | primatelj | brisanje | vlasnik proizvoda + DPO |
| Objave i revizije | informiranje | kraj ped. godine + 1 (prijedlog) | povijest obavijesti | — | autor → oznaka | autor | — | vrtić |
| Dnevni pregled | informiranje | kraj ped. godine (prijedlog) | — | — | autor → oznaka | autor | pristup | vrtić |
| Audit | odgovornost, sigurnost | 1–3 godine; mora nadživjeti zapise na koje upućuje (prijedlog) | dokaz tko je što radio | gubi se dokaz incidenta | akter → oznaka nakon roka | vrtić | pristup (ograničeno) | vrtić + DPO |
| Realtime nagovještaji | „osvježi” | platforma (~3 dana dok je Realtime aktivan, R-53) | — | — | — (samo ID-ovi) | nema | — | Supabase |
| Logovi i sigurnosne kopije | sigurnost, oporavak | prema pružatelju | — | brisanje u bazi ne briše kopije | — | — | informiranje | DPO |

### 4.4 Potrebna odluka
Vrtić (voditelj obrade) uz DPO-a i pravnika: rokovi po kategoriji, oblik anonimizacije, tko zaprima zahtjeve i u kojem
roku, postupak za kopije. Vlasnik proizvoda: smije li operater raditi anonimizaciju ručno u pilotu (s auditom) dok
funkcija ne postoji.

### 4.5 Izvedivo bez daljnjeg odobrenja
- Testovi koji dokazuju da ništa ne briše zapise (postoje: pgTAP 35).
- Nacrt postupka za operatera (ručna anonimizacija na kopiji, audit) — kao dokument, bez izvođenja.
- Funkcija anonimizacije **tek nakon odluke** o oznakama i opsegu.

---

## 5. Završni sigurnosni pregled

### 5.1 Opseg i metoda
Pregled koda i konfiguracije, upiti nad lokalnom bazom (samo čitanje), mjerenja testovima. Područja: RLS i grantovi,
MFA/AAL2, Edge Functions, Server Actions administracije, mobilna prijava, autorizacija Realtimea, SSE, ograničenja
zahtjeva, audit, tajne i varijable okruženja, odvojenost staginga i produkcije.

### 5.2 Rezultati

| Područje | Nalaz | Dokaz |
|---|---|---|
| RLS | sve 27 tablica s RLS-om; klijenti bez `DELETE`/`TRUNCATE`; NEG testovi prolaze | pgTAP (CI #78), staging inventura |
| `security definer` funkcije | 93 funkcije; **nijednu ne može pozvati `anon`**; sve imaju fiksni `search_path` | [mjereno] upit nad `pg_proc` |
| MFA/AAL2 | stranice i akcije uprave traže AAL2 (`getOrgContext`), baza ponovno traži AAL2; `mfa_allow_low_aal = false` | [kod], [test] e2e, `totp.test.ts` |
| Server Actions | svaka akcija ponovno razrješava korisnika (DAL), validira Zodom i piše kao korisnik; nema servisnog ključa | [kod] |
| Edge Functions | identitet iz Autha za točan JWT; autorizacija kroz RLS kao pozivatelj; servisni ključ samo za Auth admin i servisne RPC-ove; `x-actor-id` vrijedi samo za `service_role` | [kod], `audit_fill` |
| `push-dispatch` | `verify_jwt = false`, ali RPC-ovi su dodijeljeni samo `service_role`; isključen (`disabled`) ne dira bazu | [kod], [test] `push.test.ts` |
| Realtime | samo privatni kanali; politika samo `SELECT` vlastite teme `user:<id>` za `broadcast`; nema `INSERT` politike (klijent ne može slati drugima) | migracija `20261119150000`, staging spec |
| SSE `/api/live` | AAL2 obavezan; token ostaje na serveru; tok završava prije isteka tokena | [kod] |
| Kolačići | httpOnly, `SameSite=Lax`, `Secure` u produkciji; e-adresa za korak koda u httpOnly kolačiću ograničenom na `/sign-in` | [kod] |
| CSP i zaglavlja | nonce CSP, `frame-ancestors 'none'`, `no-store`, `nosniff`, `no-referrer` | [kod] `proxy.ts` |
| Tajne | nema tajni u repozitoriju (gitleaks, cijela povijest) ni u paketima klijenata (SR-SUP-04) | CI #78 |
| Staging / produkcija | produkcija ne postoji; staging zaseban projekt i Railway okruženje | `docs/architecture/staging.md` |

### 5.3 Nalazi

| ID | Ozbiljnost | Nalaz | Status |
|---|---|---|---|
| PP-S0 | Visoka (zahtjev SR-SESS-03 nije bio ispunjen) | Nije postojala odjava sa svih uređaja; izgubljen telefon mogao se „odjaviti” samo suspenzijom članstva | **Popravljeno**: gumb u administraciji i aplikaciji; test `sessions.test.ts` |
| PP-S1 | Srednja | Ponovna uporaba refresh tokena ne gasi sesiju (izmjereno, GoTrue v2.197); ukradeni token vrijedi neograničeno | Odluka: §1.4 (opcija B ograničava); R-62 |
| PP-S2 | Srednja | Uprava dijeli jedan IP limit Autha (zahtjevi idu s Railwaya) → moguća blokada prijave svim upravama | Odluka: §2.3; R-63 |
| PP-S3 | Srednja | Staging: SSL nije prisiljen, mreža otvorena za cijeli internet | Odluka: §3.4; R-64 |

Nisu nađeni: zaobilaženje RLS-a, curenje među vrtićima, eskalacija preko Edge Functions ili Realtimea, tajne u kodu.
Ograničenje pregleda: nije rađen vanjski penetracijski test (ostaje preporuka prije produkcije, Faza 7).

---

## 6. Zaključak po temi

| Tema | Trenutno stanje | Dokaz | Rizik | Prijedlog | Odluka vlasnika | Bez daljnjeg odobrenja |
|---|---|---|---|---|---|---|
| Sesije | JWT 15 min, refresh bez isteka, odjava lokalna + **sa svih uređaja** | `sessions.test.ts`, staging spec | ukradena sesija neograničeno (PP-S1) | opcija B (hook) | opcija, rokovi, Pro plan ili hook | testovi i odjava sa svih uređaja — gotovo |
| E-pošta | samo Mailpit; staging 2/h | ADR-0010, staging spec | bez pružatelja nema pilota; PP-S2 | Scaleway TEM, alternativa Brevo | pružatelj, domena, limit, PP-S2 | adapter i limiter nakon izbora |
| Baza | nitko ne koristi izravnu vezu; SSL off; mreža otvorena | Management API (čitanje), Railway varijable | lozinka kao jedina zaštita (PP-S3) | SSL + zatvorena mreža | odobrenje restarta i pravila | plan i spec |
| Retencija | ništa se ne briše; brisanje sa zapisima odbijeno | pgTAP 35, data-retention.md | nema postupka za zahtjev | anonimizacija + rokovi po kategoriji | vrtić + DPO + pravnik | nacrt postupka |

Izvori ([dok.]): [Supabase — rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[Supabase — custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Supabase — SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement),
[Supabase — network restrictions](https://supabase.com/docs/guides/platform/network-restrictions),
[Scaleway TEM](https://www.scaleway.com/en/transactional-email-tem/), [Brevo pricing](https://www.brevo.com/pricing/),
[Mailjet pricing](https://www.mailjet.com/pricing/), [Amazon SES pricing](https://aws.amazon.com/ses/pricing/),
[Postmark pricing](https://postmarkapp.com/pricing), [Resend pricing](https://resend.com/pricing).
