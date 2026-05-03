---
paths:
  - "**/models/**/*.ts"
---

# Models

- Use `effect/Data.case` + `effect/Option`. Interface declares `readonly` fields.
- **Nullable fields**: Use `Option.fromNullable()` from `effect`.
- **Dates**: Parse to `Date` at the model boundary — consumers should never see raw ISO strings. For `Option<Date>`: `Option.map(Option.fromNullable(x), (s) => new Date(s))`. Wall-clock times (HH:MM) and RRULE strings stay as strings — they're not timestamps.
- **Enums**: Use typed enum types — never type enum fields as `string`. E.g. `readonly stakes: Option.Option<Stakes>` not `Option.Option<string>`.
- The domain model is **pure** — no DB row shape, no wire shape, no DTO conversion. The model knows about itself only.
- Conversion is the boundary's job:
  - **Frontend**: `Thing.fromApi(dto)` lives on the model (the wire is the only "outside" the frontend talks to)
  - **Backend repo**: row → domain conversion is **private to the repository implementation** (see `hono-patterns.md`)
  - **Backend presentation**: domain → DTO conversion lives in `presentation/dto/<resource>-dto.ts` (see `hono-patterns.md`)

## Frontend: `fromApi` (API DTO → domain)

- Lives at `src/models/`. Consumers import from `@/models/`, not from generated/inferred wire types.
- Frontend has no DB, no separate "presentation" — the wire IS its boundary, so the converter sits on the model.

```typescript
import { Data, Option } from "effect";
import type { ThingResponse } from "@/services/api/types";

export interface Thing {
  readonly id: string;
  readonly name: string;
  readonly parentId: Option.Option<string>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const Thing = {
  make: Data.case<Thing>(),

  fromApi: (dto: ThingResponse) =>
    Thing.make({
      id: dto.id,
      name: dto.name,
      parentId: Option.fromNullable(dto.parent_id),
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    }),
};
```

## Backend: domain stays pure

```typescript
// apps/api/src/domain/models/post.ts
import { Data, type Option } from "effect";

export interface Post {
  readonly id: string;
  readonly title: string;
  readonly publishedAt: Option.Option<Date>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const Post = {
  make: Data.case<Post>(),
};
```

That's the whole file. No row shape, no DTO type, no converters — those belong to the layers that own those shapes:

- **Row → Post**: private `fromRow` helper inside the repository implementation. Use Drizzle's `typeof postsTable.$inferSelect` for the row type — the schema is the single source of truth.
- **Post → DTO**: `toPostDto(post)` standalone function in `presentation/dto/post-dto.ts`. The DTO type and converter live next to each other.

See `hono-patterns.md` for full examples of the repo and presentation/dto layout.
