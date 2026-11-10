# Otvorena pitanja (prije implementacije)

Oznake: ⚖️ = treba hrvatski pravnik za GDPR / DPO / stručnjak za privatnost. 👤 = odgovor vlasnika.
🏫 = odgovor vrtića (tok validacije). Ništa ovdje nije pravni zaključak.

## Privatnost i GDPR (Q-P)

| ID | Pitanje | Tko | Zašto je važno |
|---|---|---|---|
| Q-P01 | Potvrđujemo li model: **vrtić = voditelj obrade, VrtićOS = izvršitelj** za sve tokove? Postoje li tokovi gdje je VrtićOS samostalni voditelj (npr. korisnički računi, sigurnosni logovi, naplata, marketing)? | ⚖️ | Određuje DPA, obavijesti i odgovornost |
| Q-P02 | Koja je pravna osnova vrtića za osnovnu evidenciju djece (čl. 6(1)(c)/(e) uz Zakon o predškolskom odgoju i obrazovanju i pravilnike o pedagoškoj dokumentaciji)? Pokriva li ta osnova i *digitalnu komunikaciju s roditeljima* ili za nju treba druga osnova? | ⚖️ | Privola za sve bi bila pogrešna (nije slobodna ako je usluga uvjetovana) |
| Q-P03 | Koji je minimalni skup podataka o djetetu? Trebamo li OIB, datum rođenja, adresu, fotografiju profila? | 🏫 ⚖️ | Minimizacija; OIB je visokorizičan identifikator |
| Q-P04 | Fotografije: privola roditelja po svrsi (unutarnje dijeljenje s roditeljima skupine vs. javna objava)? Što s grupnim fotografijama ako jedno dijete nema privolu? | ⚖️ 🏫 | Najčešći izvor pritužbi |
| Q-P05 | Kako vrtić provjerava identitet skrbnika prije slanja pozivnice? Treba li eID (NIAS)? | 🏫 ⚖️ | Pogrešan "roditelj" = katastrofalan incident |
| Q-P06 | Je li DPIA obvezna? (preliminarno: **vjerojatno da** — vidi `privacy/dpia-screening.md`). Provjeriti AZOP-ov popis vrsta obrade za koje je DPIA obvezna. | ⚖️ | DPIA mora biti dovršena prije produkcije |
| Q-P07 | Je li EU regija + SCC/DPF dovoljna za US-matične procesore (Supabase, Vercel, Sentry, Expo)? Status certifikacije pod EU-US Data Privacy Frameworkom treba **provjeriti**. | ⚖️ | Može promijeniti ADR-0003/0006/0007 |
| Q-P08 | Prihvaćaju li DPO-i istarskih vrtića (ili osnivači) US-matične podizvršitelje? | 🏫 | Izlazna strategija prema EU hostingu |
| Q-P09 | Rokovi čuvanja: dolasci, poruke, fotografije, dnevni izvještaji, audit logovi, računi nakon ispisa djeteta? Postoje li zakonski rokovi (pedagoška dokumentacija, arhivsko gradivo)? | ⚖️ 🏫 | Retencijska politika i automatsko brisanje |
| Q-P10 | Je li VrtićOS dio službene pedagoške dokumentacije (onda gradivo podliježe arhivskim propisima) ili samo komunikacijski alat? | 👤 ⚖️ | Mijenja opseg, rokove i odgovornost |
| Q-P11 | Kako postupati sa sudskim ograničenjima roditeljske skrbi, udomiteljstvom, Centrom za socijalnu skrb? | ⚖️ 🏫 | Sigurnost djeteta |
| Q-P12 | Alergije i prehrambena ograničenja: nužni za sigurnost (kuhinja, odgojitelji) — ali su zdravstveni podaci (čl. 9). U MVP ili ne? | 👤 ⚖️ | Preporuka: izvan MVP-a (D-9) |
| Q-P13 | Opažanja o razvoju djeteta — je li to "evaluacija" u smislu DPIA kriterija? Tko ih smije vidjeti? | ⚖️ 🏫 | Utječe na DPIA i dozvole |
| Q-P14 | Treba li VrtićOS imenovati vlastitog DPO-a (čl. 37(1)(b)/(c))? Vjerojatno ne obvezno, ali preporučljivo. | ⚖️ | Povjerenje kupaca |
| Q-P15 | Obavijesti o povredi: rokovi i kanal između izvršitelja i voditelja (čl. 33(2) "bez nepotrebnog odgađanja") — koliko sati ugovaramo? | ⚖️ | DPA i plan odgovora |
| Q-P16 | Je li razlog izostanka "bolest" (bez dijagnoze) podatak o zdravlju u smislu čl. 9? Treba li vrtiću razlog uopće (npr. umanjenje cijene uz liječničku potvrdu)? | ⚖️ 🏫 | MVP prijava izostanka je bez razloga (FS-06) |

## Sigurnost (Q-S)

