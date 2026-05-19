# {{project_name}} API

Hono + Cloudflare Workers + Neon (Postgres) + Drizzle.

## First-time setup

```bash
cd apps/api
pnpm install

# 1. Create a Neon project at https://console.neon.tech and copy its connection string.

# 2. Save the URL for local dev (Wrangler reads .dev.vars):
echo 'DATABASE_URL = "postgres://..."' > .dev.vars

# 3. Save the URL for drizzle-kit (uses dotenv via shell):
echo 'DATABASE_URL=postgres://...' > .env

# 4. Generate the initial migration from src/infrastructure/db/schema.ts
pnpm db:generate

# 5. Apply migrations to Neon
pnpm db:migrate

# 6. Set the production secret on Cloudflare
pnpm wrangler secret put DATABASE_URL

# 7. Run the dev server
pnpm dev
```

## Common tasks

| Task | Command |
|---|---|
| Start dev server | `pnpm dev` (or `mise run dev:api` from repo root) |
| Regenerate migration from schema | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Regenerate Cloudflare binding types | `pnpm cf-typegen` |
| Deploy to Cloudflare | `pnpm deploy` |

## Layer layout

See `.claude/rules/hono-patterns.md` for full conventions.

```
src/
├── domain/          # pure: models (Effect Data.case + Option), repository interfaces
├── application/     # use cases — orchestration, no I/O imports
├── infrastructure/  # drizzle schema, Neon repository impls
└── presentation/    # Hono routes — thin handlers, edge conversions
```
