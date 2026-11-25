# Retencija podataka i prava ispitanika

Stanje: 2026-11-25. **Nijedan rok čuvanja nije odlučen** i **nijedan automatski posao brisanja ne postoji.** Rokove
određuje voditelj obrade (vrtić) uz DPO-a i pravnika (Q-P09, Q-P10); ovaj dokument ih ne određuje, nego daje inventuru,
postojeće tehničke mehanizme, ovisnosti, prijedloge za raspravu i ono što je dokazano testovima. Povezano:
[privacy/data-inventory.md](../privacy/data-inventory.md) (DI-xx), R-53, R-43, R-51.

Oznake dokaza: **[pgTAP n]** lokalni stack i CI · **[staging]** hostani projekt `vrticos-staging` · **[dok.]** samo
dokumentacija dobavljača, nije potvrđeno · **[nije dokazano]**.

## 1. Pojmovi — pet različitih radnji

| Radnja | Značenje | Danas u sustavu |
|---|---|---|
| **Uklanjanje pristupa** | osoba više ne vidi podatke, zapisi ostaju | ✅ završetak članstva, rasporeda, veze ili ograničenje „od danas” (D-36, D-37, ADR-0017); djeluje odmah kroz RLS i na Realtime događaje (D-43) [pgTAP 11, 30, 34; integracija] |
| **Deaktivacija računa** | osoba se ne može prijaviti, račun i zapisi ostaju | ⚠️ suspenzija članstva u vrtiću (ADR-0017); zabrana Auth računa samo ručno (operater, Supabase Auth admin) — nema funkcije u aplikaciji |
| **Brisanje identiteta** | uklanjanje e-pošte, imena i prijavnih podataka osobe | ❌ nije moguće dok postoje zapisi koji upućuju na profil: `profiles → auth.users` i svi zapisi → `profiles` su `RESTRICT` [pgTAP 35]; moguće samo za račun bez profila (npr. neprihvaćena pozivnica, R-43) [pgTAP 35] |
| **Anonimizacija** | zapis ostaje, ali više ne identificira osobu | ❌ nije izvedena (otvorena odluka, §6) |
| **Brisanje poslovnog zapisa** | fizičko uklanjanje dolaska, poruke, izostanka… | ❌ klijenti nemaju `DELETE` ni na jednoj tablici [pgTAP 35]; brisanje djeteta, osobe ili vrtića sa zapisima baza odbija [pgTAP 35]; prošli dani se ne mijenjaju (D-41a) [pgTAP 30]; ispravci povijesti su samo za dodavanje (D-41b) [pgTAP 33] |

Posljedica: **zahtjev za brisanje danas ne može uništiti evidenciju** — ali isto tako ne postoji provedivo brisanje ili
anonimizacija. Obje stvari treba odlučiti i izvesti zajedno (§6).

## 2. Inventura po kategoriji

„Ovisnosti” = što sprječava brisanje danas. „Prijedlog” je samo za raspravu (iz inventara §4), **nije odluka**.

