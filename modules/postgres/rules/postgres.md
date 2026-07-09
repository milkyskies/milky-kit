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

### Parallel branches: resolving a migration collision

Every `drizzle-kit generate` writes three files: the `NNNN_name.sql`, a `meta/NNNN_snapshot.json` whose `prevId` points at the previous snapshot, and an entry appended to the shared `meta/_journal.json`. The snapshot `prevId` chain and the journal are linear structures rebuilt from "what main looked like when I branched," so two branches that each add a migration off the same base will collide on all three — not just the filename. This is inherent to snapshot-based tools; a timestamp `prefix` removes the filename clash but the journal and snapshot chain still fork, so it does not avoid this recipe.

Never hand-merge `_journal.json` or a `*_snapshot.json`. Regenerate them from the merged schema:

1. `git merge origin/main`. The `.sql` files coexist; the two meta files conflict.
2. Take main's meta wholesale: `git checkout origin/main -- apps/api/drizzle/migrations/meta/`. Main never had your journal entry, so this drops it.
3. Delete your now-orphaned migration: `rm apps/api/drizzle/migrations/NNNN_yours.sql` (and its `meta/NNNN_snapshot.json` if the checkout left one behind).
4. Regenerate from `apps/api`: `pnpm db:generate`. It reads the merged `schema.ts` and writes a fresh migration at the next free index, with a correct `prevId` and journal entry.
5. Re-apply any hand-edits `generate` cannot infer — backfills, data moves, and the add-nullable/backfill/`SET NOT NULL` sequence for a `NOT NULL` column on a non-empty table (see below).
6. Reset the test database and run the suite so the migration is proven to apply from scratch: `mise run db:reset` then the integration tests.

Also watch for the **semantic** conflict git merges cleanly: if main added a row or fixture that constructs a domain type and your branch added a required field to that type, the merge is textually clean but type-broken. `pnpm typecheck` catches it; tests that do not typecheck will not.

### Adding a `NOT NULL` column to a non-empty table

`drizzle-kit generate` emits `ADD COLUMN ... NOT NULL`, which aborts on any existing row. Either give the column a `.default(...)` in `schema.ts` (the generator then emits `ADD COLUMN ... DEFAULT x NOT NULL`, safe in one statement), or, when you do not want a lingering default, hand-edit the generated SQL into three steps: add the column nullable, `UPDATE` to backfill, then `ALTER COLUMN ... SET NOT NULL`.

## Hyperdrive / Workers Postgres

For Workers deploys via Hyperdrive: `PgClient.layer({ url: Config.string("HYPERDRIVE_CONNECTION_STRING") })`. The pool's lifecycle is per-isolate; layers compose the same way.

## Don't

- Don't `Effect.tryPromise(() => db.select()...)`. Drizzle through `@effect/sql-drizzle` returns Effects natively.
- Don't read `process.env.DATABASE_URL` directly — use `Config.redacted("DATABASE_URL")`.
- Don't share a Drizzle client across processes; the Layer handles that.
