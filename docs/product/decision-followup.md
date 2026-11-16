# VrtićOS — evidentiranje odluka D-41 i D-42 i provjera zaštite `main`

**Datum:** 2026-11-16 · **Grana:** `claude/vrtricos-master-init-zv9c14` · **Polazni commit:** `e458d83`

> Ovaj dokument evidentira odluke vlasnika i tehnički plan. **Nije odobrenje za implementaciju.** U ovom zadatku
> nisu mijenjani baza, RLS, migracije, mobilna aplikacija, administracija ni GitHub postavke.

---

## 1. Potvrđene odluke i oznake

Oznake slijede postojeći slijed u [phase-status.md](../phase-status.md) (zadnja zauzeta: D-40).

| Oznaka | Odluka (vlasnik, 2026-11-16) | Odnos prema postojećim oznakama |
|---|---|---|
| **D-41** | Pravilo D-36 proširuje se na **veze skrbnik–dijete, ograničenja skrbnika i ovlaštene osobe**. Redovne operacije ne mijenjaju retroaktivno početak ni završetak tih odnosa; promjene vrijede od danas ili kasnije. Povijesni ispravak stvarne pogreške moguć je **samo zasebnom, izričito ovlaštenom operacijom**: odgovarajuća ovlast i MFA, obvezan razlog, evidencija tko/kada/što, čuvanje prethodnih vrijednosti i traga, transakcijski, bez zaobilaženja izravnim API/DB pozivom. Obična administratorska izmjena nije dovoljna. | Proširuje **D-36** (2026-11-12, upisi). D-36 ostaje nepromijenjen. Odgovara na **R-54**. |
| **D-42** | **Zaseban razgovor po skrbniku i djetetu.** Razgovor pripada kombinaciji dijete + skrbnik. Drugi skrbnik nema pristup porukama, povijesti ni obavijestima tog razgovora. Uprava nema pristup privatnim razgovorima. Sudionici i prava provjeravaju se u bazi. Promjena odnosa skrbnik–dijete odmah utječe na pristup. Postojeći razgovori ne smiju slučajno postati dostupni drugom skrbniku. Zajednički razgovor više skrbnika **nije** dio odluke. | Rješava **D-10** (model poruka). Zamjenjuje dio **FR-11-1**/A-07 („razgovor vezan uz dijete”). Odgovara na Q-T16 za sadašnji opseg. Smanjuje izloženost iz **Q-P11**/R-21, ali ih ne zatvara. |

**Zašto nove oznake umjesto izmjene starih:** D-36 i D-10 su povijesni zapisi; nova oznaka čuva trag tko je što i
kada odlučio, a stari redovi upućuju na novu.

## 2. Promjene dokumentacije u ovom commitu

| Dokument | Promjena |
|---|---|
| [phase-status.md](../phase-status.md) | novi redovi D-41 i D-42; D-10 označen riješenim (→ D-42); D-36 upućuje na D-41; D-27 ažuriran stvarnim stanjem rulesetova |
| [risks.md](../risks.md) | R-54: odluka donesena, čeka implementaciju (ostaje **Otvoren**); R-45: dokaz aktivnog ruleseta, ostaje otvoren do potvrde liste iznimaka (§5.4); R-21: napomena o D-42 |
| [open-questions.md](../open-questions.md) | Q-T16 odgovoreno odlukom D-42 (uprava ne čita); Q-P11 napomena (ostaje otvoreno); nova pitanja **Q-T17–Q-T21** (§6) |
| [product/functional-specs.md](functional-specs.md) | FS-11: FR-11-1 i FR-11-6 usklađeni s D-42 (oznaka „implementacija čeka odobrenje”), novi FR-11-8 |
| [product/acceptance-criteria.md](acceptance-criteria.md) | AC-11-1 usklađen; novi AC-11-4 [NEG] (drugi skrbnik) |
| [product/prd.md](prd.md) | A-07 ažuriran (D-42) |
| [architecture/database-schema.md](../architecture/database-schema.md) | §5.17 napomena o planiranoj promjeni (D-42) |
| [security/branch-protection.md](../security/branch-protection.md) | stvarno stanje rulesetova s API dokazom |
| [product/readiness-review.md](readiness-review.md) | dodatak: upućivanje na ovaj dokument; ispravljen netočan navod D-39 |
| [backlog.md](../backlog.md) | paketi D-41a, D-42, D-41b (neoznačeni, čekaju odobrenje) |

