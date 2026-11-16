# Registar podizvršitelja (nacrt)

> ⚠️ Tehnički i operativni nacrt, ne pravna potvrda. Stavke ⚖️ zahtijevaju pregled DPO-a vrtića ili pravnika.
> Vrtić je (vjerojatno) voditelj obrade, VrtićOS izvršitelj (Q-P01); svaki podizvršitelj traži prethodno ovlaštenje
> voditelja obrade (čl. 28(2) GDPR-a) i upis ovdje **prije** nego što primi ikakve podatke.

Stanje 2026-11-16. Lokalni demo i CI ne šalju ništa nijednom vanjskom pružatelju (pošta ide u lokalni Mailpit, push u
lažni adapter).

## 1. Odobreni, ali neaktivni

| Podizvršitelj | Svrha | Podaci koje bi primio | Lokacija / prijenos | Odluka | Stanje |
|---|---|---|---|---|---|
| **Expo (650 Industries, Inc.) — Expo Push Service** | posrednik za push obavijesti prema Appleu i Googleu | token uređaja (Expo push token), generički naslov i tekst po vrsti („Nova poruka”…), neprozirni ID obavijesti | SAD → **međunarodni prijenos** (čl. 44–49 GDPR-a) ⚖️ | D-40 (vlasnik, 2026-11-16): opcija A iz ADR-0007 | **Neaktivno.** Nema računa, vjerojatnica ni stvarnih uređaja; stvarni adapter u kodu odbija rad bez odobrene aktivacije i potvrđenog pravila dostave (Q-T05) |
| **Apple — Apple Push Notification service (APNs)** | dostava push obavijesti na iOS uređaje (neizbježno za iOS) | ono što Expo proslijedi: token uređaja i generički sadržaj | SAD/globalno ⚖️ | posljedica D-40 | neaktivno |
| **Google — Firebase Cloud Messaging (FCM)** | dostava push obavijesti na Android uređaje (neizbježno za Android) | ono što Expo proslijedi: token uređaja i generički sadržaj | SAD/globalno ⚖️ | posljedica D-40 | neaktivno |

**Što ovi pružatelji nikad ne primaju (osigurano kodom i testovima):** ime djeteta, skupine, pošiljatelja, naslov ili
tekst obavijesti, poruke ili dnevnog pregleda, bilo koji podatak o djetetu. Push tekst je generički po vrsti
(`packages/i18n/src/push.ts`, test ST-PUSH-01 na razini funkcije i kroz Edge Function u integracijskom testu).

## 2. Prije stvarne aktivacije push obavijesti — kontrolni popis (ništa od ovoga nije provjereno)
Popis je zadatak, ne tvrdnja: svaku stavku treba provjeriti u aktualnim dokumentima pružatelja na dan aktivacije.

1. ⚖️ **Ugovor o obradi (DPA)** s Expo-om: postoji li, tko ga potpisuje (VrtićOS kao izvršitelj), uključuje li popis
   Expo-ovih podizvršitelja (Apple, Google, hosting).
2. ⚖️ **Pravna osnova prijenosa u SAD:** je li Expo certificiran u okviru EU-US Data Privacy Framework ili se koriste
   standardne ugovorne klauzule (SCC); procjena učinka prijenosa (dokument #18 u indeksu, Q-P07).
3. **Uvjeti usluge i cijena** Expo Push Service na dan aktivacije (besplatnost, ograničenja, obvezni pristupni token).
4. **Koje podatke Expo pohranjuje i koliko dugo** (tokeni, potvrde isporuke / receipts, zapisi): upisati u inventar.
5. **Pristupni token za slanje** (Expo „enhanced security for push notifications”): obavezno uključiti, token samo u
   tajnama Edge Functiona, nikad u repozitoriju ni klijentu (SR-PUSH-02).
6. **Apple i Google:** uvjeti APNs/FCM-a za konfiguraciju aplikacije (vlasnik računa razvojnog programera).
7. **Q-T05** (tiho razdoblje za djelatnike, radno vrijeme): vlasnik potvrđuje pravilo; bez potvrđenog pravila stvarni
   adapter ne radi (kod: `assertRealAllowed`).
8. **DPIA:** dopuniti screening tokom push obavijesti (dokument #16/#17).
9. **Obavijest o privatnosti** za skrbnike i djelatnike: spomenuti push, posrednike i prijenos (dokumenti #6/#7).
10. **Retencija tokena:** potvrditi predloženih 60 dana neaktivnosti (`private.prune_push_tokens`) i zakazati čišćenje.

## 3. Planirani, još neodlučeni
| Područje | Odluka | Napomena |
|---|---|---|
| Transakcijska e-pošta | ADR-0010 / ADR-0007 (Proposed) | preporuka: pružatelj sa sjedištem u EU |
| Praćenje grešaka | ADR-0007 (Proposed) | preporuka: Sentry EU uz strogo čišćenje |
| Hosting baze (Supabase, EU regija) | ADR-0003 | produkcija nije odobrena |
