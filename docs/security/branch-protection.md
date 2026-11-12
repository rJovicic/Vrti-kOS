# Zaštita grane `main` (D-27, rizik R-45)

- Datum: 2026-11-12 · Stanje: **nije postavljeno** — čeka radnju vlasnika repozitorija.
- Pravilo za uvoz: [`.github/rulesets/main-protection.json`](../../.github/rulesets/main-protection.json).

## Zašto ovo nije postavljeno automatski
Provjereno 2026-11-12 kroz GitHub API (popis grana): `main` ima `protected: false`. Radna sesija
nema alat za promjenu zaštite grana ni rulesetova:
- GitHub MCP alati nude čitanje i pisanje sadržaja, PR-ove i Actions, ali ne i rulesetove ni zaštitu grana;
- `gh` CLI u ovoj sesiji smije se koristiti samo za pretraživanje.

Zato je D-27 i dalje **otvoren**. Ne smije se označiti zatvorenim dok GitHub API ne pokaže aktivno pravilo.

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
4. Javiti završetak. Sljedeća sesija tada čita postavke i potvrđuje ih:
   - popis grana mora za `main` vratiti `protected: true`;
   - API `GET /repos/{owner}/{repo}/rules/branches/main` mora vratiti sva četiri pravila.

   Tek tada se D-27 i R-45 zatvaraju.

## Posljedice
- Vlasnik i dalje spaja sam, ali samo kroz PR sa zelenim CI-jem.
- Pushevi na radne grane (`claude/*`) nisu pogođeni.
- Ako se naziv CI posla promijeni, treba uskladiti i ruleset. Inače PR čeka provjeru koja nikad ne stiže.
