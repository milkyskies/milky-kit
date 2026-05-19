# Effect-TS paradigm

This file is the complete paradigm rule for projects scaffolded from `templates/effect-api`. Effect-TS is the programming model; vanilla TypeScript conventions in `modules/ts/rules/` do not apply. Pick one or the other per project — never both.

## Strong typing baseline

These hold regardless of paradigm, but they matter especially here because Effect's typed channels rely on them:

- Never use `!` (non-null assertion). Handle the absent case explicitly via `Option`, `Schema.decode`, or pattern matching.
- Never use `as` type casts except at trusted system boundaries (env var parsing handled by `Config`, untrusted input handled by `Schema`). If you reach for `as`, the types are wrong upstream. `@milkyskies/biome-config`'s `no-as-cast.grit` plugin enforces this at lint time.
- `noExplicitAny: error` is on. Use `unknown` and narrow.
- Prefer narrowing via `typeof`, `in`, discriminated unions, or `Match` over casts.

## The model

Every fallible or effectful operation returns `Effect<A, E, R>`:

- `A` — success value
- `E` — typed error channel
- `R` — services this Effect needs (provided by `Layer`s)

Compose with `Effect.gen` (sequential, generator style) or `pipe(...)` (transformation style). Run at the edge with `Effect.runPromise` / `Effect.runFork` once, at the top of `main.ts`, with every `Layer` provided.

## Where things live

```
apps/api/src/
├── domain/
│   ├── models/<resource>.ts         Schema.Class for the domain entity. Encode/decode in one place.
│   ├── services/<concept>.ts        Multi-entity / pure-business algorithms. Context.Tag + Layer.
│   └── repositories/<resource>.ts   Repository interface as Context.Tag.
├── application/
│   └── use-case/<verb>-<resource>.ts
│                                    The Effect + its Input/Output Schemas, colocated.
│                                    Both HTTP and MCP adapters import these.
├── infrastructure/
│   ├── db/schema.ts                 Drizzle pg tables. Row shape derived via $inferSelect.
│   ├── db/<resource>-repository.ts  Layer.effect implementing the repository Tag.
│   ├── config.ts                    Config-based env (Config.string, Config.redacted).
│   └── logger.ts                    Logger Layer.
└── presentation/
    ├── http/<resource>.ts           HttpApi endpoints. Reference use-case Input Schemas.
    ├── http/server.ts               HttpApiBuilder + HttpApiSwagger + HttpServer composition.
    ├── mcp/<resource>.ts            McpServer tools wired to the same use cases.
    ├── mcp/server.ts                McpServer + stdio transport composition.
    └── dto/<resource>.ts            ONLY when wire shape != encode(domain). Schema.transform.
```

Tests are colocated: `foo.ts` next to `foo.test.ts`. No mirrored `test/` tree.

## Effects, not promises

- Async work returns `Effect<A, E, R>`, never `Promise<A>`. `Promise` lives only at `runPromise` boundaries.
- Sync side effects (`nanoid()`, `new Date()`, `crypto.randomUUID()`, anything reading the outside world) wrap in `Effect.sync(() => ...)`. Pure logic stays plain.
- Use `Effect.gen(function* () { ... })` for sequential code. The generator reads like async/await, but values are Effects yielded with `yield*`.

## Errors as data

- Expected failures live in the `E` channel. Define them with `Data.TaggedError`:

  ```ts
  class PostNotFound extends Data.TaggedError("PostNotFound")<{ readonly id: string }> {}
  ```

- `Effect.fail(new PostNotFound({ id }))` to fail. Never `throw` in business logic. A thrown value is a defect (bug), not an application error.
- Handle expected errors with `Effect.catchTag("PostNotFound", (err) => ...)` or `Effect.catchTags({ PostNotFound: ..., DbError: ... })` near where the error becomes meaningful — not at the top.
- Never swallow errors silently (`Effect.catchAll(() => Effect.void)` is almost always wrong). If you cannot act on a failure, propagate it with context via `Effect.mapError`.
- At boundaries (HTTP handler, MCP tool, CLI main), format for the consumer: human messages to users, structured JSON to machines, full traces to logs. `HttpApiEndpoint.addError(MyError, { status: 404 })` maps a typed error to an HTTP response automatically.
- Don't catch errors you cannot handle. Let them reach a boundary that can.

## Optionals

