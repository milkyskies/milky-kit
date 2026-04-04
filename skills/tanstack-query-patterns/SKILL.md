---
name: tanstack-query-patterns
description: Reference guide for TanStack Query patterns — Suspense queries, mutations, optimistic updates, cache invalidation, and query key management. Use when implementing or reviewing frontend data fetching.
allowed-tools: Read, Glob, Grep
---

# TanStack Query Implementation Patterns

## Core Philosophy

1. **Suspense-first**: Always `useSuspenseQuery` — never `useQuery` with `isLoading`
2. **Type safety**: Strict types, generics, and model converters
3. **Separation of concerns**: Query Key Factory, Query Options, Mutations are separate files
4. **Consistency**: Every resource follows the same file structure and naming

## Library Helpers

All reusable helpers live in `src/lib/tanstack-query/`:

| File | Purpose |
|---|---|
| `create-query-options.ts` | Factory for `{ queryKey, queryFn }` objects |
| `create-mutation-hook.ts` | Standard mutation hook with auto-invalidation |
| `create-optimistic-mutation-hook.ts` | Mutation hook with optimistic cache updates |
| `optimistic-helper.ts` | Helpers: `optimisticUpdate`, `optimisticCreate`, `optimisticDelete`, `optimisticToggle`, `optimisticReplaceDetail` |
| `to-query-key.ts` | Converts `readonly` arrays to mutable `QueryKey` |
| `types.ts` | Shared types |
| `query-client.ts` | QueryClient singleton |

## Query Key Factory

```typescript
export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (params: ListParams) => [...taskKeys.lists(), params] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};
```

## Cache Invalidation by Operation

| Operation | Invalidate |
|---|---|
| POST (create) | `lists()` only |
| PATCH (update) | `lists()` + `detail(id)` |
| DELETE | `lists()` + `detail(id)` |

## Params vs Payload

- **Params** = URL/path parameters (hook's first argument)
- **Payload** = JSON request body (what `.mutate()` receives)
- DELETE has no body — payload is `void`

## Anti-Patterns

| Do NOT | Do instead |
|---|---|
| `useQuery` + `isLoading` checks | `useSuspenseQuery` + `<Suspense>` boundary |
| `enabled: !!someValue` | Conditional rendering of the component |
| Inline query keys `["tasks", id]` | Query Key Factory `taskKeys.detail(id)` |
| Import from `_generated/schemas` in components | Import from `@/models/{resource}` |
| `index.ts` barrel files | Direct imports from specific files |
| Manual cache `setQueryData` | `invalidateKeys` in mutation config |
