---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Effect SQL: Drizzle's native Effect drivers

This rule adds the SQL infrastructure layer to an Effect project. Assumes the `effect` module is already in place — the paradigm, clean-architecture layout, and repository pattern come from there. This rule only describes how repository implementations in `infrastructure/db/` work.

Pair with a database module (`modules/postgres` for Postgres, `modules/sqlite` for SQLite) for the docker-compose and migration tooling.

## Which driver

Drizzle ships Effect-native drivers under `drizzle-orm/effect-*`. Each one wraps an Effect SQL client and returns Effects from every query. The old `@effect/sql-drizzle` package was dropped in Effect 4 (it has no 4.x release), so never install it.

| Database | Client package | Drizzle driver |
|---|---|---|
| Postgres | `@effect/sql-pg` | `drizzle-orm/effect-postgres` |
| Cloudflare D1 | `@effect/sql-d1` | `drizzle-orm/effect-d1` |
| SQLite on Bun | `@effect/sql-sqlite-bun` | `drizzle-orm/effect-sqlite-bun` |
| SQLite on Node | `@effect/sql-sqlite-node` | `drizzle-orm/effect-sqlite-node` |
| libSQL / Turso | `@effect/sql-libsql` | `drizzle-orm/effect-libsql` |

- Pin `drizzle-orm` and `drizzle-kit` to the same exact version. Use `1.0.0-rc.5-5935859`, not the `rc` tag: `1.0.0-rc.4` calls `Schema.TaggedErrorClass`, which does not exist in `effect@4.0.4`, so the driver crashes when the module loads.
- `@effect/sql-d1` has no transactions. `SqlClient.withTransaction` and `db.transaction` do not work on D1. Use `D1Client.batch([...statements])` for a fixed group of statements that must commit together, and design repositories without multi-step read-modify-write flows.
- The Effect SQL clients (`@effect/sql-pg` and the others) speak the database protocol themselves. Do not also install `pg` or `postgres` for runtime queries.

## Where things live

```
src/                                  (or apps/<app>/src/)
├── domain/
│   └── repositories/<resource>.ts    Repository interface as Context.Service (from effect.md).
└── infrastructure/
    └── db/
        ├── schema.ts                 Drizzle pg/sqlite tables. Single source of truth.
        ├── sql-live.ts               PgClient.layer (or the D1/SQLite equivalent). Provides SqlClient.
        └── <resource>-repository.ts  Layer.effect implementing the domain service.
```

- `infrastructure/db/` is the only place Drizzle types (`pgTable`, `sqliteTable`, `$inferSelect`) appear. The domain layer must never see `SqlError`, row shapes, or Drizzle types.
- Imports inside the app are relative. The app's `HttpApi` definition is compiled by the web client, and an `@/` alias would resolve against the web app's `src/`.

## Drizzle queries return Effects directly

- Never `Effect.tryPromise(() => db.select()...)`. The Effect drivers return Effects natively.
- Build the database handle inside the repository `Layer.effect` with `makeWithDefaults()`, which needs the SQL client service and nothing else. Wrap query errors into the domain `DbError` at the repository edge.

  ```ts
  import { desc, eq } from "drizzle-orm"
  import { makeWithDefaults } from "drizzle-orm/effect-postgres"
  import { Effect, Layer, Option } from "effect"

  export const PostRepositoryLive = Layer.effect(
    PostRepository,
    Effect.gen(function* () {
      const db = yield* makeWithDefaults()

      const findById = (id: string) =>
        db.select().from(postsTable).where(eq(postsTable.id, id)).pipe(
          Effect.mapError((cause) => new DbError({ cause })),
          Effect.map((rows) => Option.fromNullishOr(rows[0]).pipe(Option.map(fromRow))),
        )

      return PostRepository.of({ findById })
    }),
  )
  ```

  For D1 import `makeWithDefaults` from `drizzle-orm/effect-d1` and pass `{}` as the config.

- Row → domain conversion (`fromRow`) is private to the repository Layer. Use Drizzle's `$inferSelect` for the row type — the schema is the single source of truth.

  ```ts
  type PostRow = typeof postsTable.$inferSelect

  const fromRow = (row: PostRow): Post =>
    new Post({
      id: row.id,
      title: row.title,
      publishedAt: Option.fromNullishOr(row.publishedAt),
    })
  ```

- **Decode discriminant columns into their `Schema.Literals`, don't reconstruct them.** A `text` column that's really a finite set (`status`, `kind`, `type`) comes back as a bare `string`. Define the union once as `Schema.Literals(["a", "b", "c"])` and decode the column into it at the row boundary (`Schema.decodeUnknownOption(Status)` with a defensive default, or `Schema.decodeUnknownEffect`). Never widen it to `string`, and never re-narrow with `value === "a" || value === "b"` chains — that's exactly the boundary decode the Schema rule exists to prevent. Downstream then dispatches with `Match` (see `effect.md`).

## Transactions (Postgres, SQLite)

- Multi-statement writes go through `db.transaction((tx) => ...)`. The callback returns an Effect and queries inside it use `tx`, not `db`. A failure in the callback rolls the transaction back.
- `SqlClient.withTransaction(effect)` from `effect/sql` also works when the work is plain `sql` statements instead of Drizzle queries.
- Never open transactions through the raw driver. The Effect-aware wrappers participate in scopes and traces.
- D1 has no transactions. See "Which driver".

## Provide one client at app composition

- `PgClient.layer({ url: config.databaseUrl })` (or the D1/SQLite equivalent) lives in `infrastructure/db/sql-live.ts` and is provided once at `AppLive`. The pool lifecycle is scoped inside the layer.
- Repository Layers depend on the SQL client service through `R`. Never construct a client inside a repository.
- On Cloudflare Workers the D1 binding only exists on the request `env`, so the client layer is built per request. See the Workers section in `effect-http.md`.

## Migrations

- Migrations stay on `drizzle-kit` (CLI, runtime-agnostic). Only the query runtime changes. Migration files live in `drizzle/migrations/`.
- drizzle-kit 1.0 writes one folder per migration (`drizzle/migrations/<timestamp>_<name>/migration.sql` plus `snapshot.json`), not flat `.sql` files. Tools that expect flat files need a pattern. Wrangler needs `"migrations_pattern": "drizzle/migrations/*/migration.sql"` next to `migrations_dir`.
- Apply Postgres migrations at deploy time with `drizzle-orm/effect-postgres/migrator`'s `migrate(db, { migrationsFolder })`, run from a small `scripts/migrate.ts` through the platform runtime. It needs only runtime dependencies, so the production image does not need `drizzle-kit`.

## Testing SQL

- **Domain tier**: repository tests are NOT required — use cases at the integration tier transitively exercise repositories, and that's enough. CRUD doesn't earn a unit test.
- **Integration tier** (`tests/integration/`): provide the real `SqlLive` Layer against a fresh test database. Use a dedicated test database (`<project>_test`) — never the dev DB. Wipe between tests or wrap each test in a transaction that rolls back.
- Required for critical user-visible flows where DB state matters. Not every use case earns one; pick the ones where a SQL-layer bug would be expensive.