| ID | Pitanje | Tko |
|---|---|---|
| Q-S01 | Ciljna razina OWASP ASVS: preporuka **L2** za aplikaciju s podacima o djeci. Prihvaćaš? | 👤 |
| Q-S02 | Vanjski penetracijski test prije pilota (plaćeno, ~nekoliko tisuća EUR) — u planu? | 👤 |
| Q-S03 | RPO/RTO ciljevi (preporuka pilot: RPO ≤ 15 min uz PITR, RTO ≤ 8 h)? | 👤 |
| Q-S04 | Primjenjuje li se Zakon o kibernetičkoj sigurnosti (NIS2) na VrtićOS ili vrtiće? (preliminarno: vjerojatno ne zbog veličine — provjeriti) | ⚖️ |
| Q-S05 | Tko ima administratorski pristup Supabase/Vercel/GitHub organizacijama? MFA obavezan? | 👤 |
| Q-S06 | Kako se kontrolira i auditira operativni pristup platform tima bazi (konzola pružatelja) kad u proizvodu nema break-glassa (FS-09)? Četiri oka, zapis, obavijest vrtiću? | 👤 ⚖️ |
| Q-S07 | Tko su osobe (i zamjenici) za uloge u incidentu: voditelj incidenta, tehnički voditelj, komunikacija? Postoji li dežurstvo u radnom vremenu vrtića (6–17 h)? | 👤 |
| Q-S08 | Koliko dugo dobavljači (Supabase plan, hosting) čuvaju logove i trebamo li izvoz logova u vlastitu EU pohranu? Koji rok čuvanja sigurnosnih logova (⚖️ uskladiti s retencijom)? | 👤 ⚖️ |
| Q-S09 | Ciljana vremena odgovora po razini incidenta (prijedlog u incidentnom planu §3) — interni cilj ili ugovorna obveza prema vrtiću? | 👤 ⚖️ |
| Q-S10 | Trajanje access tokena i treba li opoziv sesije djelovati odmah (provjera sesije u politikama, SR-SESS-04) uz cijenu dodatnog upita? | 👤 |
| Q-S11 | Treba li povezivanje skrbnika s djetetom uz e-mail pozivnicu tražiti i kod predan osobno u vrtiću (zaštita od pogrešne e-pošte, R-30)? | 👤 🏫 |
| Q-S12 | Treba li zaključavanje aplikacije za djelatnike (PIN/otključavanje uređaja nakon neaktivnosti)? Povezano s Q-T03. | 🏫 👤 |
| Q-S13 | Sigurnosni kontakt i postupak za prijavu ranjivosti (`security.txt`, odgovorno otkrivanje)? | 👤 |

## Proizvod i tehnologija (Q-T)

| ID | Pitanje | Tko |
|---|---|---|
| Q-T01 | Koji su stvarni dnevni poslovi odgojitelja danas (papir, Viber/WhatsApp, e-mail)? | 🏫 |
| Q-T02 | Koji MVP moduli? Prijedlog: dolasci/izostanci, obavijesti, dnevni pregled, poruke; fotografije u v1.1 | 👤 🏫 |
| Q-T03 | Odgojitelji: zajednički tableti vrtića ili osobni telefoni? (sigurnost sesije, MDM, privatnost zaposlenika) | 🏫 |
| Q-T04 | Postoji li postojeći softver vrtića/osnivača s kojim treba integracija (upisi, naplata, e-Upisi)? | 🏫 |
| Q-T05 | Poruke: 1:1 roditelj–odgojitelj ili razgovor roditelj–tim skupine? Radno vrijeme odgovaranja? | 🏫 👤 |
| Q-T06 | Model naplate i cijena (po djetetu/mjesečno? po vrtiću?) i tko plaća (vrtić, osnivač)? | 👤 |
| Q-T07 | Pravna osoba koja će biti izvršitelj obrade i ugovorna strana — postoji li? | 👤 |
| Q-T08 | Konkurencija: koji proizvodi se već koriste u Hrvatskoj/regiji? | 👤 (istraživanje) |
| Q-T09 | Razlika između uloga `org_admin` i `director` u praksi (tko unosi djecu, tko upravlja djelatnicima)? | 🏫 |
| Q-T10 | Primjenjuje li se zahtjev App Storea / Google Playa za brisanje računa iz aplikacije na račune kreirane pozivnicom? (MVP ga uključuje kao zahtjev, FR-01-9) | 👤 (provjera smjernica) |
| Q-T11 | Rok valjanosti pozivnice (prijedlog 7 dana) i postupak ponovnog slanja? | 🏫 |
| Q-T12 | Može li vrtić imati preklapanje dviju pedagoških godina (npr. ljetni program)? | 🏫 |
| Q-T13 | Koje podatke o ovlaštenoj osobi za preuzimanje vrtić treba (telefon, odnos)? Smije li skrbnik sam predlagati/uređivati popis? | 🏫 ⚖️ |
| Q-T14 | Do kada se javlja izostanak za isti dan i koliko unaprijed? Utječe li na prehranu/naplatu? | 🏫 |
| Q-T15 | Trebaju li potvrde pročitanosti obavijesti? (privatnost vs. potreba vrtića) | 🏫 |
| Q-T16 | Smije li uprava čitati razgovore skrbnika i odgojitelja (nadzor kvalitete vs. privatnost)? | 🏫 ⚖️ |