## 3. Tehnički plan — D-41 (R-54)

### 3.1 Trenutno stanje (provjereno u kodu)
- `private.guard_child_lifecycle` (migracija `20261112130000`) provodi D-36 samo za **izmjenu razdoblja upisa**
  (`HISTORY_IMMUTABLE`). Na `child_guardians` i `pickup_authorizations` provjerava samo D-35 (ništa nakon ispisa).
  `access_restrictions` nema taj okidač (tablica nema `child_id`).
- Klijent (uprava s MFA-om) ima stupčano pravo `UPDATE (valid_during)` na sve tri tablice i `INSERT` s proizvoljnim
  `valid_during`. **Baza prihvaća i početak i kraj u prošlosti.**
- Administracija (`children/actions.ts`): `endRecord` odbija samo **kraj** prije današnjeg; **početni datum pri
  stvaranju** veze, ograničenja i ovlaštenja nije ograničen ni u administraciji (`zLinkInput`, `zRestrictionInput`,
  `zPickupInput` primaju bilo koji dan). `endRecord` šalje i `from` iz obrasca, pa izmijenjen obrazac može pomaknuti i
  početak. **Novi nalaz** — širi od R-54 kako je zapisan.
- Operacije koje se izvršavaju kao vlasnik baze (`withdraw_child`, `transfer_child`, `cancel_future_record`,
  `accept_invitations`, seed) okidač preskače; ostaju nepromijenjene.

### 3.2 Paket D-41a — zaštita povijesti u bazi (mali)
| Stavka | Plan |
|---|---|
| Tablice | `child_guardians`, `access_restrictions`, `pickup_authorizations` |
| Migracija | nova funkcija `private.guard_relationship_history()` (SECURITY INVOKER kao ostali čuvari) i okidači `*_history_guard` BEFORE INSERT OR UPDATE; za klijentske uloge: INSERT — `lower(valid_during) >= danas` (vremenska zona vrtića); UPDATE — dio razdoblja prije današnjeg mora ostati identičan (isti izraz kao za upise). Kod greške `HISTORY_IMMUTABLE` (postoji, s porukom na hrvatskom) |
| RLS i prava | bez promjene politika; pravo pisanja ostaje upravi s MFA-om; okidač radi nakon autorizacijskog čuvara (redoslijed imena), pa neovlašteni i dalje dobivaju `PERMISSION_DENIED` prvi |
| Administracija | Zod: `from >= today` za vezu, ograničenje i ovlaštenu osobu (samo korisnost; baza odlučuje); `endRecord` ne šalje `from`, nego mijenja samo gornju granicu |
| Mobilna | bez promjene |
| Postojeći podaci | nema utjecaja (okidač ne mijenja retke); seed se izvršava kao vlasnik |
| Negativni testovi (pgTAP `30_relationship_history.test.sql`) | za svaku od tri tablice: početak u prošlosti pri INSERT-u odbijen; kraj pomaknut u prošlost odbijen; početak pomaknut u prošlost odbijen; skraćivanje budućeg dijela i kraj danas dopušteni; produljenje kraja dopušteno; uprava bez MFA-a, odgojitelj, skrbnik i drugi vrtić i dalje `PERMISSION_DENIED`; ispis, premještaj i D-37 poništenje i dalje rade; **kontrolna provjera**: bez okidača testovi padaju |
| Kriterij prihvaćanja | izravan PostgREST poziv uprave s MFA-om ne može ni na jednoj od tri tablice promijeniti dan prije današnjeg; e2e administracije nepromijenjen i zelen; pgTAP, integracija i CI zeleni |
| Rizik | postojeći pgTAP i integracijski testovi koji kao `authenticated` umeću veze s prošlim početkom morat će se prilagoditi (pomak u buduće/današnje datume ili umetanje kao vlasnik) — bez slabljenja provjera |

