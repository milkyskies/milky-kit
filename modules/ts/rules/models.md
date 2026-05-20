---
paths:
  - "**/models/**/*.ts"
---

# Domain models

Architectural placement, paradigm-neutral. Projects using Effect-TS additionally follow `modules/effect/rules/effect.md`, which prescribes `Schema.Class` and Effect-flavored conversion (one schema decodes/encodes both directions).

- **Pure.** A domain model knows about itself only. No DB row shape, no wire shape, no DTO type, no converters in the model file.
- **Readonly fields.** The model is data; constructed once, never mutated. Use `readonly` on every field.
- **Typed enum fields.** Never type an enum field as `string`. Define the union or the literal type and use that.

## Conversion lives at the boundary, not on the model

- **Frontend**: the wire is the only "outside" — so `<Model>.fromApi(dto)` on the model is acceptable. Consumers import the model from `@/models/`, not from generated wire types.
- **Backend repository**: row → domain conversion is **private to the repository implementation**. Use the ORM's inferred row type (`typeof <table>.$inferSelect` for Drizzle) — the schema is the single source of truth for the row shape.
- **Backend presentation**: domain → wire conversion lives in `presentation/dto/<resource>-dto.ts`, alongside the wire-shape types. The DTO type and its converter live next to each other.

The model itself imports nothing from `infrastructure/` or `presentation/`.