| Kategorija (DI) | Svrha | Pohrana | Pristup | Zaštita | Ovisnosti | Prijedlog roka | Mehanizam | Odluka |
|---|---|---|---|---|---|---|---|---|
| Dijete — identifikacija, upis (DI-09, DI-10) | identifikacija u svim funkcijama, skupina | `children`, `enrollments` | U; O svoje skupine danas; S svoje dijete | RLS, MFA uprave, D-41a | dolasci, izostanci, veze, razgovori, ispravci → `RESTRICT` | ⚖️ otvoreno: dio pedagoške dokumentacije? (Q-P10) | ispis (D-35) zatvara upis; brisanje/anonimizacija ne postoji | vrtić + DPO + pravnik |
| Skrbnik i veza (DI-11) | kontrola pristupa skrbnika | `guardians`, `child_guardians` | U; S vlastita veza; O imena i prava (D-31) | RLS, D-33, D-41a | veze, razgovori, pozivnice, predaje → `RESTRICT` | ⚖️ otvoreno | završetak veze „od danas” | vrtić + DPO |
| Kontakti — e-pošta, račun (DI-01, DI-05, DI-06) | prijava, pozivnica | Supabase Auth (`auth.users`, identiteti, sesije, MFA), `invitations` | Sam; U vidi e-poštu članova | Auth, RLS | profil `RESTRICT`; račun bez profila se može obrisati | prijedlog: neprihvaćene pozivnice 30 dana (inventar §4) | ručno (operater); nema posla | vrtić + DPO |
| Telefon | — | **ne prikuplja se** (D-34) | — | — | — | — | — | — |
| Dolasci i odlasci, ispravci (DI-14, DI-15) | evidencija prisutnosti, sigurnost djeteta | `attendance_records` (samo umetanje) | U; O svoje skupine danas | RLS, `attendance_records_no_update`, D-41a | upućuje na dijete, osobu predaje, akter → `RESTRICT` | ⚖️ zakonski rok? (financijska/pedagoška evidencija) | nema | vrtić + pravnik |
| Izostanci (DI-16) | informiranje vrtića | `absence_records` | U; O skupine u razdoblju; S s pravom pregleda | RLS; bez razloga (Q-P16) | dijete, prijavitelj → `RESTRICT` | ⚖️ otvoreno | otkazivanje (status), ne brisanje | vrtić + DPO |
| Ograničenja pristupa (DI-12, R4) | zaštita djeteta | `access_restrictions` | **samo U** | RLS, MFA | veza → `RESTRICT` | ⚖️ koliko vrijedi odluka + dokazni rok | završetak valjanosti | vrtić + pravnik (Q-P11) |
| Ovlaštene osobe (DI-13) | sigurno preuzimanje | `pickup_authorizations` | U; O i S samo danas valjane | RLS, D-41b (ime se ne mijenja ako je korišteno) | evidencija predaje → `RESTRICT` | ⚖️ otvoreno | završetak; ispravak imena dok nije korišteno | vrtić + DPO |
| Poruke i razgovori (DI-19, R4) | komunikacija vrtić–skrbnik | `conversations`, `messages` | samo sudionici tog razgovora (D-42); uprava nema pristup | RLS; povlačenje u 5 min uklanja tekst | dijete, skrbnik, pošiljatelj → `RESTRICT` | prijedlog: kraj ped. godine ili duže radi dokaza (inventar §4) | povlačenje (tekst → null); nema roka | vrtić + DPO |
| Obavijesti u aplikaciji (DI-07) | dojava o događaju, bez sadržaja | `notifications`, `notification_preferences` | samo primatelj | RLS | primatelj → `RESTRICT`; postavke se brišu s profilom (`CASCADE`) | prijedlog: kratko (npr. 90 dana) — nisu evidencija | nema | vlasnik proizvoda + DPO |
| Push tokeni (DI-07) | dostava (neaktivno, D-40) | `push_tokens` | nitko od klijenata ne čita | odjava briše token | `CASCADE` s profilom | do odjave/ponovne registracije | brisanje pri odjavi (postoji) | — |
| Objave (DI-17) i revizije | informiranje | `announcements`, `announcement_revisions` | publika; U sve | RLS, MFA | autor → `RESTRICT` | prijedlog: kraj ped. godine + X | arhiviranje (ne brisanje) | vrtić |
| Dnevni pregled (DI-18) | informiranje o danu skupine | `daily_entries` | skrbnici skupine tog dana, U, O | RLS | autor → `RESTRICT` | prijedlog: kraj ped. godine + X | nema | vrtić |
| Audit (DI-22) | odgovornost, sigurnost | `audit.audit_events` | U svoja org.; P konfiguracija | RLS, samo dodavanje kroz okidače | vrtić → `RESTRICT` | prijedlog: 1–3 godine; mora nadživjeti podatke? | nema | vrtić + DPO (R-51) |
| Povijesni ispravci (D-41b) | dokaz ispravka evidencije | `history_corrections` | samo uprava s MFA-om | samo dodavanje (okidači; ne štiti od privilegiranog operatera, §3.1 modela prijetnji) | dijete, autor → `RESTRICT` | ⚖️ najmanje koliko i ispravljena evidencija | nema; **nikad brisati običnim operacijama** | vrtić + pravnik |
| Realtime nagovještaji (D-43) | „osvježi” bez sadržaja | `realtime.messages` (Supabase interna) | samo vlasnik teme `user:<id>` | RLS na temi; samo ID-ovi i vrsta | nema veza s aplikacijskim tablicama [pgTAP 35] | platforma: dokumentirano 3 dana — **nije potvrđeno** (§4) | platforma; aplikacija ne briše | Supabase (R-53) |
| Auth audit i infrastrukturni logovi (DI-06, DI-24) | sigurnost | Supabase platforma (staging: `audit_log_disable_postgres = true`, Auth audit nije u bazi) | platform tim | prema planu Supabasea | — | prema pružatelju [dok.] | platforma | DPO (ADR-0006) |
| Sigurnosne kopije (DI-27) | oporavak | Supabase | platform tim | — | brisanje u bazi ne briše kopije | prema planu [nije dokazano za staging] | platforma | DPO |

## 3. Što aplikacija mora sačuvati čak i kod zahtjeva za brisanje

- **D-41b ispravci** i njihova pravila samo za dodavanje; **audit**; **evidencija dolazaka i predaja** (tko je preuzeo
  dijete); ovisnosti između evidencija (ime ovlaštene osobe koja je korištena pri predaji ne mijenja se).
- Zabrana brisanja povijesnih zapisa kroz obične korisničke operacije (nema `DELETE` grantova; okidači; `RESTRICT`).
- Bilo koje buduće brisanje identiteta mora razlikovati: osobni podaci osobe (ime, e-pošta, račun) mogu se zamijeniti
  oznakom, a poslovni zapis (dolazak, ispravak, audit) ostaje s pseudonimom — **ako** voditelj obrade tako odluči.

## 4. Supabase Realtime: `realtime.messages` (R-53)

