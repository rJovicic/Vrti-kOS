# Plan validacije proizvoda i intervjua

**Verzija:** 0.1 · **Datum:** 2026-11-10 · **Tok:** V (validacija s kupcima) · **Status:** spreman za izvedbu; nijedan razgovor još nije održan.
**Veze:** [prd.md](prd.md) §9 (pretpostavke), [discovery-checklist.md](discovery-checklist.md), [mvp-scope.md](mvp-scope.md) (kriterij zaključavanja).

## 1. Cilj
Prije zaključavanja MVP-a i ulaska u tehničku arhitekturu (Faza 3) potvrditi ili srušiti: postoji li problem,
tko ga ima, koji moduli su stvarno potrebni, može li javni vrtić kupiti i koristiti VrtićOS, i koji su uvjeti
DPO-a za izvršitelja obrade.

**Princip intervjua:** pitamo o prošlom ponašanju i stvarnim situacijama ("kad ste zadnji put…"), ne o
mišljenju o našoj ideji ("biste li koristili…"). U prvom dijelu razgovora proizvod se **ne prezentira**.

## 2. Hipoteze i signali

| ID | Hipoteza | Metoda | Potvrđuje | Ruši |
|---|---|---|---|---|
| H-01 | Obavijesti i komunikacija s roditeljima idu kroz privatne Viber/WhatsApp grupe i to vrtiću stvara problem (kontrola, privatnost, opterećenje odgojitelja) | intervju R, O, DPO | ≥ 2 od 3 vrtića opisuju konkretan problem iz zadnjih mjesec dana | vrtić već ima službeni kanal kojim je zadovoljan |
| H-02 | Evidencija dolazaka je ručna i oduzima vrijeme odgojiteljima/upravi | intervju O, R; promatranje | opisano mjerljivo vrijeme ili ponovni rad (npr. prepisivanje) | evidencija je brza i nikome ne treba digitalna |
| H-03 | Točnost evidencije je važnija od brzine (nema "svi prisutni") | intervju O | odgojitelji opisuju posljedice pogrešne evidencije | odgojitelji traže skupno označavanje i prihvaćaju rizik |
| H-04 | Izostanci se javljaju odgojitelju telefonom; razlog nije potreban vrtiću | intervju O, R | vrtić ne koristi razlog izostanka ni za što | razlog/bolest je potreban (npr. umanjenje cijene) → pravna procjena Q-P16 |
| H-05 | Roditelji žele znati je li dijete stiglo/otišlo | intervju roditelja (opcionalno), O | roditelji to danas pitaju ili traže | nebitno → FR-05-9 postaje Could |
| H-06 | Dnevni pregled na razini skupine je dovoljan | intervju O, roditelji | roditelje zanima "što je skupina radila", a vrtić ne želi pojedinačne bilješke | jasna potreba za podacima po djetetu (obroci, spavanje) → nova procjena podataka |
| H-07 | Odgojitelji imaju uređaj koji smiju koristiti za posao | intervju O, R | službeni tablet/telefon ili jasno pravilo za osobni | nema uređaja → zajednički tablet režim / odgoda |
| H-08 | Razgovor skrbnik ↔ tim skupine je prihvatljiv model (ne 1:1 s odgojiteljem) | intervju O, R | odgojitelji ne žele osobni kanal; vrtić želi kontrolu | jaka potreba za privatnim 1:1 ili nikakvim porukama |
| H-09 | Ravnatelj može pokrenuti pilot i nabavu (jednostavna nabava) bez osnivača | intervju R | jasan put i budžet za pilot | odluka je kod osnivača/grada → drugačija prodaja |
| H-10 | DPO prihvaća EU hosting kod US-matičnog pružatelja uz DPA/SCC | razgovor DPO | uvjeti su ispunjivi dokumentacijom | traži isključivo EU pružatelje → revizija ADR-0003/0006/0007 |
| H-11 | Uprava ne mora čitati poruke skrbnika i odgojitelja | intervju R, DPO | uprava je zadovoljna eskalacijom na zahtjev | uprava traži uvid u sve → pravna procjena Q-T16 |
| H-12 | Vrtić bi platio (ili osnivač) cijenu u rasponu koji treba istražiti | intervju R | spremnost razgovarati o cijeni i pilotu | nema budžeta ni puta do njega |

