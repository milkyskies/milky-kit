---
name: database
description: Database operations — create migrations, modify schema, check migration status, and manage PostgreSQL tables (SeaORM). Use when adding/changing tables, fields, indexes, constraints, or working with migrations.
argument-hint: <action> (e.g. "add a tasks table", "add field to agent", "create migration for reminders", "status")
---

# Database: $ARGUMENTS

Perform database schema and migration operations for **$ARGUMENTS**.

## How the database works

- **PostgreSQL** connected via `DATABASE_URL`
- **SeaORM** — entity-based ORM, async-native, no database connection needed to compile
- **Migrations** are Rust files in `apps/db/src/migrator/` implementing `MigrationTrait`

## Creating a new migration

### Step 1 — Generate the migration stub

```bash
cd apps/db
sea-orm-cli migrate generate <name>
```

### Step 2 — Fill in the up/down methods

Register the migration in `src/migrator/mod.rs`.

### Step 3 — Apply the migration

```bash
cargo run -p db -- migrate
```

### Step 4 — Regenerate entities

```bash
sea-orm-cli generate entity \
    --database-url "$DATABASE_URL" \
    --output-dir packages/infrastructure/src/db/entities \
    --with-serde both \
    --date-time-crate chrono
```

### Step 5 — Add the repository

- Domain model in `packages/domain/src/models/`
- Repository trait in `packages/domain/src/repositories/`
- Implementation in `packages/infrastructure/src/db/repositories/` using SeaORM

### Step 6 — Verify

```bash
cargo check -p infrastructure
cargo nextest run -p infrastructure
```

## Modifying an existing table

**Never edit an existing migration file.** Create a new migration that alters the table.

## Schema conventions

- Use `IF NOT EXISTS` for idempotency
- Always add `created_at` and `updated_at`
- Use `CHECK` constraints for enum-like fields
- Add indexes for fields used in WHERE clauses

## Checklist

- [ ] Migration file created via `sea-orm-cli migrate generate`
- [ ] Up and down methods filled in
- [ ] Migration registered in `mod.rs`
- [ ] Migration applied
- [ ] Entities regenerated
- [ ] Repository trait + implementation added
- [ ] `cargo check` passes
