# Pregled dosljednosti dokumentacije Faze 1

**Datum:** 2026-11-10 · **Status:** provedeno; razrješenja su dokumentacijske odluke (DD-xx) ili su
eskalirana vlasniku (D-xx) / u otvorena pitanja (Q-xx).
**Pregledano:** `glossary.md`, `roles-and-permissions.md`, `user-journeys.md`, `business-rules.md`,
`domain-model.md`, `nfr.md`, `mvp-scope.md`, `../architecture.md`, `../decisions/*`, `../roadmap.md`,
`../backlog.md`, `../phase-status.md`, `../open-questions.md`, `../risks.md`, `../privacy/*`.

Legenda razrješenja: **DD** = dokumentacijska odluka donesena u ovom koraku (reverzibilna, za pregled vlasnika);
**D** = odluka vlasnika; **A** = pretpostavka u PRD-u (§9) koju validacija mora potvrditi ili srušiti.

## 1. Nedosljednosti

| ID | Nalaz | Gdje | Razrješenje |
|---|---|---|---|
| N-01 | P1-1 i P1-2 nisu označeni kao gotovi u backlogu, a u `phase-status.md` jesu. | backlog, phase-status | Backlog ažuriran. |
| N-02 | D-14 (prelazak u Fazu 1) i dalje "čeka odobrenje", a faza je u tijeku. | phase-status | Vlasnik je 2026-11-10 izričito naložio nastavak Faze 1 → D-14 zabilježen kao **odobren za dokumentacijski rad**; implementacija i dalje nije odobrena. |
| N-03 | Zamjena je zaseban entitet `substitute_assignment` (rječnik, domenski model), a u ERD-u (`architecture.md`) postoji samo `STAFF_ASSIGNMENT`. | glossary, domain-model, architecture | **DD-01:** jedan entitet `staff_assignment` s `assignment_type ∈ {regular, substitute}`; za zamjenu su `valid_to` i `approved_by` obvezni. Manje tablica, ista pravila pristupa. |
| N-04 | Dozvole skrbnika: zaseban entitet `guardianship_permission` (domenski model) vs. zastavice na `guardianship` (ADR-0005, architecture). | domain-model, ADR-0005 | **DD-02:** u MVP-u fiksni skup zastavica na `guardianship` (`can_view`, `can_report_absence`, `receives_messages`); `access_restriction` ostaje **zaseban** vremenski ograničen entitet jer treba vlastiti audit, valjanost i referencu na odluku. |
| N-05 | Preuzimanje: ERD ima samo `PICKUP_PERSON`, domenski model `pickup_person` + `pickup_authorization`. | architecture, domain-model | **DD-03:** prihvaća se domenski model (osoba + vremenski ograničeno ovlaštenje po djetetu). U `architecture.md` dodana napomena. |
| N-06 | Pojam "dnevni izvještaj" (rječnik, matrica) vs. "dnevni pregled" (roadmap, putovanja); "izvještaj" se sudara s modulom *Izvještaji* za ravnatelja. | glossary, roles, roadmap | **DD-04:** u sučelju i dokumentaciji **"Dnevni pregled"**; identifikator `daily_report` ostaje. Rječnik i matrica ažurirani. |
| N-07 | Granularnost dnevnog pregleda (po djetetu ili skupini) otvorena u domenskom modelu, a putovanja pretpostavljaju "svoju skupinu". | domain-model, user-journeys | **A-05:** MVP prijedlog je **dnevni pregled skupine** (bez polja po djetetu) — manje podataka o djeci i manje rada za odgojitelja. Pregled po djetetu je hipoteza H-06 u planu validacije. |
| N-08 | Rječnik uvodi `specialist`, arhitektura i matrica `staff_other`; matrica upozorava da se te uloge ne smiju spajati. | glossary, roles, architecture | **DD-05:** MVP uloge su `platform_admin`, `org_admin`, `director`, `educator`, `guardian`. `staff_other`/`specialist` se **ne implementiraju u MVP-u** (bez računa, bez pristupa). Jelovnik objavljuje uprava. |
| N-09 | Razlika `org_admin` i `director` nije definirana, a matrica im daje različite dozvole bez obrazloženja. | roles | **A-03:** u MVP-u obje uloge imaju isti skup dozvola ("uprava vrtića"); razdvajanje nakon intervjua (Q-T09). Matrica nije mijenjana — razlike ostaju kao prijedlog za validaciju. |
| N-10 | Matrica: odgojitelj ne smije prijaviti izostanak, ali u praksi roditelj često javi telefonom odgojitelju. | roles, user-journeys | Ćelija promijenjena u **Otvoreno** (= Ne do validacije); pitanje u planu validacije (H-04). |
| N-11 | MVP opseg stavlja jelovnik u *Must* uz uvjet "ako vrtići potvrde" — uvjetni Must je zapravo *Should*. | mvp-scope | Jelovnik premješten u *Should*. |
| N-12 | Roadmap premješta **model privola u Fazu 7**, ali MVP opseg stavlja fotografije u *kasnije* → u MVP-u nema nijedne svrhe koja se temelji na privoli. | roadmap, mvp-scope | Eskalirano: **D-15** — graditi model privola tek kad prva svrha temeljena na privoli uđe u opseg. Potvrda o obavijesti o privatnosti **nije** privola. |
| N-13 | Putovanje "postavi sigurnu prijavu" i otvoreno pitanje "e-mail ili SMS" vs. ADR-0008 (e-mail pozivnica + e-mail OTP, bez SMS-a). | user-journeys, domain-model, ADR-0008 | **DD-06:** specifikacije slijede ADR-0008 (status *Proposed* — ovisnost o D-8). SMS izvan MVP-a. |
| N-14 | Dolazak vs. predaja/preuzimanje (domenski model, Q6) nije razriješen, a matrica i putovanja pretpostavljaju "osobu koja je dovela". | domain-model, roles | **DD-07:** jedan `attendance_event` s opcionalnom referencom na osobu predaje odabranu **s popisa** (skrbnik ili ovlaštena osoba); bez slobodnog teksta. |
| N-15 | Sidro razgovora (dijete / skupina / organizacija) otvoreno. | domain-model | **A-07:** razgovor je vezan uz **dijete** (skrbnici djeteta ↔ odgojitelji njegove trenutne skupine). Ovisi o D-10. |
| N-16 | Nije jasno treba li skrbnik i **članstvo** u organizaciji ili samo skrbničku vezu. | architecture, roles | **DD-08:** oboje. Članstvo (`role = guardian`) nosi status računa u tom vrtiću (deaktivacija, obavijesti organizacije); skrbnička veza nosi pristup djetetu. Bez skrbničke veze nema pristupa djetetu. |
| N-17 | Inventar podataka je dokument Faze 2, a specifikacija MVP-a ga treba sada. | privacy/README, roadmap | Inventar izrađen kao **v0** u Fazi 1; Faza 2 ga dovršava. `privacy/README.md` ažuriran. |
| N-18 | Isporuke Faze 1 u roadmapu ne navode funkcionalne specifikacije, kriterije prihvaćanja, inventar podataka ni plan validacije. | roadmap | Roadmap ažuriran. |
| N-19 | Rječnik definira `founding_authority` (osnivač), a nijedan model ga nema. | glossary, domain-model | Namjerno: osnivač **nije entitet u MVP-u** (nema računa ni pristupa). Napomena dodana u rječnik. |
| N-20 | Poslovno pravilo "fotografije se ne objavljuju javno u MVP-u" sugerira da su fotografije u MVP-u, a nisu. | business-rules | Pojašnjeno: fotografije su izvan MVP-a; pravilo vrijedi kad uđu u opseg. |
| N-21 | Nigdje nije pokriven zahtjev trgovina aplikacija za **brisanje računa iz aplikacije** (Apple App Store smjernica 5.1.1(v) — primjenjivost na račune kreirane pozivnicom treba provjeriti). | — | Dodano u FS-01 i Q-T10. |
| N-22 | Kategorija izostanka "bolest" mogla bi biti podatak o zdravlju (čl. 9) — nigdje nije adresirano. | business-rules, user-journeys | MVP prijava izostanka **bez razloga i bez slobodnog teksta**; ⚖️ Q-P16. |

