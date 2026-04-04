---
name: database
description: Database operations — create migrations, modify schema, check migration status, and manage PostgreSQL tables (sqlx). Use when adding/changing tables, fields, indexes, constraints, or working with migrations.
argument-hint: <action> (e.g. "add a tasks table", "add field to agent", "create migration for reminders", "status")
---

# Database: $ARGUMENTS

Perform database schema and migration operations for **$ARGUMENTS**.

## How the database works

- **PostgreSQL** connected via `DATABASE_URL`
- **sqlx** — compile-time checked SQL queries via `sqlx::query!()` macros
- **Migrations** are `.sql` files with timestamp-based names
- **Offline metadata** in `.sqlx/` allows building without a database

## Creating a new migration

### Step 1 — Create the .sql file

Check the last timestamp and create the next file:

```bash
ls packages/infrastructure/pg_migrations/
```

Create e.g. `20260302000000_add_notifications.sql`:

```sql
CREATE TABLE IF NOT EXISTS notification (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification (user_id);
```

### Step 2 — Apply and regenerate offline metadata

```bash
# Restart app to apply migration, then:
cargo sqlx prepare --workspace
```

### Step 3 — Add the repository

- Domain model in `packages/domain/src/models/`
- Repository trait in `packages/domain/src/repositories/`
- Implementation in `packages/infrastructure/src/db/pg_repositories/` using `sqlx::query!()` macros

### Step 4 — Verify

```bash
cargo check -p infrastructure
SQLX_OFFLINE=true cargo check --workspace
```

## Modifying an existing table

**Never edit an existing migration file.** Create a new ALTER TABLE migration.

## Schema conventions

- Always use `IF NOT EXISTS` (idempotency)
- Always add `created_at` and `updated_at` with `DEFAULT now()`
- Use `CHECK` constraints for enum-like fields
- Use `TEXT` for strings, `JSONB` for structured data
- Timestamp-based filenames to avoid collisions

## sqlx query rules

- Use `&val` for String parameters, `.as_deref()` for `Option<String>`
- Only SELECT columns you actually use
- Never delete `.sqlx/` directory
- After any query or schema change: `cargo sqlx prepare --workspace`

## Checklist

- [ ] Migration `.sql` file created with `IF NOT EXISTS`
- [ ] Timestamp-based filename
- [ ] Migration applied
- [ ] Offline metadata regenerated: `cargo sqlx prepare --workspace`
- [ ] Repository trait + implementation added
- [ ] `cargo check -p infrastructure` passes
- [ ] `SQLX_OFFLINE=true cargo check --workspace` passes
