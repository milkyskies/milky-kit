---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Conventions

## Strong typing

- **Never use `!`** (non-null assertion). Handle the absent case explicitly.
- **Never use `as`** type casts except at system boundaries (parsing JSON, env vars). If you reach for `as`, the types are wrong upstream.
- Prefer narrowing via `typeof`, `in`, discriminated unions, or pattern matching over casts.

## Optionals

- **Domain models**: `Option.Option<T>` from `effect` — rich API (`map`, `flatMap`, `getOrElse`, `match`)
- **Component props / callbacks**: `T?` (optional) — native JSX ergonomics
- **API DTOs**: `T | null` — only at the wire boundary (matches OpenAPI nullable)
- Convert at layer boundaries: `Option.getOrUndefined(x)` from domain → props, `Option.fromNullable(dto.x)` from DTO → domain

Rule of thumb: **Option for logic, `?` for props.**

## Pattern matching

- Use `Match` from `effect` instead of `if`/`else if`/`switch` chains
- `if` is fine for early returns (guard clauses)
- Avoid `else` — invert the condition and return early

## Enums

- Use `Data.taggedEnum` from `effect` for discriminated unions when possible — gives you constructors, `$is`, `$match` for free

## Dates

- Use `date-fns` for all date manipulation and formatting
