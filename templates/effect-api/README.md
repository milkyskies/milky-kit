# templates/effect-api

Paradigm-complete Effect-TS API. The most capable template in milky-kit — schema-driven boundaries enable HTTP + OpenAPI + typed RPC client + MCP server from one definition.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| HTTP server | ✓ | `@effect/platform` `HttpApi` + Bun runtime |
| OpenAPI spec (auto) | ✓ | derived from `HttpApi` via `HttpApiSwagger.layer` |
| Swagger UI | ✓ | mounted at `/docs` in dev |
| Type-safe RPC client | ✓ | `HttpApiClient.make(PostsApi)` |
| MCP server | ✓ | `@effect/ai` `McpServer` over stdio |
| Typed error channel | ✓ | `Data.TaggedError` + `Effect<A, E, R>` |
| Schema-driven decode/encode | ✓ | `Schema.Class` on domain models |
| Layer + Context DI | ✓ | no middleware containers |
| Postgres via Drizzle | ✓ | `@effect/sql-drizzle` + `@effect/sql-pg` |
| Transactions | ✓ | `SqlClient.withTransaction` |
| Config + Redacted secrets | ✓ | `Config.redacted("DATABASE_URL")` |
| Effect.log + Effect.withSpan | ✓ | structured logging, spans for tracing |
| `@effect/vitest` | ✓ | `it.effect`, `TestClock`, Layer.succeed mocks |
| Worker / Cloudflare deploy | partial | swap `BunHttpServer.layer` for `HttpPlatform.layer` + Workers adapter |
| GraphQL | ✗ | not in template; add `@effect/platform-node` + a schema-first lib |

## Stack

- **Runtime**: Bun (swap to Node by replacing `@effect/platform-bun` with `@effect/platform-node`)
- **Language**: TypeScript with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **HTTP**: `@effect/platform`'s `HttpApi`
- **DB**: Postgres + Drizzle (schema), `@effect/sql-drizzle` (runtime), `drizzle-kit` (migrations)
- **MCP**: `@effect/ai` `McpServer` + `AiToolkit`
- **Test**: `vitest` + `@effect/vitest`
- **Lint**: `@biomejs/biome` extending `@milkyskies/biome-config`

## Directory layout

```
apps/{{app_name}}/
├── src/
│   ├── domain/
│   │   ├── models/         Schema.Class entities (Post)
│   │   ├── repositories/   Context.Tag interfaces + tagged errors
│   │   └── services/       Pure multi-entity / cross-cutting services
│   ├── application/
│   │   └── use-case/       Effect.gen orchestrations (createPost, getPost, listPosts)
│   ├── infrastructure/
│   │   ├── config.ts       Config-based env loading with Redacted secrets
│   │   ├── logger.ts       Logger Layer (pretty for dev, json for prod)
│   │   └── db/
│   │       ├── schema.ts        Drizzle table definitions
│   │       ├── sql-live.ts      PgClient.layer
│   │       └── post-repository.ts  Layer.effect over @effect/sql-drizzle
│   ├── presentation/
│   │   ├── http/
│   │   │   ├── api.ts           HttpApi definition
│   │   │   ├── post-handlers.ts Thin handlers calling use cases
│   │   │   └── server.ts        Server Layer composition
│   │   └── mcp/
│   │       ├── post-tools.ts    AiToolkit + handlers (same use cases)
│   │       └── server.ts        McpServer Layer (stdio)
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

Then `http://localhost:3000/api/docs` for Swagger UI.

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
