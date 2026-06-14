# Consuming an effect-api from a React frontend

Use this rule only when the project's API is the milky-kit `effect-api` template (or another `@effect/platform`-based service). It documents the three bridges from a normal React + TanStack Query frontend to a typed Effect backend.

## 0. First make the API importable (the `@/` alias barrier)

The api package uses `@/*` path aliases internally (`@/domain/...`, `@/application/...`). Those aliases are resolved by **the importing project's** tsconfig/Vite, so the moment the web client imports an api source file that uses `@/`, resolution points at the *client's* `src/` and breaks — at typecheck and at bundle time. "Import directly across workspace boundaries" only works for an api surface that is **alias-free**.

So the effect-api template ships a dedicated browser-safe entry, `src/client.ts`, that re-exports only what the client needs using **relative** imports, and declares it in `package.json`:

```jsonc
// apps/api/package.json
"exports": { "./client": "./src/client.ts" }
```
```ts
// apps/api/src/client.ts — only modules that import nothing but `effect`.
export { Post, PostId } from "./domain/models/post"
```

The client imports `@<project>/api/client`. Which bridge below you reach for depends on what crosses the boundary:

- **Domain schemas** (`Post`, value objects, input `Schema.Struct`s) import only `effect`, so they cross with no build step — re-export them from `src/client.ts` freely.
- **The `HttpApi` definition value** (`PostsApi`) transitively pulls the `@/`-aliased handler/use-case graph. To use bridge #1 (`HttpApiClient`, below) you must **build the api** to alias-free output (e.g. `tsdown`/`tsup` resolving the paths) and point `./client` at `dist`. If you'd rather skip a build step, prefer bridge #3 (share the schemas, call `fetch` yourself) — lighter, still fully typed on the domain.

## 1. Typed client via `HttpApiClient`

The effect-api template exports an `HttpApi` definition (e.g. `PostsApi`). With the api built to alias-free output (see §0), importing it across the workspace boundary gives the frontend a typed client with zero codegen:

```ts
// apps/web/src/services/api/client.ts
import { HttpApiClient } from "@effect/platform"
import { FetchHttpClient } from "@effect/platform"
import { Effect, Layer } from "effect"
import { PostsApi } from "@<project>/api"

const ClientLayer = FetchHttpClient.layer

export const client = await Effect.runPromise(
	HttpApiClient.make(PostsApi, { baseUrl: import.meta.env.VITE_API_URL }).pipe(
		Effect.provide(ClientLayer),
	),
)
```

`client.posts.getPost({ id })` returns `Effect<Post, PostNotFound | HttpClientError>`. The `Post` is the same `Schema.Class` defined in the backend's `domain/models/post.ts` — decoded on receive, fully typed at the call site.

## 2. Bridging Effect to TanStack Query

TanStack Query is the frontend cache/suspense runtime. Effect handles the network call inside `queryFn`:

```ts
// apps/web/src/services/api/post/get-post-query-options.ts
import { Effect } from "effect"
import { client } from "@/services/api/client"

export const getPostQueryOptions = (id: string) => ({
	queryKey: ["posts", id] as const,
	queryFn: () => Effect.runPromise(client.posts.getPost({ id })),
})
```

Then the component uses `useSuspenseQuery(getPostQueryOptions(id))` per the existing `frontend-implementation.md` rule.

Caveat: TanStack Query types the `error` as the unstructured `Error`. The typed `E` channel from Effect collapses here. If you need to handle a specific tagged error in the UI (`PostNotFound` → 404 page), use `Effect.match` inside `queryFn`:

```ts
queryFn: () =>
	Effect.runPromise(
		client.posts.getPost({ id }).pipe(
			Effect.match({
				onFailure: (error) => ({ kind: "error" as const, error }),
				onSuccess: (post) => ({ kind: "ok" as const, post }),
			}),
		),
	),
```

The result is a tagged union the component can `Match` on. Annoying but it works.

## 3. `Schema` for form validation

The frontend can reuse the same `Schema.Class` (or `Schema.Struct`) the backend uses for input validation. `CreatePostInput` defined in `application/use-case/create-post.ts` is importable directly:

```ts
import { Schema } from "effect"
import { CreatePostInput } from "@<project>/api"

const result = Schema.decodeUnknownEither(CreatePostInput)(formData)
if (result._tag === "Left") {
	// render result.left (ParseError) — has formatted error tree
	return showFormErrors(result.left)
}
// result.right is a typed CreatePostInput
submit(result.right)
```

This is the lightest-touch use of Effect on the frontend — `Schema` alone, no full Effect runtime. For React Hook Form / Formik integration, write a custom resolver that calls `Schema.decodeUnknownEither` and maps the `ParseError` paths to form field errors.

## What this rule does NOT cover

- **Fully-Effect frontends** (replacing TanStack Query with `@effect-rx/rx-react`). That's a different paradigm and would need its own template (`effect-react-spa`). Not currently shipped.
- **Server-side rendering**. The react-spa template is client-rendered. SSR would need a different platform setup.
- **WebSocket / SSE streams** through Effect's `Stream` module. Possible (`@effect/platform`'s `Socket` works), but no scaffolded example yet.

## Convention

- Keep the **typed client setup** in `src/services/api/client.ts`.
- Keep **per-resource query-options + mutation-hooks** in `src/services/api/<resource>/`.
- Don't sprinkle `Effect.runPromise` calls through components — always go through the query layer.
- If the API client and the frontend live in the same monorepo, prefer **directly importing types** from the API package over publishing them; saves the build/publish step. Use `workspace:*` in package.json.
