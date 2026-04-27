# {{project_name}} API

Hono + Cloudflare Workers + D1 + Drizzle.

## First-time setup

```bash
cd apps/api
pnpm install

# Generate the initial migration from src/infrastructure/db/schema.ts
pnpm db:generate

# Create the D1 database on Cloudflare and copy its id
pnpm wrangler d1 create {{project_name}}
# Paste the returned database_id into wrangler.jsonc

# Apply migrations to the local D1 (spawns a local SQLite file under .wrangler/)
pnpm db:migrate:local

# Run the dev server
pnpm dev
```

## Common tasks

| Task | Command |
|---|---|
| Start dev server | `pnpm dev` (or `mise run dev:api` from repo root) |
| Regenerate migration from schema | `pnpm db:generate` |
| Apply migrations locally | `pnpm db:migrate:local` |
| Apply migrations to remote D1 | `pnpm db:migrate:remote` |
| Regenerate Cloudflare binding types | `pnpm cf-typegen` |
| Deploy to Cloudflare | `pnpm deploy` |

## Layer layout

See `.claude/rules/hono-patterns.md` for full conventions.

```
src/
├── domain/          # pure: models (Effect Data.case + Option), repository interfaces
├── application/     # use cases — orchestration, no I/O imports
├── infrastructure/  # drizzle schema, D1 repository impls
└── presentation/    # Hono routes — thin handlers, edge conversions
```