- `Option.Option<T>` for absent values in domain code. Never `T | null` or `T | undefined`.
- At decode boundaries land directly in `Option<T>` using `Schema.OptionFromNullOr(...)`, `Schema.OptionFromUndefinedOr(...)`, or `Schema.OptionFromNullishOr(...)`. Don't decode to nullable and then `Option.fromNullable` it.
- Convert to nullable at the wire boundary by encoding the domain Schema — never hand-massage Options.

## Pattern matching

- Use `Match.value(x).pipe(Match.tag(...), Match.exhaustive)` (or `Match.when` for value predicates) over `if/else if` chains. Let exhaustiveness flag missing cases.
- For tagged unions defined with `Data.taggedEnum`, use the generated `.$match` API.
- `if` is fine for guard clauses with early return. Avoid `else`; invert the condition and return.

## Schema everywhere at boundaries

- Define domain types with `Schema.Class` (or `Schema.Struct`). The same schema drives decode (wire → domain) and encode (domain → wire) — there is no separate "DTO type" in the common case.
- All boundary parsing (HTTP body, env vars, file contents, LLM output, DB row when the row shape is untrusted) goes through `Schema.decodeUnknown` so you get a typed value or a typed `ParseError`, never `any`.
- When the wire shape genuinely differs from the encoded domain (renamed fields, computed fields, omitted fields), express it as `Schema.transform(DomainSchema, WireSchema, { decode, encode })` in `presentation/dto/<resource>.ts`. Only then.
- Use case Input/Output Schemas live next to the use case and are shared between adapters (HTTP, MCP, CLI). One schema, every protocol.

## Sums and discriminated unions

- `Data.taggedEnum<{ A: {...}; B: {...} }>()` gives you constructors, `$is`, `$match` for free.
- For schema-backed sums use `Schema.Union(...)` of tagged structs and pair with `Match.tag` for handlers.

## Dependency injection via Layer / Context

- Every service is a `Context.Tag` with a structural interface. No classes for services beyond `Schema.Class` for data.

  ```ts
  class PostRepository extends Context.Tag("PostRepository")<
    PostRepository,
    {
      readonly findById: (id: string) => Effect.Effect<Option.Option<Post>, DbError>
      readonly create: (input: NewPost) => Effect.Effect<Post, DbError>
    }
  >() {}
  ```

- Provide implementations as `Layer.effect` (needs other services) or `Layer.scoped` (owns acquire/release). Compose with `Layer.mergeAll` and `Layer.provide` to order dependencies.
- Business logic reaches services via the `R` channel (`const repo = yield* PostRepository`) — never as function parameters. Function-parameter DI works but defeats the type-level wiring.
- External clients (HTTP, queue, mailer, third-party SDK) are services, not free functions. Each gets a `Tag` and a `Layer` built from `Config`. Tests swap the Layer for a stub: `Layer.succeed(MyService, mockImplementation)`.

## Config

- All runtime configuration via `Config.*`. Never `process.env.X` or `import.meta.env.X` directly in business logic.
- Declare a `Config.all({ ... })` block (or one Config per service Layer) at the edge:

  ```ts
  const AppConfig = Config.all({
    databaseUrl: Config.redacted("DATABASE_URL"),
    port: Config.integer("PORT").pipe(Config.withDefault(3000)),
    logLevel: Config.literal("debug", "info", "warn", "error")("LOG_LEVEL")
      .pipe(Config.withDefault("info" as const)),
  })
  ```

- Secrets go through `Config.redacted` so they cannot be printed or logged by accident. Unwrap with `Redacted.value(secret)` only at the exact call site that needs the raw value.
- Config reads are Effects; failures are typed `ConfigError`s and surface at app boot.

## SQL: `@effect/sql-drizzle` + `@effect/sql-pg`

- Drizzle queries return Effects directly — never `Effect.tryPromise(() => db.select()...)`.

  ```ts
  const findById = (id: string) =>
    db.select().from(postsTable).where(eq(postsTable.id, id)).pipe(
      Effect.map((rows) => Option.fromNullable(rows[0])),
      Effect.map(Option.map(fromRow)),
    )
  ```

- Multi-statement writes go through `SqlClient.withTransaction`. Never `db.transaction(...)` directly.
- Row → domain conversion (`fromRow`) is private to the repository Layer. The domain layer must never see `SqlError`, row shapes, or Drizzle types.
- Provide one `PgClient.layer({ url })` at app composition. Connection pool lifecycle is `Layer.scoped` under the hood; per-request acquire/release is automatic.
- Migrations stay on `drizzle-kit` (CLI, runtime-agnostic). Only the query runtime changes.