### 3.3 Paket D-41b — zasebna operacija povijesnog ispravka
| Stavka | Plan |
|---|---|
| Nova tablica | `public.history_corrections` (`id`, `organization_id`, `child_id`, `record_type` ∈ {`child_guardian`, `access_restriction`, `pickup_authorization`}, `record_id`, `old_valid_during`, `new_valid_during`, `reason_code`, `corrected_by`, `corrected_at`, `correlation_id`); nepromjenjiva: bez UPDATE/DELETE prava ikome osim vlasnika; RLS čitanje samo uprava vlastitog vrtića s MFA-om; audit okidač; negativni testovi |
| RPC | `api.correct_relationship_history(p_record_type, p_record_id, p_new_valid_during, p_reason_code)` — SECURITY INVOKER omotač oko `private.correct_relationship_history` (DEFINER, `search_path=''`): ovlast (vidi Q-T17) + AAL2 → zaključavanje djeteta → provjera da zapis pripada vrtiću (isti odgovor za nepostojeći i tuđi ID) → provjera dosljednosti novog razdoblja (unutar D-35, ograničenje unutar razdoblja veze, bez preklapanja duplikata) → zapis u `history_corrections` → izmjena retka → sažeti audit događaj `history.corrected` (ID-ovi, datumi, kod razloga; bez imena i slobodnog teksta) — sve u jednoj transakciji |
| Razlog | obvezan **kod** (prijedlog: `entered_in_error`, `wrong_date_recorded`, `court_or_authority_document`, `other`) — isti obrazac kao D-37 da u audit ne uđe slobodan tekst s osobnim podacima. Treba li i slobodna bilješka → Q-T18 |
| Zaobilaženje | izravni UPDATE ostaje blokiran okidačem D-41a; RPC je jedini put; `history_corrections` nije klijentski pisiva; funkcija nije izvršiva za `anon`; katalog provjera (pgTAP 00) pokriva novu tablicu |
| Administracija | na zapisu djeteta zaseban, jasno označen postupak „Ispravak povijesti” (ne u običnom uređivanju): odabir zapisa, prikaz staro → novo, kod razloga, izričita potvrda; pregled ispravaka u povijesti zapisa |
| Mobilna | bez promjene |
| Utjecaj na izvedene podatke | dolasci, izostanci i osobe predaje ne mijenjaju se i ne brišu; ispravak mijenja samo razdoblje odnosa. Pristup se računa iz trenutnih podataka, pa se novo razdoblje primjenjuje odmah |
| Negativni testovi | odgojitelj, skrbnik, uprava bez MFA-a, drugi vrtić, platform admin, `anon` → odbijeno; nedostaje ili neispravan kod razloga → odbijeno; razdoblje izvan pravila → odbijeno; tuđi/nepostojeći ID → isti odgovor; neuspio audit poništava cijelu radnju; izravni INSERT/UPDATE/DELETE na `history_corrections` → odbijeno; izravni UPDATE razdoblja i dalje odbijen; uloga izvan dopuštene (Q-T17) → odbijeno |
| Kriterij prihvaćanja | ispravak prošlog razdoblja moguć samo kroz RPC uz MFA i kod razloga; za svaki ispravak postoji red u `history_corrections` sa starom i novom vrijednošću i audit događaj; e2e: uprava ispravlja kraj veze u prošlosti; pgTAP s kontrolnom provjerom |

## 4. Tehnički plan — D-42 (zaseban razgovor po skrbniku i djetetu)

