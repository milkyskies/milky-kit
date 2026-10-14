# templates/effect-api

Paradigm-complete Effect-TS API. The most capable template in milky-kit — schema-driven boundaries enable HTTP + OpenAPI + typed RPC client + MCP server from one definition.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| HTTP server | ✓ | `effect/http-api` `HttpApi` + Bun runtime |
| OpenAPI spec (auto) | ✓ | derived from `HttpApi`, served at `/api/openapi.json` |
| API docs page | ✓ | Scalar, mounted at `/api/docs` |
| Type-safe RPC client | ✓ | `HttpApiClient.make(Api)` |
| MCP server | ✓ | `effect/ai` `McpServer` over stdio and Streamable HTTP |
| Typed error channel | ✓ | `Data.TaggedError` + `Effect<A, E, R>` |
| Schema-driven decode/encode | ✓ | `Schema.Class` on domain models |
| Layer + Context DI | ✓ | no middleware containers |
| Postgres via Drizzle | ✓ | `drizzle-orm/effect-postgres` + `@effect/sql-pg` |
| Transactions | ✓ | `db.transaction((tx) => ...)` |
| Config + Redacted secrets | ✓ | `Config.Redacted("DATABASE_URL")` |
| Effect.log + Effect.withSpan | ✓ | structured logging, spans for tracing |
| `@effect/vitest` | ✓ | `it.effect`, `TestClock`, Layer.succeed mocks |
| Worker / Cloudflare deploy | partial | see "Cloudflare Workers" in `effect-http.md`; D1 has no transactions |
| GraphQL | ✗ | not in template; add a schema-first lib on top of `@effect/platform-node` |

## Stack

- **Runtime**: Bun (swap to Node by replacing `@effect/platform-bun` with `@effect/platform-node`)
- **Effect**: 4.x. `effect/http`, `effect/http-api`, `effect/sql`, and `effect/ai` ship inside the `effect` package.
- **Language**: TypeScript with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **HTTP**: `effect/http-api`'s `HttpApi`
- **DB**: Postgres + Drizzle (schema), `drizzle-orm/effect-postgres` over `@effect/sql-pg` (runtime), `drizzle-kit` (migrations). `drizzle-orm` and `drizzle-kit` are pinned exactly to `1.0.0-rc.5-5935859`.
- **MCP**: `effect/ai` `McpServer` + `Toolkit`
- **Test**: `vitest` + `@effect/vitest`, run under Bun
- **Lint**: `@biomejs/biome` extending `@milkyskies/biome-config`

## Directory layout

```
apps/{{app_name}}/
├── src/
│   ├── domain/
│   │   ├── models/         Schema.Class entities (Post)
│   │   ├── repositories/   Context.Service interfaces + tagged errors
│   │   └── services/       Pure multi-entity / cross-cutting services
│   ├── application/
│   │   └── use-case/       Effect.gen orchestrations (createPost, getPost, listPosts)
│   ├── infrastructure/
│   │   ├── config.ts       Config-based env loading with Redacted secrets
│   │   ├── logger.ts       Logger Layer (pretty for dev, json for prod)
│   │   └── db/
│   │       ├── schema.ts        Drizzle table definitions
│   │       ├── sql-live.ts      PgClient.layer
│   │       └── post-repository.ts  Layer.effect over drizzle-orm/effect-postgres
│   ├── presentation/
│   │   ├── http/
│   │   │   ├── api.ts           HttpApi definition
│   │   │   ├── post-handlers.ts Thin handlers calling use cases
│   │   │   └── server.ts        Server Layer composition
│   │   └── mcp/
│   │       ├── post-tools.ts    Tool + Toolkit + handlers (same use cases)
│   │       ├── toolkits.ts      McpServer.toolkit registrations
│   │       └── server.ts        McpServer layers (HTTP and stdio)
│   ├── app-live.ts         Composition root for HTTP entry
│   ├── main.ts             HTTP entry (BunRuntime.runMain)
│   └── main-mcp.ts         MCP entry (separate; stdio competes with logs)
├── drizzle/migrations/     drizzle-kit output
├── docker-compose.yml      Local Postgres
├── drizzle.config.ts
├── biome.json              extends @milkyskies/biome-config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## First-run

```bash
pnpm install
docker compose up -d
pnpm --filter '{{app_name}}' db:migrate
pnpm --filter '{{app_name}}' dev
```

Then `http://localhost:3000/api/docs` for the Scalar API docs.

Effect 4.0.4 is newer than pnpm's default `minimumReleaseAge` cooldown allows on its first day. If `pnpm install` refuses it, add `effect@4.0.4`, `@effect/platform-bun@4.0.4`, `@effect/sql-pg@4.0.4`, and `@effect/vitest@4.0.4` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and remove the entries once the cooldown has passed.

## MCP setup (Claude Code)

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "{{project_name}}-api": {
      "command": "bun",
      "args": ["run", "/abs/path/to/{{project_name}}/apps/{{app_name}}/src/main-mcp.ts"]
    }
  }
}
```

## The discipline

This template enforces several rules via the `effect.md` rule file. The load-bearing one:

> **Every operation is a use case in `application/use-case/`.**
> Presentation handlers are 3-line shims: parse input → call use case → return. Never inline business logic in HTTP handlers or MCP tools.

If you find yourself reaching for an `Effect.gen` block longer than 3 lines inside `presentation/`, extract a use case.