## 3. Sudionici
| Skupina | Broj (cilj) | Zašto | Trajanje |
|---|---|---|---|
| Ravnatelji javnih vrtića u Istri | 3–5 | kupac, nabava, opseg | 45 min |
| Odgojitelji (primarni korisnik) | 5–8, iz ≥ 2 vrtića | dnevni poslovi, uređaji, vrijeme | 30–40 min + 15 min promatranja (ako vrtić dopusti) |
| DPO javnog vrtića | 1–2 | uvjeti za izvršitelja, DPIA, procesori | 45 min |
| Roditelji (opcionalno) | 3–5 | H-05, H-06, način komunikacije | 20 min |

**Regrutacija:** osobni kontakti vlasnika, kontakt ravnatelja e-poštom s kratkim opisom svrhe razgovora (istraživanje,
ne prodaja). Odgojitelje i roditelje kontaktirati **preko vrtića**, uz suglasnost ravnatelja.
Odgojitelje intervjuirati odvojeno od ravnatelja kad je moguće (iskreniji odgovori o opterećenju).

## 4. Vodiči za razgovor

### 4.1 Ravnatelj (45 min)
1. Uvod (2 min): tko smo, svrha, trajanje, kako bilježimo (§6), mogućnost odbijanja pitanja.
2. Kontekst (5 min): broj objekata, skupina, djece, djelatnika; tko radi administraciju.
3. **Komunikacija s roditeljima (10 min):** kako je izgledala zadnja važna obavijest roditeljima? Kojim kanalom? Što je pošlo krivo? Tko upravlja Viber/WhatsApp grupama i čiji su brojevi? (H-01, H-11)
4. **Dolasci i izostanci (10 min):** kako danas znate koliko je djece u vrtiću? Kako roditelj javlja izostanak? Koristi li se razlog izostanka za nešto (prehrana, cijena)? (H-02, H-04)
5. Postojeći alati i integracije (5 min): softver, upisi, naplata, tko ih je nabavio (Q-T04).
6. **Odluka i nabava (8 min):** kako ste zadnji put nabavili softver ili uslugu? Tko odobrava? Postoji li budžet? Što bi trebalo za pilot? (H-09, H-12, A-08)
7. Privatnost (3 min): tko je vaš DPO, kako postupate s novim dobavljačima? Možemo li razgovarati s DPO-om? (V-3)
8. Tek na kraju (2 min): kratko pokazati opseg MVP-a; pitati "što od ovoga ne biste koristili?".

### 4.2 Odgojitelj (30–40 min)
1. Uvod i suglasnost (2 min).
2. **Jučerašnji dan (10 min):** proći jučerašnje jutro i popodne — dolasci, predaja djece, poruke roditelja, papiri.
3. Evidencija (7 min): gdje se bilježi, koliko traje, što se dogodi kad je pogrešna? Skupno vs. pojedinačno (H-02, H-03).
4. Izostanci i poruke (7 min): kako roditelji javljaju? Na čiji broj? Javljaju li izvan radnog vremena? Što bi bilo bolje — kanal s timom skupine ili s vama osobno? (H-04, H-07, H-08)
5. Uređaji (4 min): koristite li osobni telefon za posao? Postoji li službeni tablet? Smijete li? (H-07, Q-T03)
6. Dnevni pregled (5 min): što roditelji pitaju na kraju dana? Što od toga biste rado pisali, a što ne? (H-06)
7. Zaključak: "Što bi vam uštedjelo najviše vremena?" (bez prezentacije rješenja).

**Promatranje (ako dopušteno):** samo tijek rada i vrijeme koraka; **bez fotografiranja, snimanja i bilježenja imena djece.**