### 4.1 Trenutno stanje (provjereno u kodu i bazi)
- `public.conversations`: jedan razgovor po djetetu, `unique (organization_id, child_id)`; sudionici se ne
  pohranjuju, računa ih `private.child_participant_ids(child)` = **svi** skrbnici s važećom vezom, `receives_messages`,
  bez aktivnog ograničenja i s aktivnim članstvom + odgojitelji skupine djeteta danas.
- Ista funkcija odlučuje o čitanju (RLS `can_access_conversation`), otvaranju, slanju i obavijestima
  (`private.notify(... child_participant_ids ...)`). Posljedica: drugi skrbnik s `receives_messages` vidi sve poruke
  i dobiva obavijesti (sonda P5 u [readiness-review.md](readiness-review.md)).
- Uprava nema pristup (RLS, RPC; mutacijski test u D4-F). Ostaje tako.
- Obavijesti (`notifications`) su bez sadržaja: `type = 'message.received'`, `resource_id` = ID razgovora; čita ih
  samo primatelj.
- Mobilna (`apps/mobile/src/lib/conversations.ts`): popis po djetetu; `api.open_conversation(child)`; nepročitano
  po `resource_id`.
- Testovi: pgTAP 27 i 28, integracija `conversations.test.ts`, render `conversations.render.test.tsx`. **Nijedan test ne
  provjerava drugog skrbnika s `receives_messages`** — praznina koju je pokazala sonda P5.
- Ključ skrbnika: `public.guardians.id` (zapis skrbnika u vrtiću). Jedan račun = najviše jedan zapis po vrtiću
  (`guardians_profile_uq`); povezani zapis se ne može preusmjeriti na drugi račun (`accept_invitations` to odbija).
  Zato je `guardian_id` stabilan ključ koji ne „putuje” s računa na račun.

### 4.2 Postojeći razgovori i migracija
- **Činjenica:** ne postoji hosted ni produkcijsko okruženje. Migracije se primjenjuju samo na praznu bazu (lokalno
  `db reset`, CI), a seed se izvršava nakon migracija. U trenutku migracije tablica `conversations` je u svim
  postojećim okruženjima **prazna**. Lokalna baza nakon seeda ima 1 sintetički razgovor (2 poruke, 1 skrbnik
  pošiljatelj; dijete ima 2 skrbnika s `receives_messages`) — nastaje iz seeda, ne migracijom.
- Seed scenarij (`packages/test-fixtures/src/world.ts`) već bilježi razgovor s `guardianId`, pa se prirodno preslikava
  na novi model.
- **Nema sigurnog automatskog razdvajanja povijesti:** sudionici se nisu pohranjivali, pa se ne može dokazati tko je
  koju poruku vidio; poruke odgojitelja bile su upućene svim skrbnicima. Kopiranje poruka u više razgovora i
  pripisivanje cijele povijesti jednom skrbniku **odbacuju se**.
- **Predloženo sigurno rješenje:** migracija počinje provjerom — ako `public.conversations` ima ijedan redak, migracija
  se **prekida s jasnom porukom** (fail closed). Time se ništa ne može slučajno razdvojiti ni otkriti; u današnjim
  okruženjima migracija prolazi jer je tablica prazna. Ako se ikad pojavi okruženje sa stvarnim razgovorima prije ove
  migracije, potrebno je poslovno pravilo (Q-T19) i zasebna, pregledana migracija. **Pravilo nije izmišljeno.**

