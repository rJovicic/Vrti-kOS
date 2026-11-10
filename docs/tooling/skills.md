# Skillovi — instalirani i preporučeni

Datum provjere: 2026-11-10. Metapodaci provjereni iz primarnih izvora (npm registry, plitki git klon
službenog repozitorija: datum zadnjeg commita, LICENSE, sadržaj). GitHub API nije bio dostupan u okruženju,
pa broj zvjezdica/održavatelja nije provjeren osim gdje je navedeno.

## Instalirano (project-local, `.claude/skills/`)

| Skill | Izvor | Verzija | Licenca | Kako instalirano | Napomene |
|---|---|---|---|---|---|
| **impeccable** | [pbakaus/impeccable](https://github.com/pbakaus/impeccable), autor Paul Bakaus | 4.8.2 (tag `skill-v4.8.2`, engine 0.1.21) | Apache-2.0 | `npx impeccable install` nije uspio (mrežna politika blokira `impeccable.style`), pa je kopiran `.claude/skills/impeccable` iz službenog repozitorija na tagu `skill-v4.8.2`. Native engine iz npm paketa `@impeccable/cli-linux-x64@0.1.21`, **SHA-256 provjeren** prema `engine-checksums.txt`. Binarni engine je gitignored. | Telemetrija isključena (`~/.impeccable/config.json`). Hookovi **nisu uključeni** — čeka odobrenje (D-11). |
| **ui-ux-pro-max** | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill); npm `ui-ux-pro-max-cli` (maintainer *mrgoonie*) | CLI 2.15.0 | MIT | `npx ui-ux-pro-max-cli@2.15.0 init --ai claude --offline` (bundled assets, bez mreže) | Installer je dodao još 6 skillova (banner-design, brand, design, design-system, slides, ui-styling). **Uklonjeni** jer se preklapaju s Impeccableom (tokeni/DESIGN.md) ili su izvan opsega (banneri, slajdovi, generiranje logotipa preko Gemini API-ja). Napomena: stariji paket `uipro-cli` je zastario. |

### Rezultati provjere
- Impeccable: `engine-probe` → `impeccable-engine 0.1.21`; `detect` na testnom HTML-u pronašao 10 anti-uzoraka
  (gradient text, low contrast 1.6:1, glow, tiny text…); simulirani `PostToolUse` hook vratio ispravan JSON
  s 4 nalaza; `hooks status` → nije wired. Claude Code je registrirao skill (`impeccable` vidljiv u sesiji).
- **Ograničenje:** na `.tsx` datotekama detektor radi samo regex provjere; puna analiza traži renderirani
  HTML ili dev server URL. Za React Native (bez DOM-a) hook ima ograničenu vrijednost; za Next.js admin
  koristan je `impeccable detect http://localhost:PORT`.
- UI UX Pro Max: `search.py` radi za domene (ux, style, color…) i stackove `react-native` (RN 0.86) i
  `nextjs` (Next.js 16.2); `--design-system` generira prijedlog. Za VrtićOS je predložio claymorphism,
  rozu paletu i font Fredoka — **odbačeno** kao previše "dječje" i u suprotnosti s brendom. Koristimo ga kao
  referentnu bazu (stack/UX smjernice), ne kao generator identiteta.

### Hook definicije (pregledano, nije uključeno)
`/impeccable hooks on` bi zapisao u `.claude/settings.local.json` tri hooka koji pokreću
`.claude/skills/impeccable/scripts/impeccable hook`: `SessionStart` (5 s), `PostToolUse` za `Edit|Write`
(5 s), `Stop` (30 s, dubinska provjera). Hook **ne blokira** izmjene — samo dodaje podsjetnik u kontekst.
Engine se izvršava **bez sandboxa** s pravima agenta. `settings.local.json` je lokalan po developeru
(u cloud sesijama se gubi); trajna aktivacija traži commit u `.claude/settings.json`.
**Preporuka:** uključiti na početku Faze 4/5 kada postoji UI kod; sada nema što provjeravati.

