---
paths:
  - "src/models/**"
  - "apps/client/src/models/**"
---

# Models

- Create models at `src/models/` using `effect/Data.case` + `effect/Option`
- Import from `@/models/`, not from `@/services/api/_generated/schemas`
- **Nullable fields**: Use `Option.fromNullable()` from `effect`

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
