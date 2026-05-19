# Database: PostgreSQL + SeaORM

## ORM

- **SeaORM** — entity-based ORM, async-native
- No database connection needed to compile
- **Entities** live in `packages/infrastructure/` and are generated from the database schema
- **Domain models** in `packages/domain/` are separate from SeaORM entities — convert between them at the repository boundary

## Migrations

Migrations are Rust files in `apps/db/src/migrator/`. Each migration implements `MigrationTrait` with `up` and `down` methods.

### Creating migrations

```bash
cd apps/db
sea-orm-cli migrate generate <name>
```

This creates a timestamped file in `src/migrator/`. Fill in the `up` and `down` methods, then register it in `src/migrator/mod.rs`. Apply with `cargo run -p db -- migrate`.

### Generating entities

After migrations are applied:

```bash
sea-orm-cli generate entity \
    --database-url "$DATABASE_URL" \
    --output-dir packages/infrastructure/src/db/entities \
    --with-serde both \
    --date-time-crate chrono
```

## Repository pattern

- **Domain models** (`packages/domain/src/models/`) — pure Rust, no SeaORM imports
- **Repository traits** (`packages/domain/src/repositories/`) — async traits defining the interface
- **SeaORM entities** (`packages/infrastructure/src/db/entities/`) — generated from DB, map to rows
- **Repository implementations** (`packages/infrastructure/src/db/repositories/`) — implement traits using SeaORM
- **Conversions** — `From<entity::Model> for DomainModel` and `From<&DomainModel> for entity::ActiveModel` in the infrastructure layer

## Migration rules

- **Never edit or rewrite an existing migration file.** Create a new migration instead.
- **Migrations must be idempotent.** Use `IF NOT EXISTS`, `IF EXISTS`, etc.
- **Never run raw DDL against the database.** Always use migrations.
- **Always use `sea-orm-cli migrate generate`** to create migration files — never create them by hand.