## HTTP: `@effect/platform`

- One `HttpApi` per service. Endpoints are fully Schema-driven (payload, success, errors). The same definition produces the runtime decode, the encoded response, the OpenAPI document, the typed `HttpApiClient`, and (with `@effect/ai`) the MCP tool surface.

  ```ts
  const Posts = HttpApiGroup.make("posts")
    .add(HttpApiEndpoint.get("getPost")`/posts/${HttpApiSchema.param("id", Schema.String)}`
      .addSuccess(PostSchema)
      .addError(PostNotFound, { status: 404 }))
  ```

- Handlers return Effects. Errors declared on the endpoint map automatically to HTTP responses — no `error-handler.ts` middleware.
- No DI through middleware. Services come from `R` via Layers. Per-request scoping is the platform's job, not the framework's.
- Expose Swagger UI in dev with `HttpApiSwagger.layer({ path: "/docs" })`. The OpenAPI document is generated, not hand-written.

## MCP: `@effect/ai` `McpServer`

- One MCP tool per use case the agent should be able to invoke. The tool's `parameters` Schema is the use-case Input Schema — the same one the HTTP endpoint uses.
- Curate the MCP surface separately from the HTTP surface. Agents benefit from coarser, intention-shaped tools (`summarizeAndUpdatePost`) than HTTP needs (`getPost` + `updatePost`). Same use cases as building blocks, different selection.
- The MCP server is a `Layer` like everything else. Compose into `AppLive` alongside the HTTP server.

## HTTP client: `@effect/platform`'s `HttpClient`

- Inside service Layers, build requests with `HttpClient` + `HttpClientRequest`. Parse responses through `Schema` decoders. Never raw `fetch` + manual JSON parsing — that breaks the "Schema at every boundary" rule.

## Concurrency

- `Effect.all` with explicit `{ concurrency }` — never `Promise.all`. Pick a number, `"unbounded"`, or `"inherit"` deliberately.
- Long-running work: `Effect.fork` / `Fiber`. Streams of effects: the `Stream` module.

## Resources

- Anything with acquire/release uses `Effect.acquireRelease` or `Layer.scoped`. Never `try/finally`.

## Retries and scheduling

- Wrap flaky external calls with `Effect.retry(Schedule.exponential("200 millis").pipe(Schedule.jittered, Schedule.recurs(3)))`. Tune to the call. No hand-rolled retry loops, no bare `setTimeout`.
- `Schedule` also powers cron-like and rate-limited workloads.

## Logging and tracing

- `Effect.logDebug` / `logInfo` / `logWarn` / `logError`. Structured, level-aware logging is free; no `console.log` inside Effect code.
- Attach context with `Effect.annotateLogs({ requestId, userId, ... })` — annotations ride along through nested effects without manual threading.
- Wrap meaningful boundaries in `Effect.withSpan("post.create")`. Spans cost nothing until a tracer is provided; once one is, they immediately pay off.

## Testing: `@effect/vitest`

- Tests use `@effect/vitest`. Replace `it`/`test` with `it.effect`, `it.scoped`, or `it.live` — test bodies are Effects, assertions compose with the system under test.
- Time-dependent code: `TestClock.adjust(Duration.seconds(5))` advances time deterministically. Don't reach for `vi.useFakeTimers` or `sinon`.
- Random-dependent code: `TestRandom` provides reproducible seeds.
- Service mocking: provide a stub `Layer.succeed(MyService, mockImpl)` via `Effect.provide` in the test. Real implementations stay in the production `Layer`.
- Use-case tests run the Effect directly. No HTTP server, no DB needed for business logic.
- Integration tests provide the real `SqlLive` Layer against a fresh test database — `@effect/sql` helpers handle setup/teardown.
- Test files colocated next to the code (`createPost.ts` + `createPost.test.ts`).

## Run at the edge

- Compose all Effects into one pipeline. Provide every Layer via `Layer.provide`/`Layer.mergeAll` into `AppLive`. Call `Effect.runPromise` or `Effect.runFork` exactly once, in `main.ts`, with `AppLive` provided.

## If you do not know how to express something in Effect

Look it up first — Effect docs at effect.website, source on GitHub, or WebSearch. Don't silently fall back to plain TS, `throw`, raw `Promise`, or `null`. A short pause to find the right Effect idiom is always cheaper than building something that has to be rewritten.
