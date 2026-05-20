# Testing

Write tests for any logic you add or change. If a function makes decisions, transforms data, or enforces invariants, it must have tests before shipping. Don't ask — just write them.

## Test logic, not plumbing

- A function that decides, transforms, or enforces invariants → test it.
- A function that calls one external API and passes through the result → don't test it; you'd be testing your mock.

## Three tiers

Tests fall into one of three tiers, distinguished by **what is real and what is stubbed**. The naming is universal; tools differ per stack (see the template's own rules for the runner + mocking style — `@effect/vitest`, `cargo test`, `vitest`, etc.).

### Unit

- **Pure code, no I/O.** Domain models, domain services, value objects, parsers, ranking/scoring logic, state machines.
- **Nothing stubbed because nothing depends on external state.**
- **Live next to the source.** `foo.ts` + `foo.test.ts`. Rust: `#[cfg(test)] mod tests` at the bottom of the file.
- **Required for**: any function with non-trivial behavior. Skip trivial getters, single-line delegations, serde-derived round-trips.

### Use-case

- **An `application/use-case/` orchestration with repositories and external services stubbed.** The unit of "what the app can do."
- Stub the boundary, exercise the logic: in Effect, `Layer.succeed(PostRepository, mockImpl)`; in vanilla TS, `vi.mock`; in Rust, hand-rolled trait impls.
- **Live next to the use-case file.** `application/use-case/create-post.ts` + `create-post.test.ts`.
- **Required for**: every use case. Non-negotiable — this is what enforces the "use cases are mandatory" discipline.

### Integration

- **Real I/O.** Repository tests against a real test database, multi-module flows, pipeline composition.
- **E2E is a sub-flavor**: HTTP request → handler → use case → DB → response, against the actual server. Add when you need it; not every endpoint earns one.
- **Live in `tests/integration/` (or `tests/e2e/` for the HTTP-boundary flavor)**, not next to the source.
- **Required for**: repositories with non-trivial queries (joins, transactions, computed columns), schema constraints (UNIQUE indexes, CHECK constraints, DEFAULT values), critical user-visible flows at the HTTP boundary.
- **Use a dedicated test database.** Wipe between tests or use transactions that roll back. Never against the dev DB.

## Coverage per tier

- **Unit**: every domain model method with logic + every domain service.
- **Use-case**: every use case (mandatory).
- **Integration**: every repository method with non-trivial query, every schema constraint.
- **E2E**: critical user-visible flows (auth, checkout, signup). Not every endpoint.

## Feature specs (Gherkin) for user-visible behavior

For anything a stakeholder would describe as "the app should..." — anything that maps to a use case under `application/use-case/`, anything a product spec would mention — write a Gherkin-style scenario doc in `docs/test/<feature>.md`. Pure helpers don't get a spec doc; their unit tests are enough.

Format:

```md
# <Feature Name>

<One-paragraph description of what the feature does and why it exists.>

## <Scenario group>

- [x] **[AUTH-001]** Reject expired tokens
  - Given: a user with a token issued more than 24h ago
  - When: they call any authenticated endpoint
  - Then: the response is 401 with code `token_expired`
  - Automated: `apps/api/src/application/use-case/authenticate.test.ts`

- [ ] **[AUTH-002]** Refresh near-expiry tokens server-side
  - Given: a token within 10 minutes of expiry
  - When: the response is successful
  - Then: a refreshed token rides back in the `X-Refresh-Token` header
  - Automated: (not yet)
```

### Conventions

- **Stable scenario code**: `<FEATURE>-<NNN>` (3-digit zero-padded). The code never changes once assigned. Deleted scenarios don't get their number reused. Codes are independent of glb issue numbers; a scenario can reference an issue in its body, but the code is the canonical handle.
- **Checkbox semantic**: `[x]` = an automated test exists whose name contains this code. `[ ]` = spec'd, no automated test yet. Manage the box by hand when you add the test.
- **Test name carries the code**: `it.effect("AUTH-001 rejects expired tokens", ...)`. `grep AUTH-001` finds the test from the spec, or the spec from the test.
- **`Automated:` is the canonical link** — point at the use-case test (the lowest tier where this scenario is verified). If the scenario is also covered at integration/e2e tiers, those tests have the same code in their names and grep finds them.
- **One feature doc per file**: `docs/test/auth.md`, `docs/test/posts.md`. Not one monolithic file.
- **Scope**: every clean-architecture template (effect-api, hono-api, axum-api). bun-scripts and react-spa don't have use cases as the unit; their behavior is checked via flow tests at the e2e tier instead.

## What doesn't need a spec doc

- Pure helpers, value objects (`Money.add`, `Post.isPublished`) — inline unit test only.
- Repository implementations — integration test next to it; CRUD doesn't need a Gherkin scenario.
- HTTP handlers / MCP tools — no spec at the handler level. The use-case spec covers the behavior; the handler is a 3-line shim that just dispatches.
- Domain services with non-obvious business rules → spec doc warranted.

## Test naming

- Behavior, not function: `task_with_past_due_date_is_overdue`, not `test_is_overdue`.
- Include the scenario code if there's a spec doc: `AUTH-001 rejects expired tokens`.
- Group related tests in the same block (Rust: same `mod tests`; vitest: same `describe`).

## Keep tests fast

- No network calls in unit / use-case tests. If you must, mock at the service boundary (in Effect, swap the Layer; in vitest, `vi.mock`).
- No `sleep`. Use a clock service / `TestClock` / `tokio::time::pause()` for time-dependent logic.
- Dedicated test database for integration tests.

## Property testing

For functions with wide input spaces (parsers, serialization round-trips, state machines), reach for property tests. Rust: `proptest`. TS: `fast-check`. Use when a unit test feels like it's only covering the happy path.
