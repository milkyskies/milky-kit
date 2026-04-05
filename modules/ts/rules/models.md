---
paths:
  - "**/models/**/*.ts"
---

# Models

- Create models at `src/models/` using `effect/Data.case` + `effect/Option`
- Consumers import from `@/models/`, not from `@/services/api/_generated/schemas`
- **Nullable fields**: Use `Option.fromNullable()` from `effect`
- **Dates**: Parse ISO strings to `Date` at the model boundary — consumers should never see raw ISO strings. For `Option<Date>`: `Option.map(Option.fromNullable(dto.field), (s) => new Date(s))`. Wall-clock times (HH:MM) and RRULE strings stay as strings — they're not timestamps.
- **Enums**: Import typed enum types from `_generated/schemas/` — never type enum fields as `string`. E.g. `readonly stakes: Option.Option<Stakes>` not `Option.Option<string>`.

```typescript
import { Data, Option } from "effect";
import type { ThingResponse } from "../services/api/_generated/schemas";

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