### 4.3 Promjene
| Područje | Plan |
|---|---|
| Shema | `conversations.guardian_id uuid not null` + kompozitni FK `(organization_id, guardian_id) → guardians` RESTRICT; `unique (organization_id, child_id, guardian_id)` umjesto `(organization_id, child_id)`; indeks za skrbnika |
| Sudionici | nova `private.conversation_participant_ids(conversation)` = (a) profil **tog** skrbnika ako mu je veza s djetetom važeća danas, `receives_messages`, bez aktivnog ograničenja, aktivno članstvo skrbnika; (b) odgojitelji skupine djeteta danas (kao sada, Q-T20). Ništa se ne pohranjuje; promjena odnosa djeluje na sljedećem zahtjevu |
| RLS | `can_access_conversation` i `messages_select` koriste novu funkciju; `notifications` bez promjene (već samo primatelj) |
| RPC | `api.open_conversation(p_child_id, p_guardian_id default null)`: skrbnik → uvijek **vlastiti** zapis (parametar se zanemaruje ili mora biti vlastiti); odgojitelj → mora navesti skrbnika koji je danas sudionik (inače isti `PERMISSION_DENIED`); `send_message`, `withdraw_message`, `conversation_participants`, `conversation_messages` preko nove funkcije; nova `api.message_contacts()` za odgojitelja: djeca skupine i skrbnici s pravom poruka (imena kao po D-31) |
| Obavijesti | `send_message` obavještava samo sudionike **tog** razgovora osim pošiljatelja; bez sadržaja (nepromijenjeno) |
| Audit | nepromijenjen obrazac (ID-ovi i nazivi stupaca, nikad tekst); `guardian_id` ulazi u audit kao ID |
| Mobilna — skrbnik | popis po djetetu ostaje (skrbnik ima jedan razgovor po djetetu); prikaz „Razgovor vidite vi i odgojitelji skupine X” |
| Mobilna — odgojitelj | popis po djetetu s razgovorom po skrbniku (ime skrbnika, nepročitano po razgovoru); otvaranje s ID-em skrbnika |
| Administracija | bez promjene (uprava nema pristup) |
| Seed i demo | razgovor u seedu dobiva `guardian_id`; `demo:verify` i skripta prezentacije provjeravaju da drugi skrbnik ne vidi razgovor |

### 4.4 Negativni sigurnosni testovi (pgTAP 27/28 i integracija)
1. Drugi skrbnik istog djeteta s `receives_messages`: ne vidi tuđi razgovor ni poruke (RLS), ne može ga otvoriti, čitati
   sudionike ni poruke kroz RPC, slati ni povlačiti poruke (`PERMISSION_DENIED`), ne dobiva obavijest.
2. Skrbnik pokuša otvoriti razgovor navodeći tuđi `guardian_id` → dobiva samo vlastiti ili odbijanje (nikad tuđi).
3. Skrbnik nakon aktivnog ograničenja / kraja veze / isključenog `receives_messages` / suspenzije → gubi pristup
   vlastitom razgovoru odmah.
4. Odgojitelj skupine vidi oba razgovora; bivši odgojitelj (premještaj, kraj rasporeda) ne vidi nijedan.
5. Odgojitelj ne može otvoriti razgovor sa skrbnikom bez prava poruka ili s ograničenjem.
6. Uprava (s MFA-om i bez), platform admin, drugi vrtić, `anon` → ništa.
7. Isti račun kao skrbnik dvoje djece → odvojeni razgovori po djetetu.
8. Obavijest `message.received` nastaje samo za sudionike tog razgovora.
9. **Kontrolna provjera:** vraćanje na računanje sudionika po djetetu obara testove 1, 2 i 8.

### 4.5 Kriteriji prihvaćanja
- Sonda P5 ponovljena nakon promjene: drugi skrbnik vidi 0 razgovora i 0 poruka prvoga.
- Svih 9 skupina negativnih testova prolazi; kontrolna provjera dokazano pada bez promjene.
- Mobilni render testovi za skrbnika i odgojitelja (popis po skrbniku) zeleni; Expo export uspješan.
- `demo:verify` i cijeli CI zeleni; migracija se prekida ako tablica nije prazna (provjereno ručno jednom, zapisano).

## 5. Zaštita grane `main` — stvarno stanje

Provjereno 2026-11-16 javnim GitHub REST API-jem (repozitorij je javan; zahtjevi bez autentikacije, samo čitanje).

