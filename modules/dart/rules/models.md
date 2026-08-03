---
paths:
  - "**/*.dart"
  - "pubspec.yaml"
---

# Domain models

Architectural placement for Dart projects. Paradigm-neutral: applies whether or not the project uses Riverpod.

- **Pure.** A domain model knows about itself only. No HTTP shape, no database row shape, no generated DTO type, no converters to external formats in the model file.
- **Immutable.** Every field `final`. Constructed once, derived with `copyWith`, never mutated. `freezed` generates this plus structural equality and `hashCode`; hand-writing it is fine for small models but gets tedious fast.
- **Typed fields.** Never type a closed-set field as `String`. Define the `enum` (no payload) or `sealed class` (differing payloads) and use that. See `modules/dart/rules/dart-style.md` for which to reach for.
- **Absence is `T?`**, handled by pattern matching at the use site. Not a wrapper type.

## Conversion lives at the boundary, not on the model

The wire is the only "outside" a client application has, so the conversion has to live somewhere near it. Two shapes, pick per project and stay consistent:

- **`Model.fromDto(dto)` as a factory on the model** — acceptable, and the simplest thing that works. The model file gains one import of the generated DTO type.
- **A mapper in the data layer** (`data/mappers/<resource>_mapper.dart`) — preferred once conversion is non-trivial (renamed fields, computed fields, several DTOs collapsing into one model), because it keeps the model file free of generated-code imports entirely.

Either way:

- **Generated wire DTOs never escape the data layer.** Features, widgets, and domain services import the domain model, never the generated client's types. This is what makes regenerating the API client a contained change instead of a codebase-wide one.
- **Do not hand-edit generated code.** If the generated shape is wrong, fix the schema it was generated from.

## Why not use the generated models directly

It is tempting, and it saves the mapping layer. It costs you:

- Generated models are shaped by whatever the generator emits, not by your domain. Nullability tends to be laxer than reality, enums come out as raw strings, and one endpoint's response type leaks into every screen that reads it.
- Every regeneration is a potential breaking change across the whole app rather than across one mapper.
- You cannot add domain behaviour (computed properties, invariants, `sealed` variants) to a type that gets overwritten.

The mapping layer is small and boring, and it is the thing that lets the inner layers stay stable while the wire moves.

## Layout

```
lib/
├── core/
│   └── models/<resource>.dart        Domain model. Pure. freezed or hand-written.
└── data/
    ├── generated/                    Generated API client + wire DTOs. Never edited, never imported outside data/.
    └── mappers/<resource>_mapper.dart  Wire ↔ domain conversion, when it warrants its own file.
```

The model imports nothing from `data/` (unless using the `fromDto` factory shape, in which case it imports only the DTO type) and nothing from the presentation layer, ever.
