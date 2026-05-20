# Effect SQL: `@effect/sql-drizzle` + `@effect/sql-pg`

This rule adds the SQL infrastructure layer to an Effect project. Assumes the `effect` module is already in place — the paradigm, clean-architecture layout, and repository pattern come from there. This rule only describes how repository implementations in `infrastructure/db/` work.

Pair with a database module (`modules/postgres` for `@effect/sql-pg`, `modules/sqlite` for the sqlite client) for the docker-compose, driver install, and migration tooling.

## Where things live

```
src/                                  (or apps/<app>/src/)
├── domain/
│   └── repositories/<resource>.ts    Repository interface as Context.Tag (from effect.md).
└── infrastructure/
    └── db/
        ├── schema.ts                 Drizzle pg/sqlite tables. Single source of truth.
        ├── client.ts                 PgClient.layer or sqlite equivalent. Provides SqlClient + Db.
        └── <resource>-repository.ts  Layer.effect implementing the domain Tag.
```

- `infrastructure/db/` is the only place Drizzle types (`pgTable`, `sqliteTable`, `$inferSelect`) appear. The domain layer must never see `SqlError`, row shapes, or Drizzle types.

## Drizzle queries return Effects directly

- Never `Effect.tryPromise(() => db.select()...)`. `@effect/sql-drizzle` returns Effects natively.

  ```ts
  const findById = (id: string) =>
    db.select().from(postsTable).where(eq(postsTable.id, id)).pipe(
      Effect.map((rows) => Option.fromNullable(rows[0])),
      Effect.map(Option.map(fromRow)),
    )
  ```

- Row → domain conversion (`fromRow`) is private to the repository Layer. Use Drizzle's `$inferSelect` for the row type — the schema is the single source of truth.

  ```ts
  type PostRow = typeof postsTable.$inferSelect

  const fromRow = (row: PostRow): Post =>
    Post.make({
      id: row.id,
      title: row.title,
      publishedAt: Option.fromNullable(row.publishedAt),
    })
  ```

## Transactions

- Multi-statement writes go through `SqlClient.withTransaction`. Never `db.transaction(...)` directly — the Effect-aware wrapper is the one that participates in scopes and traces.
- A transaction's `R` channel makes the requirement explicit; rollbacks happen on `Effect.fail` automatically.

## Provide one client at app composition

- `PgClient.layer({ url: Config.redacted("DATABASE_URL") })` (or the sqlite equivalent) lives in `infrastructure/db/client.ts` and is provided once at `AppLive`. Connection pool lifecycle is `Layer.scoped` under the hood; per-request acquire/release is automatic.
- Repository Layers depend on `SqlClient` and `Db` (the drizzle wrapper) via `R`. Never construct a client inside a repository.

## Migrations

- Migrations stay on `drizzle-kit` (CLI, runtime-agnostic). Only the query runtime changes. Migration files live in `drizzle/migrations/`.
- Run via `pnpm db:migrate` (or `bun db:migrate`) — the kit's `mise run db:migrate` wraps this when the project also uses `modules/postgres`.

## Testing SQL

- **Domain tier**: repository tests are NOT required — use cases at the integration tier transitively exercise repositories, and that's enough. CRUD doesn't earn a unit test.
- **Integration tier** (`tests/integration/`): provide the real `SqlLive` Layer against a fresh test database. `@effect/sql`'s testing helpers spin up + tear down. Use a dedicated test database (`<project>_test`) — never the dev DB. Wipe between tests or wrap each test in a transaction that rolls back.
- Required for critical user-visible flows where DB state matters. Not every use case earns one; pick the ones where a SQL-layer bug would be expensive.