## 2. Nedovršeni dijelovi (stanje prije ovog koraka)

| Područje | Stanje | Sada |
|---|---|---|
| PRD | nije postojao | `prd.md` v0.1 |
| Funkcionalne specifikacije | nisu postojale | `functional-specs.md` (FS-01…FS-15) |
| Kriteriji prihvaćanja | samo opći kriteriji faza | `acceptance-criteria.md` (Given/When/Then) |
| Inventar podataka | planiran za Fazu 2 | `../privacy/data-inventory.md` v0 |
| Plan validacije | samo checklista | `validation-plan.md` |
| Sljedivost | nije postojala | `traceability.md` |
| Katalog dozvola | nedostaju ključevi za objekte, ped. godinu, kalendar, račun | dopunjen u `roles-and-permissions.md` §7 |

## 3. Duplicirane odluke — kanonski izvor

Ista odluka zapisana je na više mjesta. Ne brišemo ponavljanja (čitljivost), ali **kanonski izvor je jedan**;
kod promjene se mijenja izvor, a ostala mjesta referenciraju ga.

| Odluka | Ponavlja se u | Kanonski izvor |
|---|---|---|
| Zdravstveni podaci izvan MVP-a | glossary, roles §6, business-rules, domain-model, mvp-scope, CLAUDE.md | **D-9** (`phase-status.md`) |
| Push bez osobnih podataka | ADR-0007, business-rules, nfr, risks R-07 | **ADR-0007** |
| Pristup iz trenutnih odnosa, bez dinamičnih JWT claimova | ADR-0005, roles §1, user-journeys, nfr | **ADR-0005** |
| RLS + kompozitni FK + negativni testovi | ADR-0004, roles §5/§8, nfr, CLAUDE.md | **ADR-0004** |
| Platform admin bez rutinskog pristupa djeci | ADR-0005, architecture §5, roles §4 | **ADR-0005** |
| Bez analitike u MVP-u | ADR-0007, nfr NFR-OBS-01 | **ADR-0007** |
| Kriterij zaključavanja MVP-a | mvp-scope, roadmap (tok V), phase-status | **`mvp-scope.md`** |

## 4. Provjera usklađenosti specifikacija (nakon izmjena)
Rezultat provjere funkcionalnih specifikacija prema domenskom modelu, ulogama i MVP opsegu nalazi se u
[traceability.md](traceability.md) §3.
