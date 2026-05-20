# Clean Architecture (Rust)

## Where things live

```
packages/
├── domain/
│   └── src/
│       ├── models/<resource>.rs         entities + pure methods on the struct
│       ├── services/<concept>.rs        multi-entity pure algorithms (when needed)
│       └── repositories/<resource>_repository.rs   traits only, no impl
├── application/
│   └── src/
│       └── use_case/<verb>_<resource>.rs  orchestration; the Effect-equivalent
│                                          for Rust: Result<A, E> async fns
└── infrastructure/
    └── src/
        └── db/<resource>_repository.rs  SeaORM/sqlx impl of the domain trait
apps/
├── api/
│   └── src/
│       ├── presentation/<resource>_handler.rs   thin Axum handlers, 3-line shims
│       └── main.rs                              composition root
└── db/                                          drizzle-kit equivalent: migrator
```

**Decision rule for domain service vs use case**: does it touch I/O (repo, external API, clock, randomness, logger)? Then it's a use case in `application/`, not a domain service. Pure logic → domain service. The use case orchestrates domain services + repositories + side effects; the domain service is the pure algorithm the use case calls.

## Dependency rule

Dependencies point INWARD only:
- `domain` imports NOTHING from other layers
- `application` imports `domain` only
- `infrastructure` imports `domain` (and optionally `application`)
- `presentation` imports `application` and `domain`

Never import infrastructure from domain or application.

## Module convention

Use directory-based modules with a paired `.rs` file:
```
models/
  task.rs
  user.rs
models.rs          # pub mod task; pub mod user;
```

NOT `mod.rs` inside directories.

## Repository pattern (MANDATORY)

All database access goes through repository traits:
- **Trait** in `domain/repositories/` — defines the interface
- **Implementation** in `infrastructure/` — uses the ORM/driver
- **Handler** constructs the repository and calls methods — never raw SQL in handlers
