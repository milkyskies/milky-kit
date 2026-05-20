# templates/axum-api

Rust + Axum API with SeaORM + Postgres. Clean-architecture split: `domain/` → `application/use-case/` → `infrastructure/` → `presentation/`. Tracked migrations + entity types via SeaORM's codegen.

The Rust counterpart to `effect-api` — same domain/use-case discipline, different paradigm. Result-typed errors instead of Effect's typed channel; trait objects + `tower::Layer` instead of `Layer`/`Context`.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| HTTP server | ✓ | Axum |
| OpenAPI spec | ✓ | `utoipa` derive macros + `utoipa-axum` |
| Swagger UI | ✓ | `utoipa-swagger-ui` mounted at `/docs` |
| Postgres | ✓ | SeaORM + sqlx pool |
| Migrations | ✓ | SeaORM Migrator (`apps/db` workspace member) |
| Entity codegen | ✓ | `sea-orm-cli generate entity` |
| Typed errors | ✓ | `Result<T, AppError>` + `thiserror` |
| Tracing | ✓ | `tracing` + `tower-http`'s `TraceLayer` |
| Tower middleware | ✓ | request id, cors, etc. via `tower-http` |
| Tests | ✓ | `cargo test` + `proptest` for property tests + `tokio::time::pause` for time control |

## Stack

- **Runtime**: Tokio
- **Language**: Rust 2024 edition, stable toolchain
- **HTTP**: `axum`
- **DB**: `sea-orm` (entities + queries) + `sea-orm-migration` (migrations) + `sqlx` (pool, parameter binding under the hood)
- **OpenAPI**: `utoipa` + `utoipa-axum` + `utoipa-swagger-ui`
- **Test**: `cargo test` + `proptest` + `tokio::time::pause`
- **Format**: `cargo fmt`
- **Lint**: `cargo clippy -- -D warnings`

## Workspace layout

```
apps/
├── api/                    The HTTP server crate
│   └── src/
│       ├── domain/
│       │   ├── models/       Plain Rust structs (newtypes welcome)
│       │   ├── repositories/ Repository traits (interfaces)
│       │   └── services/     Pure domain services
│       ├── application/
│       │   └── use_case/     <verb>_<resource>.rs orchestrations
│       ├── infrastructure/
│       │   └── db/           SeaORM-backed repository impls
│       ├── presentation/
│       │   ├── routes/       Per-resource routers
│       │   ├── dto/          Wire types (Serialize/Deserialize/ToSchema)
│       │   └── error.rs      AppError -> HTTP status mapping
│       └── main.rs           Composition root
├── db/                     SeaORM migrator + entity types crate
│   ├── src/
│   │   ├── lib.rs            Re-exports for entities
│   │   ├── m_YYYYMMDD_HHMMSS_<name>.rs  Migration files
│   │   └── entities/         Generated entity types (sea-orm-cli output)
│   └── Cargo.toml
├── docker-compose.yml      Local Postgres
└── Cargo.toml              Workspace manifest
```

## First-run

```bash
docker compose up -d
mise run db:migrate        # runs `cargo run -p db -- up`
cargo run -p api
```

Open `http://localhost:3000/docs` for Swagger UI.

After schema changes:

```bash
mise run db:migrate        # apply new migrations
sea-orm-cli generate entity -u $DATABASE_URL -o apps/db/src/entities
```

## The discipline

The `clean-architecture.md` rule file enforces:

- **`domain/` is pure**: no SeaORM, no Axum, no Tokio. Plain Rust + std + minimal helpers.
- **Use cases own orchestration**: `application/use_case/<verb>_<resource>.rs`. Take repository traits as parameters.
- **Repositories are traits**: defined in `domain/repositories/`, implemented in `infrastructure/db/`.
- **Handlers in `presentation/` are shims**: extract input → call use case → map result. Never inline business logic.
- **`AppError` maps once**: `From<RepositoryError> for AppError`, then `IntoResponse for AppError` — error wire shape lives in one place.
