# Nefunkcionalni zahtjevi (NFR) — nacrt v0.1

**Status:** početni ciljevi za validaciju; nisu SLA niti ugovorno obećanje.

## Sigurnost i privatnost
- NFR-SEC-01: tenant izolacija mora biti provedena u bazi, ne samo u sučelju.
- NFR-SEC-02: sve izložene tenant tablice imaju RLS i negativne testove.
- NFR-SEC-03: privilegirani ključevi nikad nisu u mobilnom/web klijentu.
- NFR-SEC-04: privilegirane radnje su auditirane; audit ne pohranjuje nepotreban sadržaj.
- NFR-SEC-05: push, logovi, crash izvještaji i analitika ne sadrže PII djece.
- NFR-SEC-06: privatni mediji dostupni su samo nakon autorizacije; URL-ovi kratko vrijede.
- NFR-SEC-07: pristup se temelji na aktualnim odnosima i odmah prestaje kad odnos završi.
- NFR-PRIV-01: svaki atribut ima svrhu, kategoriju, pristup, rok čuvanja i vlasnika odluke.
- NFR-PRIV-02: razvoj i test koriste samo sintetičke podatke.
- NFR-PRIV-03: podržati prava ispitanika i retenciju prije produkcije.

## Performanse i kapacitet
- NFR-PERF-01: tipične roditeljske stranice ciljano se učitavaju unutar 2 s na stabilnoj 4G/Wi-Fi vezi (p95, cilj koji treba potvrditi).
- NFR-PERF-02: odgojitelj može evidentirati dolazak 20 djece u manje od 30 s u prototipu i pilot testu.
- NFR-PERF-03: tipični API zahtjevi cilj p95 < 500 ms, bez hladnih startova u kritičnom jutarnjem toku gdje je moguće.
- NFR-PERF-04: početni kapacitet: 10 organizacija, 1.000 djece i 3.000 računa; testirati s najmanje 2× očekivanim vršnim opterećenjem.
- NFR-PERF-05: slike se optimiziraju prije pohrane; ograničiti veličinu i broj uploadova.

## Dostupnost i otpornost
- NFR-REL-01: ciljna dostupnost za pilot 99,5% mjesečno, ne ugovorni SLA.
- NFR-REL-02: kritični jutarnji tok ima definirani rezervni ručni postupak.
- NFR-REL-03: ponovljeni zahtjevi za dolaske/izostanke su idempotentni.
- NFR-REL-04: offline podrška ograničena je na odobreni red čekanja; puna offline sinkronizacija nije MVP.
- NFR-REL-05: prije produkcije definirati i dokazati RPO/RTO i restore postupak.

## Upotrebljivost i pristupačnost
- NFR-UX-01: roditelj može pronaći dnevne informacije bez uputa.
- NFR-UX-02: glavni zadaci imaju jasna stanja loading, empty, error, success i offline.
- NFR-A11Y-01: cilj WCAG 2.2 AA za admin web i relevantne EN 301 549 zahtjeve; mobilna aplikacija prati platform accessibility smjernice.
- NFR-A11Y-02: podržati VoiceOver/TalkBack, dinamički tekst, semantičke oznake i dovoljan kontrast.
- NFR-A11Y-03: hrvatski dijakritici i lokalizirani format datuma/vremena; talijanski jezik kasnije.

## Održavanje i operacije
- NFR-MAINT-01: TypeScript strict; migracije su jedini način promjene sheme.
- NFR-MAINT-02: CI provodi lint, typecheck, testove, RLS provjere, secret i dependency scanning.
- NFR-OBS-01: bez session replaya i bez analitike u MVP-u; error monitoring uz PII scrubbing.
- NFR-OPS-01: odvojeni local/staging/production projekti i tajne.
- NFR-OPS-02: dokumentirani incident response, podrška, backup i restore prije pilota.

## Otvoreno
Vrijednosti dostupnosti/perf p95, RPO/RTO, offline očekivanja, stariji Android uređaji, pristupačnost javnog sektora, podrška i SLA moraju se potvrditi s kupcima i pružateljima.