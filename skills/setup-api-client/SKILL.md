---
name: setup-api-client
description: Scaffold TanStack Query service layer for a single API resource. Use when wiring up a new resource from the generated OpenAPI client — creates keys, query options, and mutation hooks.
argument-hint: [resource-name]
allowed-tools: Read, Glob, Grep
---

# Setup API Client for: $ARGUMENTS

Scaffold the full TanStack Query service layer for the **$ARGUMENTS** resource, following the patterns in this codebase.

## Step 1 — Discover the generated code

Look in `src/services/api/_generated/` to find:
- The generated functions for `$ARGUMENTS`
- The relevant schema types in `_generated/schemas/`

Also look in `src/models/` to see if a model class already exists for this resource.

## Step 2 — Determine the file structure

Create files at `src/services/api/{resource-name}/`:

```
src/services/api/{resource}/
├── {resource}-keys.ts                    # Query Key Factory
├── get-{resource}s-query-options.ts      # GET list query (if applicable)
├── get-{resource}-query-options.ts       # GET detail query (if applicable)
├── use-post-{resource}.ts                # POST mutation
├── use-patch-{resource}.ts               # PATCH mutation
└── use-delete-{resource}.ts              # DELETE mutation
```

Only create files that match actual endpoints. **No `index.ts` barrel file.**

## Step 3 — Implement each file

### {resource}-keys.ts — Query Key Factory

```typescript
export const {resource}Keys = {
  all: ["{resource}s"] as const,
  lists: () => [...{resource}Keys.all, "list"] as const,
  list: (params: ListParams) => [...{resource}Keys.lists(), params] as const,
  details: () => [...{resource}Keys.all, "detail"] as const,
  detail: (id: string) => [...{resource}Keys.details(), id] as const,
};
```

### Query options — use `createQueryOptions`

```typescript
import { createQueryOptions } from "@/lib/tanstack-query/create-query-options";
import { toQueryKey } from "@/lib/tanstack-query/to-query-key";

export const get{Resource}sQueryOptions = createQueryOptions({
  keyFn: () => toQueryKey({resource}Keys.lists()),
  queryFn: async () => {
    const response = await generated{Resource}ListFn();
    return response.data.map({Resource}.fromApi);
  },
});
```

### Mutations — use `createMutationHook` or `createOptimisticMutationHook`

- **POST**: `createMutationHook`, invalidates `lists()` only
- **PATCH**: `createOptimisticMutationHook` with `optimisticUpdate`, invalidates `lists()` + `detail(id)`
- **DELETE**: `createOptimisticMutationHook` with `optimisticDelete`, invalidates `lists()` + `detail(id)`

**Params** = URL/path parameters (hook's first argument). **Payload** = request body (what `.mutate()` receives).

## Step 4 — Key rules

- Use `@/` path alias for all imports
- Import generated functions from `"../_generated"`
- Import model classes from `"@/models/{resource}"`
- Every resource needs a model with `.fromApi()` converter
- Always `useSuspenseQuery` in components — never `useQuery` with `isLoading`
- **Use optimistic mutations by default** for PATCH and DELETE
- No `index.ts` barrel files

## Step 5 — Show a usage example

After creating the files, show how a component would use the new hooks.
