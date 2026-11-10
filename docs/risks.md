# Registar rizika

Vjerojatnost (V) i utjecaj (U): 1 (nisko) – 5 (visoko). Ocjena = V × U. Pregled na kraju svake faze.
Status: Otvoren / Ublažen / Prihvaćen / Zatvoren.

| ID | Rizik | Kategorija | V | U | Ocjena | Ublažavanje | Faza | Status |
|---|---|---|---|---|---|---|---|---|
| R-01 | Pristup podacima druge organizacije (cross-tenant) | Sigurnost | 3 | 5 | 15 | RLS na svim tablicama, kompozitni FK, CI provjera RLS-a, negativni pgTAP testovi (ADR-0004) | 5–7, 13 | Otvoren |
| R-02 | Neispravna kontrola pristupa / eskalacija privilegija | Sigurnost | 3 | 5 | 15 | Helper funkcije u DB-u, matrica dozvola kao izvor testova, review svake promjene politika (ADR-0005) | 6–7 | Otvoren |
| R-03 | Prijenos podataka izvan EU-a (US procesori: Supabase, Vercel, Sentry, Expo, Apple/Google push) | Privatnost/pravo | 4 | 4 | 16 | EU regije, DPA + SCC, procjena prijenosa, push bez PII, minimalni podaci po procesoru; izlazna opcija na EU hosting | 2–3 | Otvoren |
| R-04 | Roditelj vidi podatke tuđeg djeteta (uključujući grupne fotografije i poruke) | Privatnost | 3 | 5 | 15 | `can_view_child` u svim politikama, privole po označenom djetetu, testovi | 7, 10, 11 | Otvoren |
| R-05 | Odgojitelj pristupa djeci izvan svojih skupina / nakon kraja zamjene | Privatnost | 3 | 4 | 12 | Vremenski ograničeni rasporedi, pristup iz trenutnih odnosa | 7 | Otvoren |
| R-06 | Preuzimanje računa (phishing, slaba e-pošta, ponovljene lozinke) | Sigurnost | 3 | 4 | 12 | OTP, MFA za upravu, rate limit, popis uređaja, obavijest o novoj prijavi | 6 | Otvoren |
| R-07 | Curenje osjetljivih podataka kroz push obavijesti / zaključani ekran | Privatnost | 4 | 3 | 12 | Push bez osobnih podataka, automatizirani test payloada (ADR-0007) | 10 | Otvoren |
| R-08 | Osobni podaci u logovima, crash izvještajima, analitici | Privatnost | 4 | 3 | 12 | Scrubbing, bez analitike u MVP-u, bez session replaya, review logova | 5 | Otvoren |
| R-09 | Krađa sesije / izgubljeni ili zajednički uređaj odgojitelja | Sigurnost | 3 | 4 | 12 | Secure storage, kratke sesije za staff, daljinska odjava, odluka o uređajima (Q-T03) | 6 | Otvoren |
| R-10 | Zlouporaba iznutra (zaposlenik vrtića ili VrtićOS tima) | Sigurnost | 2 | 5 | 10 | Najmanje privilegije, bez trajnog pristupa platform admina, break-glass s auditom vidljivim vrtiću | 6, 12 | Otvoren |
| R-11 | Javno izložena pohrana medija | Sigurnost | 2 | 5 | 10 | Privatni bucketi, storage politike, testovi, kratki potpisani URL-ovi | 11 | Otvoren |
| R-12 | Premali tim / ovisnost o jednoj osobi i AI agentima | Isporuka | 4 | 4 | 16 | Male faze, dokumentirane odluke, CI kao zaštita, vanjski sigurnosni pregled prije produkcije | sve | Otvoren |
| R-13 | Odbijanje u App Storeu / Google Playu (aplikacije za djecu, privatnost, prijava) | Isporuka | 2 | 3 | 6 | App nije "za djecu" (korisnici su odrasli); točne privacy labels; demo račun za review | 14 | Otvoren |
| R-14 | **Nema validiranog kupca** — gradimo pogrešan proizvod ili nema plaćanja | Poslovni | 4 | 5 | 20 | Tok V: razgovori s vrtićima i DPO-om prije Faze 5; pismo namjere | V | Otvoren |
| R-15 | Zlonamjerne datoteke (upload) | Sigurnost | 2 | 3 | 6 | Whitelist MIME, re-encoding slika, limit veličine, bez izvršnih datoteka | 11 | Otvoren |
| R-16 | Tajne u repozitoriju ili klijentu (`service_role`) | Sigurnost | 2 | 5 | 10 | Secret scanning u CI-u, `.env.example`, pre-commit hook, nikad `service_role` u klijentu | 5 | Otvoren |
| R-17 | Napad kroz lanac opskrbe (npm paketi, skillovi, hookovi) | Sigurnost | 3 | 4 | 12 | Pinane verzije, lockfile review, Renovate s odgodom, pregled skillova prije instalacije | 0, 5 | Otvoren |
| R-18 | Javna nabava: dug prodajni ciklus, pragovi, e-račun (B2G) | Poslovni | 4 | 3 | 12 | Razumjeti jednostavnu nabavu i proračun osnivača rano (tok V) | V | Otvoren |
| R-19 | Neispunjavanje obveza pristupačnosti za javni sektor (NN 17/19, EN 301 549) | Pravo/UX | 3 | 3 | 9 | WCAG 2.2 AA od Faze 4, izjava o pristupačnosti | 4, 13 | Otvoren |
| R-20 | Zdravstveni podaci (alergije, lijekovi) "ušunjaju" se kroz slobodne tekstualne polja | Privatnost | 4 | 4 | 16 | Bez slobodnih polja o djetetu u MVP-u gdje nije nužno; upute odgojiteljima; odluka D-9 | 7, 9 | Otvoren |
| R-21 | Sporni odnosi skrbništva (sudske odluke, razvodi, udomiteljstvo) | Privatnost/pravo | 3 | 5 | 15 | `access_restricted`, procedura za vrtić, pravni pregled (Q-P11) | 7 | Otvoren |
| R-22 | Gubitak podataka / neuspjeli restore | Operativni | 2 | 5 | 10 | PITR, redoviti test povrata, dokumentiran RPO/RTO | 13 | Otvoren |
| R-23 | Mrežna ograničenja razvojnog okruženja blokiraju alate (npr. impeccable.style) | Isporuka | 3 | 1 | 3 | Instalacija iz službenog git repozitorija uz provjeru checksumova | 0 | Ublažen |
| R-24 | Odgojitelji ne usvajaju aplikaciju (dodatni posao, privatni telefoni) | Poslovni | 3 | 5 | 15 | Odgojitelj je primarni korisnik; testiranje prototipa; mjeriti vrijeme zadataka | 1, 4 | Otvoren |
| R-25 | Lažni osjećaj sigurnosti: roditelji ili vrtić se oslanjaju na aplikaciju za kritične informacije (hitni slučajevi, izostanci, preuzimanje) | Sigurnost djeteta | 3 | 4 | 12 | Bez "hitnih" obavijesti u MVP-u (FR-07-6); potvrda "poslano", ne "odobreno"; rezervni postupci vrtića; aplikacija ne zamjenjuje fizičku provjeru preuzimanja | 1, 8, 14 | Otvoren |
| R-26 | Specifikacija napisana prije validacije učvrsti pogrešne pretpostavke | Isporuka | 4 | 3 | 12 | Sve pretpostavke označene (PRD §9, A-xx); plan validacije s pravilima odlučivanja; MVP se ne zaključava bez ≥ 3 razgovora | 1 | Otvoren |
| R-27 | Slobodni tekst (obavijesti, dnevni pregled, poruke) sadrži imena drugih djece ili zdravstvene podatke | Privatnost | 4 | 3 | 12 | Upozorenja autorima, pravila vrtića, kratki rokovi čuvanja, poruke označene R4; bez automatske AI analize | 9, 10 | Otvoren |
| R-28 | Potpisani URL je token nositelja: proslijeđen ili zapisan URL daje pristup do isteka i ne može se pojedinačno opozvati | Sigurnost | 3 | 4 | 12 | Kratko trajanje, izdavanje tek nakon provjere ovlasti, brisanje izvoza nakon preuzimanja, URL-ovi izvan logova (SR-STO-03/04); playbook P-09 | 5, 11, 12 | Otvoren |
| R-29 | Kompromitiran kanal OTA ažuriranja mobilne aplikacije šalje zlonamjeran kod na sve uređaje | Sigurnost | 2 | 5 | 10 | Potpisivanje ažuriranja i odbijanje nepotpisanih (SR-SUP-03), odobrenje objave, playbook P-06 | 5, 14 | Otvoren |
| R-30 | Pozivnica ili skrbnička veza pogrešnoj osobi otkriva dijete nepozvanoj osobi | Privatnost | 3 | 5 | 15 | Pozivnica bez podataka o djetetu, brz opoziv, opcija koda predanog u vrtiću (Q-S11), playbook P-03 | 6, 7 | Otvoren |
| R-31 | Operativni pristup tima kroz konzolu dobavljača (SQL editor, backup) zaobilazi RLS i audit aplikacije | Sigurnost/insajder | 2 | 5 | 10 | Imenovane osobe s MFA, procedura s dva para očiju i zapisom (SR-OPS-03/04), Q-S06 | 5, 14 | Otvoren |
| R-32 | Kratko zadržavanje logova kod dobavljača onemogućuje istragu incidenta | Operativni | 3 | 3 | 9 | Izvoz logova u EU pohranu, odluka o roku (SR-LOG-03, Q-S08); prvi korak istrage: izvoz logova | 5, 14 | Otvoren |
| R-33 | Zlouporaba push tokena za lažne obavijesti (phishing roditelja) | Sigurnost | 2 | 3 | 6 | Slanje samo s poslužitelja uz pristupni token (SR-PUSH-02); tokeni nedostupni drugim korisnicima | 10 | Otvoren |
| R-34 | XSS u admin webu krade sesiju uprave (pristup svim podacima vrtića) | Sigurnost | 3 | 5 | 15 | Renderiranje teksta bez HTML-a, stroga CSP, MFA/AAL2, tokeni izvan `localStorage` gdje je izvedivo (SR-WEB-01/02, SR-SESS-01) | 5, 6, 13 | Otvoren |
| R-35 | Supabase-specifične zamke zaobilaze RLS: `SECURITY DEFINER` funkcije u izloženoj shemi, viewovi bez `security_invoker`, `EXECUTE` za PUBLIC, politike na `user_metadata` | Sigurnost | 3 | 5 | 15 | Statička provjera kataloga u CI-u (ST-RLS-00), pravila SR-API-01/02, SR-TEN-06, SR-AUTHZ-08 | 5 | Otvoren |
| R-36 | Uloge za odgovor na incident nisu imenovane; mali tim → spor odgovor ili odgovor jedne osobe bez provjere | Operativni | 4 | 4 | 16 | Imenovati uloge i zamjenike (Q-S07), dvije osobe za SEV-1, tabletop vježba prije pilota (P13-1) | 14 | Otvoren |