**Što je.** Interna tablica Supabase Realtimea (`supabase_realtime_admin` je vlasnik tablice i particija); dnevne particije
po `inserted_at`; zasebna publikacija `supabase_realtime_messages_publication` (vlasnik `supabase_admin`) i aktivni
replikacijski slot [staging]. Sadrži za svaki događaj D-43: temu `user:<id>`, vrstu i payload samo s ID-ovima i datumom
(bez imena i sadržaja) [pgTAP 34]. ID-ovi su pseudonimni osobni podaci (povezivi s drugim podacima).

**Tko upravlja retencijom.** Realtime servis platforme, ne baza: na projektu nema `pg_cron`-a ni posla za čišćenje;
Management API nema postavku za retenciju [staging]. Dokumentacija: „Partitions are retained for 3 days before being
deleted” (Realtime Architecture), „deleted after 3 days” (Broadcast) [dok.]. Projekt ne može konfigurirati rok.

**Opažanja na stagingu** (alat `hosted-config retention`, samo čitanje):

| Vrijeme (UTC) | Stanje | Particije | Najstarija poruka |
|---|---|---|---|
| 2026-11-19 ~14:50 | aktivno (testovi) | 2026_11_18 … 2026_11_22 | 2026-11-19 14:17 |
| 2026-11-25 13:25 | nakon 6 dana bez Realtime konekcija | **iste** 2026_11_18 … 2026_11_22; nema novih | **2026-11-19 14:17 (36 redaka)** |
| 2026-11-25 13:38 | nekoliko minuta nakon prve nove konekcije | dodane 2026_11_24 … 2026_11_28; **stare nisu uklonjene** | 2026-11-19 14:17 |
| 2026-11-25 13:45 | ~10 min aktivnosti | isto | 2026-11-19 14:17 |
| 2026-11-25 18:53 | ~5 h nakon buđenja | **2026_11_22 … 2026_11_28** — particije 18.–21. 11. uklonjene | **2026-11-25 13:37** (poruke od 19. 11. obrisane) |

**Zaključak.** Brisanje radi, ali samo dok je Realtime za projekt aktivan: na projektu bez Realtime prometa poruke su
čuvane najmanje 6 dana; nakon buđenja platforma je u roku od nekoliko sati uklonila particije starije od 3 dana (ostala
je particija od 22. 11. uz današnju 25. 11.) i s njima poruke od 19. 11. Za projekt u stalnoj upotrebi (pilot) to znači
rok od približno 3–4 dana; za projekt bez prometa rok nije ograničen. Točan raspored čišćenja nije dokumentiran ni
izmjeren.

**Metodologija daljnjeg dokaza (bez destruktivnih pokusa):** pokrenuti `retention` na dan 0, zatim nakon ≥ 4 i ≥ 7 dana
uz redovitu Realtime aktivnost (npr. dnevni smoke); kriterij potvrde: najstarija particija nikad starija od 3–4 dana.
Ne brisati particije ručno, ne mijenjati interne funkcije ni vlasništvo, ne isključivati Realtime.

**Mogući dodatni kontrolni koraci (traže odluku):** (a) prihvatiti platformni rok uz izmjereni dokaz; (b) zatražiti
potvrdu od Supabase podrške; (c) aplikacijski posao koji briše vlastite retke iz `realtime.messages` starije od N dana —
tehnički moguće (uloga `postgres` ima `DELETE`), ali dira internu tablicu i **nije uveden** bez odluke.

## 5. Testovi

| Test | Što dokazuje |
|---|---|
| pgTAP `35_data_retention` (9) | klijenti nemaju `DELETE`/`TRUNCATE`; samo push tokeni i postavke obavijesti kaskadno; brisanje računa, profila, djeteta i vrtića sa zapisima odbijeno; račun bez profila se može obrisati; `realtime.messages` bez veza s aplikacijom |
| pgTAP 30, 33 | prošli dani nepromjenjivi; ispravci samo za dodavanje |
| pgTAP 34 | Realtime payload samo ID-ovi i vrsta |
| `hosted-config retention` | stanje particija i raspon poruka na hostanom projektu (samo čitanje) |

Ne postoji test brisanja ili anonimizacije jer ne postoji mehanizam — i ne uvodi se dok rokovi nisu odobreni.

## 6. Otvorene odluke (vlasnik / voditelj obrade / DPO / pravnik)

1. **Rokovi čuvanja** po kategoriji iz §2 (Q-P09), uključujući je li VrtićOS dio pedagoške dokumentacije (Q-P10) i
   zakonske rokove za evidenciju prisutnosti.
2. **Model brisanja identiteta:** anonimizacija profila (ime → oznaka, brisanje e-pošte i Auth računa) uz zadržavanje
   pseudonimnih poslovnih zapisa — ili drugi model. Traži i tehničku promjenu (`profiles → auth.users` je `RESTRICT`).
3. **Poruke:** rok i što se čuva nakon roka (sadržaj, metapodaci).
4. **Audit i D-41b ispravci:** moraju li nadživjeti podatke na koje se odnose i koliko.
5. **Neprihvaćene pozivnice i računi bez profila (R-43):** rok (prijedlog 30 dana).
6. **Realtime:** prihvaća li se platformna retencija (§4) ili se traži dodatna kontrola.
7. **Sigurnosne kopije:** rok i djelovanje brisanja na kopije (DI-27).
