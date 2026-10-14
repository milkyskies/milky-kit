---
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/*.css"
---

# Consuming an effect-api from a React frontend

Use this rule only when the project's API is the milky-kit `effect-api` template (or another `effect/http-api` service). It documents the three bridges from a normal React + TanStack Query frontend to a typed Effect backend.

## 0. The relative-import barrier

The web client compiles the API's `HttpApi` definition and every Schema it references: payloads, success models, and error classes. Path aliases resolve against **the importing project's** tsconfig, so an `@/` alias inside the api package would point at the client's own `src/` and break at typecheck with "cannot find module".

So the effect-api template uses **relative imports only**, has no `baseUrl` and no `paths` in its tsconfig, and ships a dedicated entry, `src/client.ts`, declared in `package.json`:

```jsonc
// apps/api/package.json
"exports": { "./client": "./src/client.ts" }
```
```ts
// apps/api/src/client.ts — every module reachable from here imports only `effect` and relative paths.
export { CreatePostInput } from "./application/use-case/create-post"
export { Post } from "./domain/models/post"
export { PostNotFound } from "./domain/models/post-not-found"
export { Api } from "./presentation/http/api"
```

The client imports `@<project>/api/client` and needs no build step, because the package exports TypeScript source directly. Keep the barrier intact:

- Nothing reachable from `client.ts` may import Drizzle, `@effect/sql-*`, Cloudflare types, or the Bun runtime. Handlers, repositories, and infrastructure stay outside the reachable set because `api.ts` imports only schemas.
- Error classes live in their own relative-import module (`post-not-found.ts`), not in the repository file.
- In a monorepo, declare the dependency as `"@<project>/api": "workspace:*"`.

## 1. Typed client via `HttpApiClient`

The `Api` definition exported from `client.ts` gives the frontend a typed client with zero codegen:

```ts
// apps/web/src/services/api/client.ts
import { Effect } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "@<project>/api/client"

export const client = await Effect.runPromise(
	HttpApiClient.make(Api, { baseUrl: import.meta.env.VITE_API_URL }).pipe(
		Effect.provide(FetchHttpClient.layer),
	),
)
```

`client.posts.getPost({ params: { id } })` returns `Effect<Post, PostNotFound | HttpClientError | SchemaError>`. The `Post` is the same `Schema.Class` defined in the backend's `domain/models/post.ts` — decoded on receive, fully typed at the call site. Payloads go in `payload`, query strings in `query`.

## 2. Bridging Effect to TanStack Query

TanStack Query is the frontend cache/suspense runtime. Effect handles the network call inside `queryFn`:

```ts
// apps/web/src/services/api/post/get-post-query-options.ts
import { Effect } from "effect"
import { client } from "@/services/api/client"

export const getPostQueryOptions = (id: string) => ({
	queryKey: ["posts", id] as const,
	queryFn: () => Effect.runPromise(client.posts.getPost({ params: { id } })),
})
```

Then the component uses `useSuspenseQuery(getPostQueryOptions(id))` per the existing `frontend-implementation.md` rule.

Caveat: TanStack Query types the `error` as the unstructured `Error`. The typed `E` channel from Effect collapses here. If you need to handle a specific tagged error in the UI (`PostNotFound` → 404 page), use `Effect.match` inside `queryFn`:

```ts
queryFn: () =>
	Effect.runPromise(
		client.posts.getPost({ params: { id } }).pipe(
			Effect.match({
				onFailure: (error) => ({ kind: "error" as const, error }),
				onSuccess: (post) => ({ kind: "ok" as const, post }),
			}),
		),
	),
```

The result is a tagged union the component can `Match` on. Annoying but it works.

## 3. `Schema` for form validation

The frontend can reuse the same `Schema.Class` (or `Schema.Struct`) the backend uses for input validation. `CreatePostInput` defined in `application/use-case/create-post.ts` is re-exported from `client.ts` and importable directly. Decoding yields the Type side, so `publishedAt` arrives as an `Option<Date>`:

```ts
import { Result, Schema } from "effect"
import { CreatePostInput } from "@<project>/api/client"

const result = Schema.decodeUnknownResult(CreatePostInput)(formData)

if (Result.isFailure(result)) return showFormErrors(result.failure)

submit(result.success)
```

This is the lightest-touch use of Effect on the frontend — `Schema` alone, no full Effect runtime. For React Hook Form / Formik integration, write a custom resolver that calls `Schema.decodeUnknownResult` and maps the issue paths to form field errors.

## What this rule does NOT cover

- **Fully-Effect frontends** (replacing TanStack Query with an Effect-native reactive store). That's a different paradigm and would need its own template (`effect-react-spa`). Not currently shipped.
- **Server-side rendering**. The react-spa template is client-rendered. SSR would need a different platform setup.
- **WebSocket / SSE streams** through Effect's `Stream` module. Possible (`effect/socket` works), but no scaffolded example yet.

## Convention

- Keep the **typed client setup** in `src/services/api/client.ts`.
- Keep **per-resource query-options + mutation-hooks** in `src/services/api/<resource>/`.
- Don't sprinkle `Effect.runPromise` calls through components — always go through the query layer.
- If the API client and the frontend live in the same monorepo, prefer **directly importing types** from the API package over publishing them; saves the build/publish step. Use `workspace:*` in package.json.
