# VrtićOS — Dokument zahtjeva proizvoda (PRD)

**Verzija:** 0.1 (nacrt) · **Datum:** 2026-11-10 · **Faza:** 1 — Definicija proizvoda
**Status:** **nije validiran s kupcima.** Ovaj PRD je hipoteza o proizvodu napisana prije razgovora s
vrtićima (tok V nije započet). Zaključava se tek prema kriteriju u [mvp-scope.md](mvp-scope.md).

> Oznake: **[potvrđeno]** = vlasnikov brief ili odgovor vlasnika · **[pretpostavka A-xx]** = vidi §9 ·
> **[otvoreno Q-xx]** = [../open-questions.md](../open-questions.md) · ⚖️ = traži pravnika/DPO;
> ovaj dokument ne donosi pravne zaključke.

## 1. Sažetak
VrtićOS je platforma za komunikaciju i svakodnevnu operativu vrtića koja povezuje odgojitelje, roditelje
i upravu. MVP rješava **tri svakodnevna posla**: evidenciju dolazaka i odlazaka, prijavu izostanka i
službene obavijesti vrtića — uz sigurnu, vremenski točnu kontrolu tko smije vidjeti koje dijete.
Sve ostalo (poruke, dnevni pregled, jelovnik, kalendar, izvještaji) je *Should* i ulazi u MVP samo ako ga
validacija potvrdi. Fotografije su izvan MVP-a.

## 2. Problem [pretpostavka A-01]
Pretpostavljamo (nije provjereno intervjuima) da istarski javni vrtići danas:
- vode dolaske na papiru ili u tablicama, što je sporo i teško za pregled uprave;
- primaju izostanke telefonom, porukama ili usmeno, bez traga i u različitim kanalima;
- dijele obavijesti kroz privatne Viber/WhatsApp grupe ili oglasne ploče — bez kontrole tko je u grupi,
  na osobnim brojevima odgojitelja i izvan kontrole vrtića kao voditelja obrade.

Posljednja točka je hipoteza s najvećom potencijalnom vrijednošću (rizik privatnosti koji vrtić već ima),
ali mora se potvrditi (H-01, H-02 u [validation-plan.md](validation-plan.md)).

## 3. Ciljevi i ne-ciljevi

### Ciljevi MVP-a
| ID | Cilj | Mjera uspjeha pilota (prijedlog) |
|---|---|---|
| G-1 | Odgojitelj štedi vrijeme na evidenciji dolazaka | Dolazak skupine od 20 djece < 30 s (NFR-PERF-02); ≥ 80 % radnih dana evidentirano u aplikaciji tijekom pilota |
| G-2 | Roditelji imaju jedan pouzdan kanal za izostanke i obavijesti | ≥ 70 % aktivnih skrbnika aktivira račun u prva 2 tjedna; ≥ 60 % izostanaka prijavljeno kroz aplikaciju |
| G-3 | Vrtić može dokazati kontrolu pristupa podacima djece | 0 incidenata neovlaštenog pristupa; svi negativni testovi autorizacije prolaze; audit postoji za sve osjetljive radnje |
| G-4 | Uprava ima pregled bez ručnog prikupljanja | Ravnatelj vidi dnevno stanje dolazaka po skupinama bez poziva odgojiteljima |

Vrijednosti su **prijedlog za pilot**, ne obećanje kupcu; potvrđuju se u planu validacije.

### Ne-ciljevi MVP-a [potvrđeno: brief, D-9 prijedlog]
Zdravstveni podaci, alergije, lijekovi, dijagnoze; razvojne procjene i profiliranje; biometrija,
prepoznavanje lica, AI analiza djece ili sadržaja; javno dijeljenje; fotografije i mediji; plaćanja i
naplata; puna offline sinkronizacija; integracije s vanjskim sustavima; talijanski jezik (i18n pripremljen);
analitika ponašanja korisnika.

## 4. Korisnici i uloge
Detalji: [roles-and-permissions.md](roles-and-permissions.md), [user-journeys.md](user-journeys.md).