## Već dostupno u ovoj sesiji (bez instalacije)
Superpowers plugin (TDD, verification-before-completion, systematic-debugging, code review),
ugrađeni `/security-review` i `/code-review`, Supabase/Vercel/Figma MCP konektori.
Zato ne predlažem dodatne skillove za općenito testiranje i code review.

## Preporučeni dodatni skillovi (minimalni skup — **ništa nije instalirano**, čeka D-12)

| # | Skill | Izvor / autor | Licenca | Zadnji commit | Što radi | Zašto VrtićOS | Sigurnost | Preklapanje | Instalacija (kad se odobri) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **supabase** + **supabase-postgres-best-practices** | [supabase/agent-skills](https://github.com/supabase/agent-skills) — Supabase (službeno) | MIT | 2026-10-02 | Supabase Auth/RLS/Storage/Edge Functions smjernice; Postgres performanse, indeksi, RLS | Jezgra našeg backenda i RLS-a | Samo Markdown, 0 izvršnih skripti | Nema | `npx skills add supabase/agent-skills` (ili kopija iz pregledanog klona u `.claude/skills/`) |
| 2 | **Expo skills** (odabrani: expo-router, expo-project-structure, expo-data-fetching, expo-upgrade, eas-update, eas-app-stores) | [expo/skills](https://github.com/expo/skills) — Expo / 650 Industries (službeno) | MIT | 2026-11-01 | Expo Router, struktura, EAS build/update/store | Mobilna aplikacija | Markdown; neki skillovi vode na plaćene EAS usluge | Djelomično s #3 | `/plugin marketplace add expo/skills` → instalirati samo odabrane |
| 3 | **react-native-best-practices** | [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) — Callstack | MIT | 2026-10-08 | RN performanse, profiliranje, liste, memorija | Performanse na starijim Android uređajima | Markdown (6.5 MB, slike); 0 skripti | Djelomično s #2, ui-ux-pro-max | kopija `skills/react-native-best-practices` |
| 4 | **react-best-practices** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) — Vercel | MIT | 2026-10-27 | React/Next.js performanse (waterfalls, bundle, re-render) | Admin (Next.js) | Markdown; 0 skripti | Djelomično s ui-ux-pro-max `nextjs` | `npx skills add vercel-labs/agent-skills --skill react-best-practices` |
| 5 | **supply-chain-risk-auditor** (+ kasnije **static-analysis**: Semgrep/CodeQL) | [trailofbits/skills](https://github.com/trailofbits/skills) — Trail of Bits | CC-BY-SA-4.0 | 2026-11-06 | Audit ovisnosti: advisories, napušteni paketi, install skripte | R-17 lanac opskrbe | Pokreće alate (Bash) — pregledati prije | Nema | `/plugin marketplace add trailofbits/skills` → samo ova dva; **Faza 5** |

Napomena za Next.js: službeni Next.js skillovi su premješteni u `vercel/next.js` repozitorij, a referentno
znanje Next.js 16.3+ isporučuje kroz `AGENTS.md` koji generira `next dev` — zato nema zasebnog Next.js skilla.

### Područja bez preporučenog skilla (namjerno)
- **GDPR / privatnost:** pronađeni su samo skillovi pojedinačnih autora iz zajednice (npr. *mukul975/privacy-data-protection-skills*,
  *alirezarezvani/claude-skills gdpr-dsgvo-expert*); nisu provjereni ni održavani od pouzdanog izdavača.
  Rizik od pogrešnih "pravnih" zaključaka je veći od koristi. Koristimo vlastite dokumente + EDPB/AZOP smjernice + pravnika.
  Opcionalno za pregled: GDPR skill u `github/awesome-copilot` (GitHub) kao referenca, ne kao autoritet.
- **OWASP / threat modeling:** nema službenog OWASP skilla. Koristimo ugrađeni `/security-review`, vlastiti
  threat model (Faza 2) i ASVS/MASVS kontrolne liste.
- **Pristupačnost:** pokriveno Impeccableom (audit) i ui-ux-pro-max (UX smjernice) + axe/Lighthouse u CI-u.
- **CI/CD:** Callstack `github-actions` skill — razmotriti u Fazi 5, ne sada.