### 5.1 Stvarne postavke
| Pitanje | Stanje | Dokaz |
|---|---|---|
| Aktivan branch protection ili ruleset? | **Ruleset** `main-protection` (ID 27104632), `enforcement: active`, cilj `~DEFAULT_BRANCH` (= `main`); stvoren **2026-11-12 10:26 CET**, od tada nepromijenjen. Klasični branch protection **ne postoji** (`GET /branches/main/protection` → 404 „Branch not protected”) | `GET /repos/rJovicic/Vrti-kOS/rulesets/27104632`, `GET /repos/rJovicic/Vrti-kOS/rules/branches/main` |
| Obavezan za sve promjene `main`? | da, ruleset cilja zadanu granu bez isključenja (`exclude: []`) | isto |
| Obvezni CI status checks | da, 4 (vidi 5.2), izvor GitHub Actions (`integration_id` 15368); `strict_required_status_checks_policy: false` (grana ne mora biti ažurna s `main`) | `required_status_checks` |
| Izravan push zabranjen? | da — pravilo `pull_request` (promjene samo kroz PR) | `pull_request` |
| Force push zabranjen? | da — `non_fast_forward` | |
| Brisanje grane zabranjeno? | da — `deletion` | |
| Pull request obavezan? | da | |
| Minimalan broj odobrenja | **0** (`required_approving_review_count: 0`), bez code ownera, bez ponovnog odobrenja nakon pusha; razgovori na PR-u moraju biti razriješeni; `require_extra_approval_for_unattributed_changes: true` (GitHub postavka koja nije u datoteci u repozitoriju) | |
| Mogu li administratori zaobići? | API vraća `bypass_actors: []`. **Nije potvrđeno**: popis iznimaka GitHub prikazuje potpuno samo korisniku s administratorskim pravom; neautenticirani odgovor zato nije dokaz. Administrator repozitorija u svakom slučaju može **urediti ili isključiti** ruleset | vidi 5.3 |
| Vrijedi za sve korisnike i botove? | ako je `bypass_actors` stvarno prazan — da, uključujući vlasnika, GitHub Actions i aplikaciju Claude | nije potvrđeno (5.3) |
| Odgovara li D-27 / datoteci u repozitoriju? | da, pravilo po pravilo jednako `.github/rulesets/main-protection.json` | usporedba |

