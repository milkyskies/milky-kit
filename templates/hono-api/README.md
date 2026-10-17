# templates/hono-api

Hono API on Cloudflare Workers or Bun, with Drizzle or with no database at all. Effect-flavored TypeScript — `Option`, `Match`, `Data.taggedEnum` for domain modeling — without the full Effect runtime overhead. Clean-architecture split: `domain/` → `application/use-case/` → `infrastructure/` → `presentation/`.

Designed for the cases where Effect's full Layer / Context machinery is overkill but you still want sum types, optional handling, and pattern matching done right.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| HTTP server | ✓ | Hono on Cloudflare Workers (`runtime: workers`) or Bun (`runtime: bun`) |
| RPC client (typed) | ✓ | Hono's `hc<AppType>` — types flow from server to consumer |
| OpenAPI client | ✓ (variant) | `api_style: openapi` variant uses zod-OpenAPI + orval |
| Postgres | ✓ (variants: neon, supabase) | Drizzle + drizzle-kit |
| No database | ✓ (variant: none) | no Drizzle, no migrations, no repositories; a status route stands in for the Post example |
| D1 (SQLite on Workers) | ✓ (variant: d1) | Drizzle + Wrangler |
| Firebase auth | ✓ (variant) | `auth: firebase` |
| Effect Schema / Option / Match | ✓ | imported piecewise, not as a runtime |
| Workers deploy | ✓ | Wrangler |
| Bun server | ✓ (variant: bun) | `Bun.serve` in `src/main.ts`, `bun test`, a `Dockerfile` on `oven/bun` |
| MCP server | ✗ | use `effect-api` template if MCP matters |
| Full Effect runtime | ✗ | by design — use `effect-api` if you want `Effect<A, E, R>` everywhere |

## Variants

- **`runtime`**: `workers` (Cloudflare Workers, Wrangler, vitest), `bun` (`Bun.serve`, `bun test`, Dockerfile)
- **`db`**: `d1` (Workers + D1 SQLite), `neon` (Postgres pooled), `supabase` (Postgres + Supabase pooler), `none` (no database layer)
- **`api_style`**: `rpc` (Hono RPC client, type-shared), `openapi` (zod-OpenAPI + orval for cross-language consumers)
- **`auth`**: `none`, `firebase`

Two combinations are constrained. `runtime: bun` needs `db: none` and `auth: none`, because the db variants bind through Wrangler and the firebase variant uses Workers KV. `db: none` needs `api_style: rpc`, because the OpenAPI variant has no status-route counterpart yet.

Variants overlay the base scaffold in this order: `runtime`, `api_style`, `auth`, `db`. The `db: none` overlay also lists the base example files it deletes under `[variants.db.none] remove` in `module.toml`.

## Stack

- **Runtime**: Cloudflare Workers (default) or Bun
- **Language**: TypeScript with strict + `noUncheckedIndexedAccess`
- **HTTP**: Hono
- **DB**: Drizzle (schema + queries), drizzle-kit (migrations); absent with `db: none`
- **Domain modeling**: Effect's `Option`, `Match`, `Data.taggedEnum` (piecewise imports)
- **Test**: vitest on Workers, `bun test` on Bun (both run the same `vitest` imports)
- **Lint**: `@biomejs/biome` extending `@milkyskies/biome-config`

## Directory layout

```
apps/{{app_name}}/
├── src/
│   ├── domain/
│   │   ├── models/         Data.taggedEnum + Option-backed entities
│   │   ├── repositories/   Repository interfaces (types, not Tags)
│   │   └── services/       Pure cross-cutting logic
│   ├── application/
│   │   └── use-case/       <verb>-<resource>.ts orchestrations
│   ├── infrastructure/
│   │   ├── env.ts          Bindings type (CORE + DB + AUTH bindings)
│   │   └── db/             Drizzle client + repository impls
│   └── presentation/
│       ├── app.ts          Hono app composition
│       ├── middleware/     repositories.ts injects repos per request
│       ├── routes/         <resource>-routes.ts per resource
│       └── dto/            <resource>-dto.ts (wire types + converters)
├── drizzle/migrations/     drizzle-kit output
├── biome.json              extends @milkyskies/biome-config
├── package.json
├── tsconfig.json
├── vitest.config.ts        runtime: workers
├── wrangler.jsonc          runtime: workers (D1 binding, vars)
├── src/main.ts             runtime: bun (Bun.serve entry)
└── .env.example            runtime: bun
```

With `db: none` the `domain/repositories/`, `infrastructure/db/`, `presentation/dto/` and `drizzle/` paths do not exist, and `presentation/middleware/repositories.ts` is gone. The layer split still holds: `domain/models/service-status.ts` → `application/use-case/get-status.ts` → `presentation/routes/status-routes.ts`. With `runtime: bun` a `Dockerfile` and `.dockerignore` land at the project root.

## First-run

Workers with a database:

```bash
pnpm install
# variant-specific DB bring-up:
#   d1:       wrangler d1 create {{project_name}}
#   neon:     create branch at console.neon.tech, set DATABASE_URL
#   supabase: docker compose up -d  (local Postgres)
pnpm --filter '{{app_name}}' db:migrate
pnpm --filter '{{app_name}}' dev
```

Bun with `db: none`:

```bash
pnpm install
cp apps/{{app_name}}/.env.example apps/{{app_name}}/.env
pnpm --filter '{{app_name}}' dev     # bun --hot src/main.ts
pnpm --filter '{{app_name}}' build   # bun build → dist/main.js
pnpm --filter '{{app_name}}' test    # bun test
```

## The discipline

The `hono-patterns.md` rule file enforces the clean-architecture split:

> **`domain/` imports nothing from `infrastructure/` or `presentation/`.**
> **`application/use-case/` takes the repository as a parameter; never imports Hono.**
> **Handlers in `presentation/routes/` are 3-line shims** — parse, call use case, return.

Hono RPC types flow from `presentation/app.ts` through `apps/api/src/app.ts`'s `AppType` export, and `@{{project_name}}/api/client` exports `createApiClient` (`hc<AppType>`) in every variant combination. Frontend `apps/web/` can `import type { AppType } from '@{{project_name}}/api'` and use `hc<AppType>(baseUrl)` for fully-typed calls.
