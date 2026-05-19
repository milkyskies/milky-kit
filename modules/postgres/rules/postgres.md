---
paths:
  - "**/db/**/*.ts"
  - "**/db/**/*.rs"
  - "drizzle.config.ts"
  - "docker-compose.yml"
---

# Postgres + Effect

This module ships `docker-compose.yml` for a local Postgres instance and mise tasks for db lifecycle. For Effect-TS projects (`templates/effect-api`), use `@effect/sql-pg` and `@effect/sql-drizzle` for the runtime layer.

## Local Postgres via docker-compose

`docker-compose up -d` starts the local instance. `mise run db:up` is the wrapped version. The `.env.db` file ships sane defaults (`postgres://postgres:postgres@localhost:5432/dev`).

## Effect runtime: `@effect/sql-pg` + `@effect/sql-drizzle`

```ts
import { PgClient } from "@effect/sql-pg"
import { DrizzleDb } from "@effect/sql-drizzle/Pg"
import { Config, Layer } from "effect"

export const SqlLive = PgClient.layer({
  url: Config.redacted("DATABASE_URL"),
})

export const DbLive = DrizzleDb.layer.pipe(Layer.provide(SqlLive))
```

Repositories take `DrizzleDb` from `R` (Context.Tag) and use Drizzle queries — these return Effects, not Promises:

```ts
const findById = (id: string) =>
  Effect.gen(function* () {
    const db = yield* DrizzleDb
    return yield* db.select().from(postsTable).where(eq(postsTable.id, id)).pipe(
      Effect.map((rows) => Option.fromNullable(rows[0])),
      Effect.map(Option.map(fromRow)),
    )
  })
```

## Transactions

Multi-statement writes go through `SqlClient.withTransaction`:

```ts
const transfer = (from: AccountId, to: AccountId, amount: Money) =>
  Effect.gen(function* () {
    yield* debit(from, amount)
    yield* credit(to, amount)
  }).pipe(SqlClient.withTransaction)
```

Atomic, composable, and the transaction Effect carries the `SqlError` channel automatically.

## Connection lifecycle

`PgClient.layer` is `Layer.scoped` under the hood — the connection pool is acquired when the layer is built and released when the scope closes. For a typical HTTP server, that's "at app startup" → "at app shutdown." Per-request connection acquire is handled by the pool internally; you don't write middleware to do it.

## Migrations

`drizzle-kit` is the migration runner (CLI, runtime-agnostic):

```bash
mise run db:migrate    # apply pending migrations
mise run db:status     # show what's applied vs pending
```

Migration files live under `apps/api/drizzle/migrations/` (or wherever `drizzle.config.ts` points). The query runtime (`@effect/sql-drizzle`) reads the same Drizzle schema that `drizzle-kit` generates migrations from — single source of truth.

## Hyperdrive / Workers Postgres

For Workers deploys via Hyperdrive: `PgClient.layer({ url: Config.string("HYPERDRIVE_CONNECTION_STRING") })`. The pool's lifecycle is per-isolate; layers compose the same way.

## Don't

- Don't `Effect.tryPromise(() => db.select()...)`. Drizzle through `@effect/sql-drizzle` returns Effects natively.
- Don't read `process.env.DATABASE_URL` directly — use `Config.redacted("DATABASE_URL")`.
- Don't share a Drizzle client across processes; the Layer handles that.
