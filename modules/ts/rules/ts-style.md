---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript conventions

Paradigm-neutral rules that apply to every TS file. Projects using Effect-TS additionally follow `modules/effect/rules/effect.md`, which supersedes the optionals / pattern-matching / sum-type choices below with Effect equivalents.

## Strong typing

- Never use `!` (non-null assertion). Handle the absent case explicitly.
- Never use `as` type casts except at trusted system boundaries (parsing JSON, env vars). If you reach for `as`, the types are wrong upstream. `@milkyskies/biome-config`'s `no-as-cast.grit` plugin enforces this at lint time.
- `noExplicitAny` is `error` via `@milkyskies/biome-config`. Use `unknown` and narrow.
- Prefer narrowing via `typeof`, `in`, or discriminated unions over casts.

## Optionals

- Domain logic: use `T | undefined` and narrow with explicit checks. Don't mix `null` and `undefined` in the same field — pick one (`undefined` is the TypeScript-native choice for "absent").
- Component props: `T?` (optional) for native JSX ergonomics.
- API DTOs: `T | null` only at the wire boundary (matches OpenAPI nullable).
- Convert at layer boundaries: don't let `null` leak past the wire.

## Pattern matching

- For tagged unions, write a `switch (x.kind) { ... }` with `never` exhaustiveness:

  ```ts
  function handle(event: Event): string {
    switch (event.kind) {
      case "created": return ...
      case "deleted": return ...
      default: {
        const _exhaustive: never = event
        return _exhaustive
      }
    }
  }
  ```

- `if` is fine for guard clauses with early return. Avoid `else` — invert the condition and return.

## Sums

- Discriminated unions with a `kind` (or `type`, `_tag`) literal field. Make the discriminator a `const`-ish string literal, not an enum.

## Dates

- `date-fns` for date manipulation and formatting in view-layer code. Domain logic that needs deterministic time should reach for a clock service rather than calling `new Date()` directly.
