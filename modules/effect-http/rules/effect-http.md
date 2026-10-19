---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Effect HTTP: `effect/http` and `effect/http-api`

This rule adds the HTTP inbound adapter (`HttpApi`) and outbound HTTP client (`HttpClient`) to an Effect project. Assumes the `effect` module is already in place — the paradigm, clean-architecture layout, and use-case discipline come from there. This rule only describes the `presentation/http/` adapter and the outbound HTTP client service pattern.

Effect 4 folded `@effect/platform` into `effect`. Import server and client primitives from `effect/http` and the API definition modules from `effect/http-api`. Only the runtime packages (`@effect/platform-bun`, `@effect/platform-node`) stay separate.

## Where things live

```
src/                                  (or apps/<app>/src/)
└── presentation/
    └── http/
        ├── api.ts                    HttpApi, groups, endpoints. Reference use-case Input Schemas.
        ├── <resource>-handlers.ts    HttpApiBuilder.group handlers. Shims over use cases.
        ├── server.ts                 HttpApiBuilder.layer + docs routes + HttpRouter.serve composition.
        └── dto/<resource>.ts         ONLY when wire shape != encode(domain). Schema.decodeTo.
```

- `presentation/http/` is the only place HTTP types (`HttpApi`, `HttpApiEndpoint`, `HttpApiGroup`) appear. Use cases never import from `effect/http-api`.
- One `HttpApi` per service. Compose groups (`HttpApiGroup`) by resource.

## HttpApi: definition-driven

- Endpoints are fully Schema-driven (payload, success, errors). The same definition produces the runtime decode, the encoded response, the OpenAPI document, the typed `HttpApiClient`, and the docs page.
- An endpoint is `HttpApiEndpoint.get(identifier, path, options)`. Path parameters are written `:id` in the path and typed through `options.params`. Payload, success, and error schemas go in the same options object.

  ```ts
  import { Schema } from "effect"
  import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

  const PostsGroup = HttpApiGroup.make("posts").add(
    HttpApiEndpoint.get("listPosts", "/posts", {
      success: Schema.Array(Post),
    }),
    HttpApiEndpoint.get("getPost", "/posts/:id", {
      params: { id: Schema.String },
      success: Post,
      error: PostNotFound.pipe(HttpApiSchema.status(404)),
    }),
    HttpApiEndpoint.post("createPost", "/posts", {
      payload: CreatePostInput,
      success: Post.pipe(HttpApiSchema.status(201)),
    }),
  )

  export class Api extends HttpApi.make("api").add(PostsGroup).prefix("/api") {}
  ```

- Declare error classes with `Schema.TaggedError` so they double as the endpoint error schema. `HttpApiSchema.status(404)` sets the status code on the schema.
- Handlers return Effects. Errors declared on the endpoint map automatically to HTTP responses — no `error-handler.ts` middleware.
- Services come from `R` via Layers. Per-request scoping is the platform's job, not the framework's.
- Use case Input Schemas (from `application/use-case/<verb>-<resource>.ts`) become endpoint payloads directly — same schema across HTTP, MCP, and any other adapter.
- Optional JSON fields use `Schema.OptionFromOptionalNullOr(...)` so a client may omit the key. `Schema.OptionFromNullishOr` makes the key required.

## Handlers are shims

- Per the use-case-mandatory rule from `effect.md`: each HTTP handler is a 3-line shim. Parse input (Schema does it), call the use case, return the result. No business logic, no inline `Effect.gen` longer than 3 lines.
- If a handler grows beyond that, the work belongs in a use case, not in `presentation/http/`.

  ```ts
  import { Effect } from "effect"
  import { HttpApiBuilder } from "effect/http-api"

  export const PostsHandlersLive = HttpApiBuilder.group(Api, "posts", (handlers) =>
    handlers
      .handle("listPosts", () => listPosts({}).pipe(Effect.orDie))
      .handle("getPost", ({ params }) =>
        getPost({ id: params.id }).pipe(Effect.catchTag("DbError", (error) => Effect.die(error))),
      )
      .handle("createPost", ({ payload }) => createPost(payload).pipe(Effect.orDie)),
  )
  ```

- Infrastructure-only errors such as `DbError` are not part of the API contract. Turn them into defects (500) at the handler.

## Server composition

- Mount the API with `HttpApiBuilder.layer(Api, { openapiPath: "/api/openapi.json" })` and the docs page with `HttpApiScalar.layerCdn(Api, { path: "/api/docs" })` (or `HttpApiScalar.layer` for the bundled script, or `HttpApiSwagger`). Serve the merged routes with `HttpRouter.serve`, on top of the platform server layer (`BunHttpServer.layer({ port })`).

  ```ts
  const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/api/openapi.json" }).pipe(
    Layer.provide(PostsHandlersLive),
  )
  const DocsRoutes = HttpApiScalar.layerCdn(Api, { path: "/api/docs" })

  export const HttpServerLive = HttpRouter.serve(Layer.mergeAll(ApiRoutes, DocsRoutes)).pipe(
    Layer.provide(BunHttpServer.layer({ port: 3000 })),
  )
  ```

