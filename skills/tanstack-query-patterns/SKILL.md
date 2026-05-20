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

All reusable helpers live in `src/lib/query/`:

| File | Purpose |
|---|---|
| `create-mutation-hook.ts` | Standard mutation hook with auto-invalidation |
| `create-optimistic-mutation-hook.ts` | Mutation hook with optimistic cache updates |
| `optimistic-helper.ts` | Helpers: `optimisticUpdate`, `optimisticCreate`, `optimisticDelete`, `optimisticToggle`, `optimisticReplaceDetail` |
| `types.ts` | Shared types (`OptimisticConfig`, `MutationConfig`, etc.) |
| `query-client.ts` | QueryClient singleton |

### Query options use TanStack's native `queryOptions()`

```ts
import { queryOptions } from "@tanstack/react-query"
import { Post } from "@/models/post"
import { postKeys } from "./post-keys"

export const getPostsQueryOptions = () =>
  queryOptions({
    queryKey: postKeys.list(),
    queryFn: async () => {
      const res = await api.posts.$get()
      if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
      const data = await res.json()
      return data.posts.map(Post.fromApi)
    },
  })
```

Why native over a custom wrapper:
- Type-safe cache reads: `queryClient.getQueryData(getPostsQueryOptions().queryKey)` is typed as `Post[] | undefined` because TanStack links the queryKey to the data type at the type level.
- No `as unknown[]` cast around `readonly` query keys.
- TanStack Router loaders consume `queryOptions()` directly via `ensureQueryData` with full type inference.

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
| Custom `createQueryOptions` wrapper | TanStack's native `queryOptions()` from `@tanstack/react-query` |
| `to-query-key.ts`-style readonly→mutable casts | Accept `readonly unknown[]` — that's the v5 `QueryKey` type |
| Import from `_generated/schemas` in components | Import from `@/models/{resource}` |
| `index.ts` barrel files | Direct imports from specific files |
| Manual cache `setQueryData` | `invalidateKeys` in mutation config |