| Uloga (MVP) | Aplikacija | Primarni poslovi u MVP-u |
|---|---|---|
| Odgojitelj (`educator`) — **primarni korisnik** [potvrđeno] | mobilna | dolasci/odlasci, pregled izostanaka, obavijesti skupini (ako D-xx), dnevni pregled (Should) |
| Skrbnik (`guardian`) | mobilna | aktivacija, prijava izostanka, čitanje obavijesti, status dolaska djeteta |
| Ravnatelj (`director`) i administrator vrtića (`org_admin`) | web | struktura vrtića, djelatnici, djeca, skrbnici, obavijesti, pregled dolazaka, audit, zahtjevi ispitanika [A-03: isti skup dozvola u MVP-u] |
| Administrator platforme (`platform_admin`) | web | kreiranje vrtića i prvog administratora; **bez pristupa podacima djece** (ADR-0005) |
| Ostali djelatnici (`staff_other`, stručni suradnici) | — | **izvan MVP-a** (DD-05) |

## 5. Opseg MVP-a (MoSCoW, prijedlog v0.2)
Izvor opsega: [mvp-scope.md](mvp-scope.md). Specifikacije: [functional-specs.md](functional-specs.md).

| Prioritet | Modul | Spec |
|---|---|---|
| **Must** | Pozivnice, prijava, sesije, brisanje računa | FS-01 |
| **Must** | Struktura vrtića: objekti, pedagoška godina, skupine | FS-02 |
| **Must** | Djelatnici: članstva, rasporedi, zamjene | FS-03 |
| **Must** | Djeca, upisi, skrbništvo, ograničenja pristupa, ovlaštene osobe za preuzimanje | FS-04 |
| **Must** | Dolasci i odlasci | FS-05 |
| **Must** | Prijava izostanka | FS-06 |
| **Must** | Obavijesti vrtića | FS-07 |
| **Must** | Push i obavijesti u aplikaciji (bez osobnih podataka) | FS-08 |
| **Must** | Revizijski zapis i osnovna administracija | FS-09 |
| **Must** (operativni minimum za produkciju) | Prava ispitanika i retencija | FS-15 |
| Should | Dnevni pregled skupine | FS-10 |
| Should | Razgovori skrbnik ↔ odgojitelji djeteta (ovisi o D-10) | FS-11 |
| Should | Jelovnik po objektu | FS-12 |
| Should | Kalendar događaja | FS-13 |
| Should | Pregled dolazaka za upravu (bez izvoza) | FS-14 |
| Could / kasnije | Fotografije i privole, izvoz izvještaja, potvrde pročitanosti, prilozi, talijanski | — |

**Zašto ovakav rez:** Must pokriva ono bez čega pilot nema smisla (identitet → struktura → dijete → dnevni
posao) i ono bez čega se ne smije u produkciju (audit, prava ispitanika, retencija). Should moduli neovisni
su jedni o drugima i mogu se dodavati pojedinačno nakon validacije.

## 6. Ključni tokovi MVP-a
1. **Postavljanje vrtića:** platform admin kreira vrtić → pozove prvog administratora → administrator unese
   objekte, pedagošku godinu, skupine, djelatnike i rasporede → unese djecu, upise i skrbnike → pošalje pozivnice.
2. **Aktivacija skrbnika:** pozivnica e-poštom → OTP → obavijest o privatnosti vrtića → vidi samo svoju djecu.
3. **Jutro u skupini:** odgojitelj otvori skupinu → vidi očekivanu djecu i prijavljene izostanke → evidentira dolaske.
4. **Izostanak:** skrbnik odabere dijete i datume → odgojitelji skupine dobiju obavijest bez osobnih podataka.
5. **Obavijest:** uprava objavi obavijest vrtiću/objektu/skupini → primatelji dobiju push bez sadržaja.
6. **Promjena:** premještaj djeteta ili kraj zamjene → pristup se mijenja odmah, povijest ostaje.

## 7. Zahtjevi
- Funkcionalni: [functional-specs.md](functional-specs.md); kriteriji prihvaćanja:
  [acceptance-criteria.md](acceptance-criteria.md).