- The OpenAPI document is generated, not hand-written — never check a JSON spec into the repo.
- CORS is a router layer: `HttpRouter.cors({ allowedOrigins })` provided to the merged routes.

## Typed client (same repo)

- For a frontend app in the same repo, generate a typed client with `HttpApiClient.make(Api, { baseUrl })` and export the definition from `apps/api/src/client.ts`. The frontend imports it directly — types flow from the server, no codegen step. The consuming side is documented in `effect-api-consumption.md`.
- **Every module reachable from `client.ts` imports only `effect` and relative paths.** The frontend's tsc compiles the `HttpApi` definition and every payload, success, and error Schema it references. An `@/` alias in any of those modules would resolve against the frontend's own root and break the build. So the API app uses relative imports everywhere, no `baseUrl`, and no `paths`.
- `client.ts` exports the `Api` definition, the response models, the error classes, and the input Schemas. It must not reach Drizzle, `@effect/sql-*`, Cloudflare types, or the Bun runtime.
- Put each error class in its own relative-import module (`domain/models/post-not-found.ts`) so the repository file, which imports Drizzle-side types, stays out of the reachable set.

## HTTP client (outbound)

- For outbound HTTP calls (calling other services), build requests with `HttpClient` + `HttpClientRequest`. Parse responses through `Schema` decoders. Never raw `fetch` + manual JSON parsing — that breaks the Schema-at-every-boundary rule from `effect.md`.

  ```ts
  import { Effect } from "effect"
  import { HttpClient, HttpClientResponse } from "effect/http"

  const fetchUser = (id: string) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const response = yield* client.get(`https://api.example.com/users/${id}`)

      return yield* HttpClientResponse.schemaBodyJson(UserSchema)(response)
    })
  ```

- Outbound HTTP belongs in an infrastructure service (e.g. `infrastructure/external/user-api-client.ts`), wrapped behind a `Context.Service`. Use cases never see `HttpClient` directly — they see the domain-shaped service.

## Cloudflare Workers

A Worker has no long-lived process. The D1 binding and the config values only exist on the request's `env`, so the whole Layer graph is built per request and wrapped in a web handler.

```ts
import { D1Client } from "@effect/sql-d1"
import { ConfigProvider, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/http"

const makeAppLive = (env: Env) => {
  const RequestServicesLive = Layer.mergeAll(PostRepositoryLive, IdGeneratorLive).pipe(
    Layer.provide(D1Client.layer({ db: env.DB })),
  )

  return Layer.mergeAll(HttpAppLive.pipe(HttpRouter.provideRequest(RequestServicesLive)), LoggerLive).pipe(
    Layer.provide(HttpServer.layerServices),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  )
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const app = HttpRouter.toWebHandler(makeAppLive(env), { disableLogger: true })
    ctx.waitUntil(app.dispose())

    return app.handler(request)
  },
} satisfies ExportedHandler<Env>
```

- Handler services (`PostRepository`, `IdGenerator`) are request-level requirements of the API routes. `Layer.provide` does not satisfy them. Provide them with `HttpRouter.provideRequest(layer)` on the route layer.
- Read `LOG_LEVEL`, `LOG_FORMAT`, and `CORS_ORIGINS` through `ConfigProvider.layer(ConfigProvider.fromUnknown(env))`, not `process.env`. Worker bindings such as `DB` sit in the same object and are ignored unless a `Config` asks for them.
- `import { D1Client } from "@effect/sql-d1"` gives a namespace import for `D1Client.layer`. `@effect/sql-d1/D1Client` exports the service value instead.
- `wrangler types` (the `cf-typegen` script) generates the global `Env` type and `worker-configuration.d.ts`. The tsconfig lists no `types` entry, and the generated file comes in through `include`.
- `ctx.waitUntil(app.dispose())` releases the layer scope after the response is sent.
- Build the handler at module scope only when no layer depends on `env`. Layers that read the binding or the config must be built inside `fetch`.
- `toWebHandler` accepts the handler's request-level context as a second argument. Use it when a service must come from the request itself rather than from a layer.
- D1 has no transactions. See `effect-sql.md`.

## Testing HTTP

- **Domain tier**: a use case worth testing (see `testing.md`) is tested with stubbed Layers. No HTTP framework needed — handlers are shims, the logic is in the use case.
- **E2E tier (opt-in)** (`tests/e2e/`): provide the real HTTP server layer against a test port and make real requests through `HttpApiClient`. Skip unless an end-to-end flow (auth, signup, checkout) genuinely needs verification at the wire.
