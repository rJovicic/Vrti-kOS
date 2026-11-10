# Status faza

**Trenutna faza:** FAZA 0 — Discovery i postavljanje → **dovršeno, čeka odobrenje vlasnika**
**Sljedeća predložena:** FAZA 1 — Arhitektura proizvoda (uz paralelni tok V — validacija s kupcima)
**Zadnje ažuriranje:** 2026-11-10

## ✅ Završeno
- Inspekcija repozitorija (prazan, samo README) i okruženja (Node 22.23, npm 10.9, pnpm 10.28, Python 3.13, Git 2.43, Claude Code 2.1.322)
- Impeccable 4.8.2 instaliran i provjeren (detektor, simulirani hook, registracija skilla); telemetrija isključena
- UI UX Pro Max 2.15.0 instaliran i provjeren (pretraga, design-system, RN i Next.js smjernice); suvišni skillovi uklonjeni
- Impeccable init intervju (4 pitanja) → `PRODUCT.md`
- Preporuka dodatnih skillova → [tooling/skills.md](tooling/skills.md)
- Roadmap po fazama → [roadmap.md](roadmap.md)
- Dokumentacijska struktura, `CLAUDE.md`
- Checklista otkrivanja zahtjeva → [product/discovery-checklist.md](product/discovery-checklist.md)
- Otvorena pitanja (privatnost, sigurnost, proizvod) → [open-questions.md](open-questions.md)
- Registar rizika (24 rizika) → [risks.md](risks.md)
- ADR 0001–0008 → [decisions/](decisions/)
- DPIA screening v0 → [privacy/dpia-screening.md](privacy/dpia-screening.md)

## 🔄 U tijeku
- Ništa (stop na checkpointu).

## ⛔ Blokirano
- `npx impeccable install` / `update` — `impeccable.style` blokiran mrežnom politikom okruženja (zaobiđeno instalacijom iz git taga).
- 17 od 18 privatnosnih dokumenata — ovise o Fazi 1 i odlukama o procesorima (namjerno, vidi [privacy/README.md](privacy/README.md)).

## ⏳ Čeka odobrenje vlasnika

| ID | Odluka | Preporuka | Dokument |
|---|---|---|---|
| D-1 | Izmjene strukture faza (tok V, model privola u F7, audit/i18n u F5–6…) | Prihvatiti | [roadmap.md](roadmap.md) |
| D-2 | Modularni monolit, pnpm + Turborepo monorepo | Prihvatiti | ADR-0002 |
| D-3 | Supabase Cloud, EU (Frankfurt) — plaćena usluga + podizvršitelj | Prihvatiti uvjetno (DPA, procjena prijenosa, PITR) | ADR-0003 |
| D-4 | Multi-tenancy: zajednička shema + RLS | Prihvatiti | ADR-0004 |
| D-5 | Autorizacija: uloge + relacijske provjere u Postgresu, bez trajnog pristupa platform admina | Prihvatiti | ADR-0005 |
| D-6 | Jedna Expo aplikacija + Next.js admin; hosting admina (Vercel fra1 vs EU host) | Jedna app + Next.js; hosting odlučiti nakon razgovora s DPO-om | ADR-0006 |
| D-7 | Push (Expo, bez PII), e-mail (EU pružatelj), Sentry EU sa scrubbingom, **bez analitike** | Prihvatiti | ADR-0007 |
| D-8 | Prijava: samo pozivnice, OTP za roditelje, obvezni MFA za upravu | Prihvatiti | ADR-0008 |
| D-9 | Zdravstveni podaci (alergije, lijekovi) **izvan MVP-a** | Prihvatiti | [open-questions.md](open-questions.md) Q-P12 |
| D-10 | Poruke kao razgovor roditelj ↔ tim skupine (ne privatni 1:1) | Validirati s vrtićima | Q-T05 |
| D-11 | Uključivanje Impeccable hookova (sada ili u Fazi 4/5) | Odgoditi do UI koda | [tooling/skills.md](tooling/skills.md) |
| D-12 | Instalacija preporučenih skillova (Supabase odmah; Expo/RN/React u F5; Trail of Bits u F5) | Supabase skill sada | [tooling/skills.md](tooling/skills.md) |
| D-13 | Ciljna razina OWASP ASVS L2; vanjski pentest prije pilota (plaćeno) | Prihvatiti | Q-S01, Q-S02 |
| D-14 | Odobrenje prelaska u Fazu 1 | — | — |

## Pravne/privatnosne odluke koje NE donosim umjesto vlasnika ⚖️
Uloge voditelj/izvršitelj po tokovima, pravne osnove, rokovi čuvanja, obveznost DPIA, prihvatljivost
US-matičnih procesora — vidi Q-P01…Q-P15.