- Nefunkcionalni: [nfr.md](nfr.md).
- Pravila: [business-rules.md](business-rules.md); domena: [domain-model.md](domain-model.md).
- Podaci: [../privacy/data-inventory.md](../privacy/data-inventory.md).
- Sljedivost: [traceability.md](traceability.md).

## 8. Privatnost i sigurnost u proizvodu
- Pristup se računa iz trenutnih odnosa (članstvo, raspored, upis, skrbništvo, ograničenje) — ADR-0005.
- Najmanji skup podataka o djetetu: ime, prezime, interna oznaka, upis. Datum rođenja, OIB, adresa,
  fotografija **nisu pretpostavljeni** [otvoreno Q-P03].
- Nema slobodnog teksta o djetetu u Must modulima (izostanak bez razloga — Q-P16).
- Push i e-pošta bez imena djece i sadržaja (ADR-0007).
- Uloga voditelja/izvršitelja, pravne osnove i rokovi čuvanja: ⚖️ otvoreno (Q-P01, Q-P02, Q-P09).
  Proizvod mora omogućiti da vrtić kao (pretpostavljeni) voditelj obrade konfigurira rokove čuvanja
  i izvršava prava ispitanika (FS-15).

## 9. Pretpostavke (moraju se validirati)
| ID | Pretpostavka | Kako validiramo | Ako je netočna |
|---|---|---|---|
| A-01 | Dolasci/izostanci/obavijesti danas su bolni i fragmentirani | intervjui H-01, H-02 | Preispitati vrijednosnu ponudu prije Faze 3 |
| A-02 | Odgojitelji imaju uređaj na kojem smiju koristiti aplikaciju | H-07, Q-T03 | Režim zajedničkog tableta ili odgoda mobilne app za staff |
| A-03 | `org_admin` i `director` mogu u MVP-u imati iste dozvole | intervju ravnatelja | Razdvojiti dozvole prije Faze 6 |
| A-04 | Skrbnici imaju e-poštu i pametni telefon | intervju, podaci vrtića | Uprava može evidentirati izostanak u ime skrbnika; papirni kanal ostaje |
| A-05 | Dnevni pregled na razini skupine je dovoljan | H-06 | Specificirati pregled po djetetu uz novu procjenu podataka |
| A-06 | Izostanak bez razloga je dovoljan vrtiću | H-04, Q-P16 | Dodati neutralne kategorije uz pravnu procjenu |
| A-07 | Razgovor je vezan uz dijete, ne uz pojedinog zaposlenika | H-08, D-10 | Preoblikovati FS-11 |
| A-08 | Vrtić kao javna ustanova može nabaviti SaaS kroz jednostavnu nabavu | V-4 | Promijeniti model prodaje/cijene |
| A-09 | Vrtić je voditelj, VrtićOS izvršitelj obrade ⚖️ | DPO, pravnik (Q-P01) | Preispitati DPA, obavijesti i odgovornosti |

## 10. Ovisnosti i odluke koje blokiraju zaključavanje
- Odluke vlasnika: D-3, D-6, D-7, D-8 (platforma, klijenti, procesori, prijava), D-9 (zdravstveni podaci),
  D-10 (model poruka), D-15 (model privola).
- Validacija: V-2 (≥ 3 vrtića), V-3 (DPO), pisani iskaz interesa za pilot.
- Pravni pregled ⚖️: Q-P01–Q-P16.

## 11. Rizici proizvoda
Glavni: R-14 (nema validiranog kupca), R-24 (odgojitelji ne usvoje aplikaciju), R-25 (lažni osjećaj
sigurnosti — aplikacija kao jedini kanal), R-20 (zdravstveni podaci kroz slobodan tekst). Vidi [../risks.md](../risks.md).

## 12. Povijest
| Verzija | Datum | Promjena |
|---|---|---|
| 0.1 | 2026-11-10 | Prvi nacrt na temelju briefa, nacrta Faze 1 i pregleda dosljednosti |
