# templates/hono-api

Hono API on Cloudflare Workers (or Node) with Drizzle. Effect-flavored TypeScript — `Option`, `Match`, `Data.taggedEnum` for domain modeling — without the full Effect runtime overhead. Clean-architecture split: `domain/` → `application/use-case/` → `infrastructure/` → `presentation/`.

Designed for the cases where Effect's full Layer / Context machinery is overkill but you still want sum types, optional handling, and pattern matching done right.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| HTTP server | ✓ | Hono on Cloudflare Workers (or Node) |
| RPC client (typed) | ✓ | Hono's `hc<AppType>` — types flow from server to consumer |
| OpenAPI client | ✓ (variant) | `api_style: openapi` variant uses zod-OpenAPI + orval |
| Postgres | ✓ (variants: neon, supabase) | Drizzle + drizzle-kit |
| D1 (SQLite on Workers) | ✓ (variant: d1) | Drizzle + Wrangler |
| Firebase auth | ✓ (variant) | `auth: firebase` |
| Effect Schema / Option / Match | ✓ | imported piecewise, not as a runtime |
| Workers deploy | ✓ | Wrangler |
| Node deploy | ✓ | adapter swap in `src/main.ts` |
| MCP server | ✗ | use `effect-api` template if MCP matters |
| Full Effect runtime | ✗ | by design — use `effect-api` if you want `Effect<A, E, R>` everywhere |

## Variants

- **`db`**: `d1` (Workers + D1 SQLite), `neon` (Postgres pooled), `supabase` (Postgres + Supabase pooler)
- **`api_style`**: `rpc` (Hono RPC client, type-shared), `openapi` (zod-OpenAPI + orval for cross-language consumers)
- **`auth`**: `none`, `firebase`

## Stack

- **Runtime**: Cloudflare Workers (default) or Node
- **Language**: TypeScript with strict + `noUncheckedIndexedAccess`
- **HTTP**: Hono
- **DB**: Drizzle (schema + queries), drizzle-kit (migrations)
- **Domain modeling**: Effect's `Option`, `Match`, `Data.taggedEnum` (piecewise imports)
- **Test**: vitest
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
├── vitest.config.ts
└── wrangler.jsonc          Workers config (D1 binding, vars)
```

## First-run

```bash
pnpm install
# variant-specific DB bring-up:
#   d1:       wrangler d1 create {{project_name}}
#   neon:     create branch at console.neon.tech, set DATABASE_URL
#   supabase: docker compose up -d  (local Postgres)
pnpm --filter '{{app_name}}' db:migrate
pnpm --filter '{{app_name}}' dev
```

## The discipline

The `hono-patterns.md` rule file enforces the clean-architecture split:

> **`domain/` imports nothing from `infrastructure/` or `presentation/`.**
> **`application/use-case/` takes the repository as a parameter; never imports Hono.**
> **Handlers in `presentation/routes/` are 3-line shims** — parse, call use case, return.

Hono RPC types flow from `presentation/app.ts` through `apps/api/src/app.ts`'s `AppType` export. Frontend `apps/web/` can `import type { AppType } from '@{{project_name}}/api'` and use `hc<AppType>(baseUrl)` for fully-typed calls.
