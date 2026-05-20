# Effect-TS paradigm

This rule is the paradigm core + the universal clean-architecture layout for every Effect-TS project. Compose with adapter modules (`effect-http`, `effect-mcp`) and infrastructure modules (`effect-sql`) as the project needs them. Effect-TS supersedes the paradigm-neutral TypeScript rules in `modules/ts/rules/`; pick one paradigm per project, never both.

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

Every Effect project uses the same four-layer clean-architecture split. Each layer depends only on inner layers.

```
src/                                  (flat — single-app project)
apps/<app>/src/                       (monorepo — multi-app project)
├── domain/                           Pure types and rules. No I/O.
│   ├── models/<resource>.ts          Schema.Class for the domain entity. Encode/decode in one place.
│   ├── services/<concept>.ts         Multi-entity / pure-business algorithms. Context.Tag + Layer.
│   └── repositories/<resource>.ts    Repository interface as Context.Tag.
├── application/
│   └── use-case/<verb>-<resource>.ts The Effect + its Input/Output Schemas, colocated.
│                                     Every adapter (http, mcp, matrix, cli) imports these.
├── infrastructure/                   Adapters out. Knows about external systems.
│   ├── config.ts                     Config-based env (Config.string, Config.redacted).
│   └── logger.ts                     Logger Layer.
│   (effect-sql adds db/schema.ts + db/<resource>-repository.ts)
└── presentation/                     Adapters in. One subdirectory per inbound protocol.
    └── <adapter>/                    http, mcp, matrix, cli, worker, ... — filled in by adapter rules.
```

- `domain/` imports nothing from `application/`, `infrastructure/`, or `presentation/`.
- `application/use-case/` imports `domain/` only. No knowledge of HTTP, MCP, SQL, or any protocol.
- `infrastructure/` implements domain interfaces and knows about external systems (DB, HTTP clients, queues).
- `presentation/<adapter>/` is the only place each inbound protocol lives. Handlers are 3-line shims that call use cases.

Tests are colocated: `foo.ts` next to `foo.test.ts`. No mirrored `test/` tree.

## Use cases are mandatory

**Every operation the system performs is a use case in `application/use-case/<verb>-<resource>.ts`.** This is the load-bearing discipline of the paradigm — break it and the layout falls apart.

- **Never** write business logic inline in a presentation handler (HTTP route, MCP tool, Matrix event handler, CLI command). The handler is a 3-line shim: parse input → call use case → return result.
- **Never** call repositories or services directly from presentation. Presentation only knows the use case.
- **If a handler needs to do two things in sequence, that's a new use case.** Don't compose use cases inline at the handler. Make a `checkoutAndNotify` use case that calls both, then call the new one from the handler.
- **Use cases are the unit of adapter exposure for every protocol.** An MCP tool, an HTTP endpoint, a Matrix bot command — each is a use case picked for that protocol's ergonomics. Same building blocks, different selection per adapter.
- The exception is genuinely zero-logic endpoints (health check, schema introspection). Those can be inline. Anything with branching, state, or side effects becomes a use case.

A presentation file with an `Effect.gen` block longer than 3 lines is a code smell. Extract.

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
- At each adapter boundary, format errors for the consumer: human messages to users, structured JSON to machines, full traces to logs. Each adapter module describes its own error-mapping mechanism.
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
- All boundary parsing (HTTP body, env vars, file contents, LLM output, external event, DB row when the row shape is untrusted) goes through `Schema.decodeUnknown` so you get a typed value or a typed `ParseError`, never `any`.
- When the wire shape genuinely differs from the encoded domain (renamed fields, computed fields, omitted fields), express it as `Schema.transform(DomainSchema, WireSchema, { decode, encode })` in `presentation/<adapter>/dto/<resource>.ts`. Only then.
- Use case Input/Output Schemas live next to the use case and are shared between adapters. One schema, every protocol.

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

The 3-tier model + Gherkin spec convention lives in `modules/core/rules/testing.md`. Below is the Effect-flavor tool layer for the universal tiers; adapter modules (`effect-http`, `effect-mcp`) add their own E2E patterns.

- Tests use `@effect/vitest`. Replace `it` / `test` with `it.effect`, `it.scoped`, or `it.live` — test bodies are Effects, assertions compose with the system under test.
- **Domain tier** (`domain/models/*.test.ts`, `domain/services/*.test.ts`, `application/use-case/*.test.ts`): no real I/O. Build a `Layer.mergeAll(StubPostRepository, StubIdGenerator, ...)` per test or per `describe` block. Provide it via `Effect.provide(TestLive)` on the test body. Required for every use case — non-negotiable.
- **Integration tier** (`tests/integration/`): provide the real infrastructure Layer (e.g. `SqlLive` against a fresh test database) and exercise use cases through it. Each infrastructure module describes its own setup.
- Time-dependent code: `TestClock.adjust(Duration.seconds(5))` advances time deterministically. Never `vi.useFakeTimers` or `sinon`.
- Random-dependent code: `TestRandom` provides reproducible seeds.
- Service mocking: `Layer.succeed(MyService, mockImpl)` always, never `vi.mock` for Effect services.
- Test files colocated for domain tier (`createPost.ts` + `createPost.test.ts`). Integration + E2E live under `tests/`.
- **Scenario codes in test names** when a `docs/test/<feature>.md` spec exists: `it.effect("POST-001 rejects empty title", () => ...)`. `grep POST-001` finds the test from the spec or the spec from the test.

## Run at the edge

- Compose all Effects into one pipeline. Provide every Layer via `Layer.provide` / `Layer.mergeAll` into `AppLive`. Call `Effect.runPromise` or `Effect.runFork` exactly once, in `main.ts`, with `AppLive` provided.

## If you do not know how to express something in Effect

Look it up first — Effect docs at effect.website, source on GitHub, or WebSearch. Don't silently fall back to plain TS, `throw`, raw `Promise`, or `null`. A short pause to find the right Effect idiom is always cheaper than building something that has to be rewritten.
