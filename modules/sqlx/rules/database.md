# Database: PostgreSQL + sqlx

## ORM

- **sqlx** — compile-time checked SQL queries
- Queries use `sqlx::query!()` / `sqlx::query_as!()` macros that verify SQL against the real schema at build time
- Set `SQLX_OFFLINE=true` when building without a database (CI, worktrees)
- `.sqlx/` directory contains offline query metadata — committed to git

## Migrations

Migration files are `.sql` files with timestamp-based names.

### Creating migrations

```bash
ls packages/infrastructure/pg_migrations/   # check the last timestamp
```

Create the next file, e.g. `20260302000000_add_notifications.sql`:

```sql
CREATE TABLE IF NOT EXISTS notification (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Schema conventions

- Always use `IF NOT EXISTS` for all CREATE statements (idempotency)
- Always add `created_at` and `updated_at` with `DEFAULT now()`
- Use `CHECK` constraints for enum-like fields
- Use `TEXT` for string fields, `JSONB` for structured data
- Add indexes for fields used in WHERE clauses

### After schema changes

```bash
cargo sqlx prepare --workspace   # regenerate .sqlx/ offline metadata
```

## Repository pattern

- **Domain models** (`packages/domain/src/models/`) — pure Rust, no sqlx imports
- **Repository traits** (`packages/domain/src/repositories/`) — async traits
- **Repository implementations** (`packages/infrastructure/src/db/pg_repositories/`) — use `sqlx::query!()` macros

## sqlx query rules

- Use `&val` for `String` parameters, `.as_deref()` for `Option<String>`
- Row structs don't need `#[derive(sqlx::FromRow)]` — the macro handles field mapping
- Only SELECT columns you actually use

## Migration rules

- **Never edit an existing migration file.** Create a new migration instead.
- **Never run raw DDL against the database.** Always use migration files.
- **Never delete `.sqlx/` directory.**
