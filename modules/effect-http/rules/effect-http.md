# Effect HTTP: `@effect/platform`

This rule adds the HTTP inbound adapter (`HttpApi`) and outbound HTTP client (`HttpClient`) to an Effect project. Assumes the `effect` module is already in place — the paradigm, clean-architecture layout, and use-case discipline come from there. This rule only describes the `presentation/http/` adapter and the outbound HTTP client service pattern.

## Where things live

```
src/                                  (or apps/<app>/src/)
└── presentation/
    └── http/
        ├── server.ts                 HttpApiBuilder + HttpApiSwagger + HttpServer composition.
        ├── <resource>.ts             HttpApi endpoint groups. Reference use-case Input Schemas.
        └── dto/<resource>.ts         ONLY when wire shape != encode(domain). Schema.transform.
```

- `presentation/http/` is the only place HTTP types (`HttpApi`, `HttpApiEndpoint`, `HttpApiGroup`) appear. Use cases never import from `@effect/platform/HttpApi`.
- One `HttpApi` per service. Compose groups (`HttpApiGroup`) by resource.

## HttpApi: definition-driven

- Endpoints are fully Schema-driven (payload, success, errors). The same definition produces the runtime decode, the encoded response, the OpenAPI document, the typed `HttpApiClient`, and (with `@effect/ai`'s `effect-mcp` integration) the MCP tool surface.

  ```ts
  const Posts = HttpApiGroup.make("posts")
    .add(HttpApiEndpoint.get("getPost")`/posts/${HttpApiSchema.param("id", Schema.String)}`
      .addSuccess(PostSchema)
      .addError(PostNotFound, { status: 404 }))
  ```

- Handlers return Effects. Errors declared on the endpoint with `HttpApiEndpoint.addError(MyError, { status: 404 })` map automatically to HTTP responses — no `error-handler.ts` middleware.
- No DI through middleware. Services come from `R` via Layers. Per-request scoping is the platform's job, not the framework's.
- Use case Input Schemas (from `application/use-case/<verb>-<resource>.ts`) become endpoint payloads directly — same schema across HTTP, MCP, and any other adapter.

## Handlers are shims

- Per the use-case-mandatory rule from `effect.md`: each HTTP handler is a 3-line shim. Parse input (Schema does it), call the use case, return the result. No business logic, no inline `Effect.gen` longer than 3 lines.
- If a handler grows beyond that, the work belongs in a use case, not in `presentation/http/`.

## Server composition

- Compose into `AppLive` via `HttpApiBuilder.layer({ api: MyApi })` + `HttpServer.layer({ port })`. Provide every service Layer the handlers depend on.
- Expose Swagger UI in dev with `HttpApiSwagger.layer({ path: "/docs" })`. The OpenAPI document is generated, not hand-written — never check a JSON spec into the repo.

## Typed client (same repo)

- For a frontend app in the same repo, generate a typed client with `HttpApiClient.make(MyApi, { baseUrl })` and export it from `apps/api/src/client.ts`. The frontend imports it directly — types flow from the server, no codegen step.
- **Every Schema reachable from the `HttpApi` must be importable by the consumer's tsc.** When the frontend imports the `HttpApi` (or a model re-exported alongside it), its tsc compiles every payload/success/**error** Schema the definition references — including each error class passed to `.addError`. If one of those lives in a module that uses path aliases (`@/...`), the frontend's tsc resolves `@/` against *its own* root and the build breaks with "cannot find module". So **error (and success) schemas exposed through the API must live in relative-import-only modules** — define an HttpApi-facing error (e.g. `domain/models/<x>-not-found.ts`) with relative imports and re-export it, rather than reaching for one defined in an `@/`-aliased repository/use-case file.

## HTTP client (outbound)

- For outbound HTTP calls (calling other services), build requests with `HttpClient` + `HttpClientRequest`. Parse responses through `Schema` decoders. Never raw `fetch` + manual JSON parsing — that breaks the Schema-at-every-boundary rule from `effect.md`.

  ```ts
  const fetchUser = (id: string) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const response = yield* client.get(`https://api.example.com/users/${id}`)
      return yield* HttpClientResponse.schemaBodyJson(UserSchema)(response)
    })
  ```

- Outbound HTTP belongs in an infrastructure service (e.g. `infrastructure/external/user-api-client.ts`), wrapped behind a `Context.Tag`. Use cases never see `HttpClient` directly — they see the domain-shaped service.

## Testing HTTP

- **Domain tier**: every use case has a test with stubbed Layers. No HTTP framework needed — handlers are shims, the logic is in the use case.
- **E2E tier (opt-in)** (`tests/e2e/`): provide `HttpServer.layer` against a test port and make real requests through `HttpApiClient`. Skip unless an end-to-end flow (auth, signup, checkout) genuinely needs verification at the wire.
