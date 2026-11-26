# Pre-pilot nalazi (staging) — registar

Prioriteti i pravila: [iphone-safari-test-plan.md §2](iphone-safari-test-plan.md#2-klasifikacija-nalaza).
P0 = sigurnost/privatnost (odmah) · P1 = blokira ključnu funkciju (prije pilota) · P2 = radi uz zaobilazak · P3 = kozmetika.
`[web]` = samo Safari web pregled (nije pilot kanal).

## Otvoreni

| ID | Datum | Prioritet | Područje | Nalaz | Dokaz | Prijedlog popravka | Stanje |
|---|---|---|---|---|---|---|---|
| F-03 | 2026-11-26 | P1 (pilot) | Prijava / e-pošta | Staging nema pružatelja e-pošte: `rate_limit_email_sent` = 2/h za cijeli projekt, `smtp_max_frequency` = 60 s po adresi. Kad Auth odbije slanje, aplikacija (ispravno, R-42) prelazi na unos koda, ali kod nikad ne stigne — stvarni korisnik bi ostao zaglavljen bez objašnjenja | `hosted-config check`: `auth.rate_limit_email_sent` actual 2; `/config/auth` `smtp_max_frequency=60` | ADR-0010 (Scaleway TEM / Brevo) prije pilota; na ekranu koda tekst „Kod može stići za minutu. Ako ne stigne, zatražite novi za 60 s.” (ne otkriva postoji li račun) | Otvoreno — čeka odluku o pružatelju (već na popisu) |
| F-04 | 2026-11-26 | — (dijagnoza) | MFA uprave | `uprava.alfa` ima jedan potvrđeni TOTP faktor stvoren 2026-11-19 14:33 UTC; `ravnateljica.alfa`, `uprava.beta`, `platforma` nemaju nijedan. Ako vlasnik nema taj TOTP unos, ne može se prijaviti kao `uprava.alfa` | Read-only upit `auth.mfa_factors` (samo brojevi i vremena) | Zasebna dijagnoza prije bilo kakve promjene (vlasnikova uputa). Test koristi `ravnateljica.alfa` kao zamjenu | Otvoreno — ništa nije mijenjano |

## Riješeni / bez promjene proizvoda

| ID | Datum | Prioritet | Područje | Nalaz | Ishod |
|---|---|---|---|---|---|
| F-01 | 2026-11-26 | P3 (samo test) | CI | CI #89: mobile-web e2e „guardian: sees own children only” pao — test se prijavi kroz API pa odmah kroz web; Auth unutar intervala odbije drugi kod, aplikacija od `5679336` nastavlja bez novog koda (R-42), test pročita već iskorišten kod (prozor `before = now − 1 s`) | Popravljeno u `48cafc5` (pauza 2,5 s). Preporuka (niski prioritet): robusniji `signIn` u testu — čekati poštu noviju od zadnje postojeće za tu adresu umjesto fiksne pauze |
| F-02 | 2026-11-26 | — | CI | CI #88 nije pao nego je otkazan (novi push #89 na istu granu) | Nema radnje |
| F-05 | 2026-11-26 | — | Podaci | Korisnici Alfe ne vide `privacy_notices`, Bete vide | Namjerno u seedu (samo Beta ima DEMO obavijest) — nije greška |

## Ručni test iPhone Safari

| ID | Scenarij | Datum/vrijeme | Račun | ✅/❌ | Opis / snimka | Prioritet |
|---|---|---|---|---|---|---|
| | | | | | | |
