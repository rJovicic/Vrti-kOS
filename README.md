# VrtićOS

Multi-tenant SaaS za vrtiće (iOS, Android, web administracija). **Lokalna demo verzija u izgradnji** —
samo sintetički podaci, nije spremno za produkciju.

## Brzi početak (lokalni demo)
Potrebno: Docker (pokrenut), Node.js 22, Corepack.

```bash
corepack enable
pnpm install
pnpm demo            # Supabase + Mailpit + migracije + sintetički seed + admin (localhost:3000) + Expo
```

- Admin: http://localhost:3000 · Mailpit: http://127.0.0.1:54324 · mobilno: Expo Go (QR kod u terminalu)
- Testovi: `pnpm lint && pnpm typecheck && pnpm test && pnpm db:test`
- Detalji i rješavanje problema: [docs/architecture/local-development.md](docs/architecture/local-development.md)

## Dokumentacija
[docs/README.md](docs/README.md) · Status: [docs/phase-status.md](docs/phase-status.md) · Dizajn: [DESIGN.md](DESIGN.md) ·
Prototip: [design/prototype/](design/prototype/)
