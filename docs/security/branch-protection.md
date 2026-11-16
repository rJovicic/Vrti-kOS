# Zaštita grane `main` (D-27, rizik R-45)

- Datum provjere: 2026-11-16 · Stanje: **ruleset aktivan** (`main-protection`, ID 27104632, stvoren 2026-11-12) —
  R-45 **ublažen**, zatvara se nakon vlasnikove potvrde prazne liste iznimaka.
- Pravilo za uvoz: [`.github/rulesets/main-protection.json`](../../.github/rulesets/main-protection.json).
- Potpun dokaz, iznimke i prijedlozi pojačanja: [product/decision-followup.md](../product/decision-followup.md) §5.

## Provjereno stanje (javni GitHub REST API, 2026-11-16, bez autentikacije)
| Upit | Rezultat |
|---|---|
| `GET /repos/rJovicic/Vrti-kOS/rulesets` | jedan ruleset `main-protection`, `enforcement: active` |
| `GET /repos/rJovicic/Vrti-kOS/rulesets/27104632` | cilj `~DEFAULT_BRANCH`, bez isključenja; pravila `deletion`, `non_fast_forward`, `pull_request` (0 odobrenja, razriješeni razgovori), `required_status_checks` (4 provjere, `integration_id` 15368, `strict: false`); `bypass_actors: []` |
| `GET /repos/rJovicic/Vrti-kOS/rules/branches/main` | ista četiri pravila primijenjena na `main` |
| `GET /repos/rJovicic/Vrti-kOS/branches/main/protection` | 404 „Branch not protected” — klasična zaštita grane se ne koristi (zaštita je kroz ruleset) |

Pravila su jednaka datoteci u repozitoriju. **Nije potvrđeno:** lista iznimaka — neautenticirani odgovor nije
pouzdan dokaz da je prazna; vlasnik je treba potvrditi u *Settings → Rules → Rulesets → main-protection → Bypass list*.

### Povijest
2026-11-12: sesija je kroz popis grana vidjela `protected: false` i nije imala alat za postavljanje rulesetova
(GitHub MCP bez tog API-ja, `gh` samo za pretraživanje). Ruleset je uveden istog dana (10:26 CET), ali to se u
dokumentaciji nije odrazilo do provjere 2026-11-16.

## Model (nalog vlasnika od 2026-11-12)
| Pravilo | Vrijednost | Razlog |
|---|---|---|
| Promjene u `main` | samo kroz pull request | nema izravnih pushova, ni za vlasnika |
| Obvezne provjere | sva četiri CI posla (nazivi ispod) | nazivi preuzeti iz stvarnih jobova (GitHub Actions run #12, #14) |
| Force push | zabranjen (`non_fast_forward`) | povijest se ne prepisuje |
| Brisanje grane | zabranjeno (`deletion`) | |
| Razgovori na PR-u | moraju biti razriješeni (`required_review_thread_resolution`) | |
| Odobrenje druge osobe | **ne traži se** (0) | projekt trenutačno ima jednog aktivnog održavatelja |
| Ažurna grana prije spajanja | ne traži se (`strict: false`) | da ne blokira vlasnika bez sigurnosne koristi; CI se ionako pokreće na PR-u |
| Iznimke (bypass) | nema | |

Točni nazivi provjera (job `name` iz `.github/workflows/ci.yml`, potvrđeni u GitHub Actions):
- `lint · typecheck · unit tests`
- `database · migrations · RLS · integration · e2e`
- `admin build · mobile bundle`
- `secrets · dependencies`

`integration_id` 15368 je aplikacija GitHub Actions. Provjera tako mora doći baš iz GitHub Actions, a ne iz
bilo kojeg drugog izvora koji bi postavio status s istim imenom.

## Ručni koraci za vlasnika
1. GitHub → repozitorij → **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.
2. Odabrati `.github/rulesets/main-protection.json` → **Create**. Ruleset se zove `main-protection`, cilj je
   zadana grana, a stanje je **Active**.
3. Alternativa bez uvoza: **New branch ruleset** i ručno postaviti vrijednosti iz tablice iznad. U okviru
   „Require status checks to pass” dodati četiri provjere i odabrati izvor *GitHub Actions*.
4. (Izvedeno 2026-11-12; provjereno 2026-11-16 — vidi gore.) Preostaje potvrda prazne liste iznimaka.

## Posljedice
- Vlasnik i dalje spaja sam, ali samo kroz PR sa zelenim CI-jem.
- Pushevi na radne grane (`claude/*`) nisu pogođeni.
- Ako se naziv CI posla promijeni, treba uskladiti i ruleset. Inače PR čeka provjeru koja nikad ne stiže.
