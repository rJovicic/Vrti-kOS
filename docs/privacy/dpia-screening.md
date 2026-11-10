# DPIA screening — nacrt v0 (Faza 0)

> ⚠️ Tehnički nacrt, ne pravni zaključak. ⚖️ Konačnu odluku o obvezi DPIA donosi **voditelj obrade (vrtić)**
> uz savjet svog DPO-a (čl. 35(2)). VrtićOS kao izvršitelj pomaže (čl. 28(3)(f)).

## Opis obrade (preliminarno)
Digitalna komunikacija i operativna evidencija vrtića: podaci o djeci (identifikacija, skupina, dolasci,
izostanci, dnevni pregledi, fotografije), skrbnicima (kontakt, odnos s djetetom), djelatnicima (uloga,
raspored), poruke, obavijesti, revizijski zapisi. ~1.000 djece, ~3.000 računa, ~10 organizacija na početku.

## Kriteriji EDPB/WP29 (WP248 rev.01) — preliminarna procjena

| # | Kriterij | Ispunjen? | Obrazloženje |
|---|---|---|---|
| 1 | Evaluacija ili bodovanje | **Moguće** | Opažanja o razvoju/ponašanju djeteta, ako uđu u opseg (Q-P13) |
| 2 | Automatizirano odlučivanje s pravnim učinkom | Ne | Nije planirano |
| 3 | Sustavno praćenje | **Moguće** | Svakodnevna evidencija dolazaka/odlazaka i aktivnosti djece |
| 4 | Osjetljivi podaci ili podaci vrlo osobne prirode | **Moguće / vjerojatno** | Fotografije djece; zdravstveni podaci ako se uvedu alergije (D-9); poruke mogu sadržavati osjetljive informacije |
| 5 | Obrada velikog opsega | Nejasno | ~1.000 djece regionalno — vjerojatno ne "velik opseg" u početku, raste s rastom |
| 6 | Povezivanje skupova podataka | Ne / nisko | — |
| 7 | **Ranjivi ispitanici** | **Da** | Djeca (uvodna izjava 75); također zaposlenici u odnosu na poslodavca |
| 8 | Inovativna tehnologija | Nisko | Standardna SaaS tehnologija; bez AI/biometrije (isključeno) |
| 9 | Obrada sprječava ostvarivanje prava/usluge | Moguće | Ako je aplikacija jedini kanal komunikacije vrtića s roditeljima |

Smjernica WP248: obrada koja ispunjava **dva ili više** kriterija u pravilu zahtijeva DPIA.

## Preliminarni zaključak
Najmanje kriterij 7 je ispunjen sigurno, a 3 i 4 vrlo vjerojatno → **DPIA je vjerojatno obvezna i u svakom
slučaju preporučena.** Planiramo je kao obveznu isporuku Faze 2 i uvjet za Fazu 14.

## Za provjeru ⚖️
- AZOP-ov popis vrsta postupaka obrade koji podliježu zahtjevu za procjenu učinka (čl. 35(4)) — provjeriti
  stavke koje se odnose na djecu, sustavno praćenje i lokacijske/evidencijske podatke.
- Je li za cijeli sektor prikladna jedna zajednička DPIA (čl. 35(1) "skup sličnih postupaka") koju VrtićOS
  priprema kao predložak, a svaki vrtić je prilagođava i odobrava.

## Odluke koje smanjuju rizik već u arhitekturi
Bez biometrije/AI/profiliranja; bez zdravstvenih podataka u MVP-u; push bez osobnih podataka; privatni mediji
s privolom po djetetu; najmanji skup atributa djeteta; zadana retencija; bez stvarnih podataka u razvoju.