### 4.3 DPO (45 min)
1. Kako vrtić danas procjenjuje nove dobavljače koji obrađuju podatke o djeci?
2. Smatrate li da bi VrtićOS bio izvršitelj obrade? Postoje li tokovi u kojima to ne bi bio? (Q-P01) — slušamo, ne zaključujemo.
3. Koju pravnu osnovu vrtić danas koristi za evidenciju djece i komunikaciju s roditeljima? (Q-P02)
4. Uvjeti za podizvršitelje izvan EU-a / US-matične tvrtke s EU hostingom (H-10, Q-P07, Q-P08).
5. Očekivanja za DPIA: tko je radi, treba li predložak od nas? (Q-P06)
6. Rokovi čuvanja koje vrtić već primjenjuje (Q-P09, Q-P10).
7. Fotografije i privole: kako to vrtić danas radi? (Q-P04)
8. Sporna skrb i ograničenja (Q-P11); zahtjevi ispitanika — koliko ih ima?
9. Rokovi obavještavanja o povredi koje bi tražili u DPA (Q-P15).

### 4.4 Roditelj (opcionalno, 20 min)
Kako saznajete što se događa u vrtiću? Zadnji put kad ste javljali izostanak? Što vas brine kod aplikacija za vrtić
(privatnost, fotografije)? Što biste htjeli znati na kraju dana? (H-05, H-06)

## 5. Testiranje prototipa (Faza 4, nakon intervjua)
- 3–5 odgojitelja, 3–5 roditelja; klikabilni prototip sa **sintetičkim** podacima.
- Zadaci: evidentirati dolazak 20 djece; ispraviti pogrešan unos; prijaviti izostanak za 3 dana; pronaći današnju obavijest;
  objasniti tko vidi poruku.
- Mjere: vrijeme zadatka (cilj iz NFR-PERF-02), broj grešaka, razumijevanje vidljivosti (AC-11-1), SUS upitnik (opcionalno).

## 6. Etika i zaštita podataka sudionika (obvezno)
- Prije razgovora usmeno/pisano objasniti svrhu, što bilježimo, koliko čuvamo i pravo da se povuku.
- **Ne bilježiti podatke o djeci** (imena, situacije koje identificiraju dijete); ako ih sudionik spomene — ne zapisivati.
- Bilježiti uloge, ne imena, gdje je moguće ("Ravnatelj, vrtić A"). Ime i kontakt samo u odvojenom popisu kontakata.
- Bez audio/video snimanja osim uz izričit pristanak; snimke brisati nakon transkripcije sažetka.
- Pohrana bilježaka: [otvoreno — alat, DI-28]; ne u javnom repozitoriju. U repozitorij ide samo
  **anonimizirani sažetak** (`discovery-interviews.md`).
- Uloga VrtićOS-a za ove podatke ⚖️ (vjerojatno voditelj obrade) — kratka obavijest sudionicima potrebna.

## 7. Sinteza i pravila odlučivanja
Nakon svakog razgovora: sažetak u predlošku (problem, trenutno rješenje, citati bez imena, signali za H-xx).
Nakon ≥ 3 vrtića:

| Ishod | Posljedica |
|---|---|
| H-01 i H-02 potvrđene | MVP Must ostaje; nastavak u Fazu 2/3 |
| H-01 potvrđena, H-02 srušena | Dolasci padaju na Should; komunikacija (FS-07, FS-11) postaje jezgra |
| H-02 potvrđena, H-01 srušena | Fokus na operativu (FS-05, FS-06, FS-14) |
| Obje srušene | **Stop** — preispitati proizvod prije daljnjeg ulaganja |
| H-09 ili H-12 srušena | Preispitati poslovni model i kupca prije Faze 3 |
| H-10 srušena | Nova ADR odluka o EU pružateljima prije Faze 3 |

## 8. Isporuke
- `docs/product/discovery-interviews.md` — anonimizirani sažeci i matrica hipoteza (nakon razgovora).
- Ažurirani `prd.md` (status pretpostavki), `mvp-scope.md` (zaključan opseg), `open-questions.md`.
- Pisani iskaz interesa za pilot (izvan repozitorija; u repozitoriju samo činjenica da postoji).

## 9. Redoslijed (bez datuma)
1. Vlasnik potvrđuje plan i popis kontakata → 2. ravnatelji (2–3) → 3. odgojitelji istih vrtića →
4. DPO → 5. sinteza i odluka o opsegu → 6. preostali razgovori po potrebi → 7. zaključavanje MVP-a.