Poveznice: [ruleset u postavkama](https://github.com/rJovicic/Vrti-kOS/rules/27104632) ·
`https://api.github.com/repos/rJovicic/Vrti-kOS/rules/branches/main`.

### 5.2 Točne obvezne provjere (jednake nazivima jobova u `.github/workflows/ci.yml`)
- `lint · typecheck · unit tests`
- `database · migrations · RLS · integration · e2e`
- `admin build · mobile bundle`
- `secrets · dependencies`

### 5.3 Iznimke i mogućnosti zaobilaženja
1. **Lista iznimaka (bypass):** nije potvrđena autenticiranim čitanjem (vidi gore). Vlasnik treba u postavkama
   rulesetova potvrditi da je „Bypass list” prazna.
2. **Administrator može urediti ili isključiti ruleset.** To je svojstvo GitHuba; jedini vlasnik je ujedno
   administrator. Prihvatljivo za jednog održavatelja, ali to nije tehnička zaštita od vlasnikova računa.
3. **0 obveznih odobrenja:** vlasnik može sam otvoriti i spojiti PR čim je CI zelen (odluka D-27).
4. **CI se pokreće iz radne datoteke PR-a.** PR može izmijeniti `.github/workflows/ci.yml` (npr. oslabiti korak) i
   zadovoljiti obvezne provjere istog imena. Nema CODEOWNERS ni obveznog odobrenja koje bi to uhvatilo.
5. **`strict: false`:** PR može biti zelen na staroj bazi `main`-a; kombinacija sa svježim `main`-om nije
   provjerena prije spajanja.
6. Nisu uključeni: potpisani commitovi, linearna povijest, merge queue, obvezno skeniranje koda.

### 5.4 Što nedostaje za odgovarajuću zaštitu (prijedlozi, ništa nije mijenjano)
| Prioritet | Prijedlog | Zašto |
|---|---|---|
| obavezno | vlasnik potvrdi praznu listu iznimaka (snimka zaslona ili autenticirani API) | zatvaranje R-45 traži dokaz |
| preporuka | `strict_required_status_checks_policy: true` | CI provjerava upravo ono što se spaja |
| preporuka | CODEOWNERS za `.github/`, `supabase/migrations/` i `supabase/tests/` + 1 obvezno odobrenje code ownera — kad postoji drugi održavatelj | sprječava tiho slabljenje CI-ja i RLS testova |
| po izboru | linearna povijest (samo squash/rebase) | čitljiviji trag za audit |

Status: **D-27 je proveden** (ruleset aktivan i jednak dogovorenom modelu). **R-45 ostaje otvoren** samo do potvrde
liste iznimaka (točka 1); nakon toga se može zatvoriti s ovim dokazom.

## 6. Otvorena pitanja i ovisnosti (ne odlučujem umjesto vlasnika)

| ID | Pitanje | Utječe na | Prijedlog |
|---|---|---|---|
| **Q-T17** | Tko smije izvršiti povijesni ispravak: samo `org_admin` ili i `director`? (A-03 im danas daje isti skup prava) | D-41b | samo `org_admin` uz MFA (uži krug) |
| **Q-T18** | Razlog ispravka: samo kod ili kod + slobodna bilješka? Ima li vremenske granice unatrag (npr. tekuća pedagoška godina)? | D-41b | samo kod; bez slobodnog teksta (kao D-37); granica unatrag — odluka vrtića |
| **Q-T19** | Pravilo za postojeću zajedničku povijest razgovora ako se ikad pojavi okruženje sa stvarnim podacima prije D-42 | D-42 migracija | danas nije potrebno (sve tablice prazne pri migraciji); migracija se do odluke prekida |
| **Q-T20** | „Razgovor s odgojiteljem” — svi odgojitelji skupine djeteta (kao sada, FR-11-4) ili jedan određeni odgojitelj? | D-42 | ostaviti **tim skupine** (nepromijenjeno; odluka D-42 govori o strani skrbnika) |
| **Q-T21** | Smije li ispravak (D-41) obuhvatiti i **upise**? D-36 je najavio „poseban, auditirani postupak” za upise | D-41b | da, istim mehanizmom (jedan postupak za sve odnose djeteta) |

Ostaje otvoreno i nepromijenjeno: Q-P11 (pravni postupak za sudska ograničenja), Q-T05, Q-T15, R-21, R-44, R-55.

## 7. Preporučeni redoslijed

1. **Vlasnik:** potvrda prazne liste iznimaka rulesetova (zatvara R-45) i odgovori na Q-T17, Q-T18, Q-T20, Q-T21.
2. **D-41a** — zaštita povijesti u bazi + Zod u administraciji (mali paket, odmah zatvara put zaobilaženja iz R-54).
3. **D-42** — zaseban razgovor po skrbniku (shema, RLS, RPC, obavijesti, mobilna, seed, testovi iz §4.4).
4. **D-41b** — operacija povijesnog ispravka s administracijskim postupkom (nakon Q-T17/Q-T18/Q-T21).
5. Nakon svakog paketa: pgTAP s kontrolnom provjerom, integracija, e2e, render, `demo:verify`, CI zelen, dokumentacija.

Razlog redoslijeda: D-41a je najmanji i odmah uklanja zaobilaženje; D-42 uklanja stvarnu izloženost privatnosti
između skrbnika; D-41b ovisi o odgovorima vlasnika, a do tada stvarnih podataka ni potrebe za ispravcima nema.

Svaki paket čeka odobrenje vlasnika za implementaciju.
