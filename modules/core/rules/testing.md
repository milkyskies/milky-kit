# Testing

Write tests for any logic you add or change. If a function makes decisions, transforms data, or enforces invariants, it must have tests before shipping. Don't ask — just write them.

## Test logic, not plumbing

- A function that decides, transforms, or enforces invariants → test it.
- A function that calls one external API and passes through the result → don't test it; you'd be testing your mock.

## Three tiers (E2E optional)

Tests fall into one of three tiers, distinguished by **what is real and what is stubbed**. The naming is universal; tools differ per stack (see the template's own rules for the runner + mocking style — `@effect/vitest`, `cargo test`, `vitest`, etc.).

### Domain

- **Tests with no real I/O.** Covers ALL stub-able tests in one tier:
  - Pure functions on domain models (`Post.isPublished`, `Money.add`).
  - Pure domain services (`PricingService.computeOrderTotal`).
  - Use-case Effects with repositories and external services stubbed (`Layer.succeed(PostRepository, mockImpl)` in Effect; `vi.mock` in vanilla TS; hand-rolled trait impls in Rust).
- **Stub the boundary, exercise the logic.**
- **Live next to the source.** `foo.ts` + `foo.test.ts`. Rust: `#[cfg(test)] mod tests` at the bottom of the file.
- **Required for**: every domain model method with non-trivial logic, every domain service, every use case (mandatory — this is what backs the "use cases are mandatory" discipline).

### Integration

- **Use cases against a real test database.** Catches SQL + orchestration bugs in one test. No separate repository-method tier — testing the use case transitively exercises the repo, and that's enough.
- **Live in `tests/integration/`**, not next to the source.
- **Required for**: critical user-visible flows where DB state matters. Not every use case earns one; pick the ones where a bug at the SQL layer would be expensive.
- **Use a dedicated test database.** Wipe between tests or use transactions that roll back. Never against the dev DB.

### E2E (opt-in)

- **Full HTTP/MCP boundary**: request → handler → use case → DB → response, against the actual server.
- **Live in `tests/e2e/`**.
- **Add when you have user-critical flows that must be verified at the wire** (auth, checkout, signup). Skip if you don't — not every project needs E2E.

## Coverage per tier

- **Domain**: every domain model method with logic + every domain service + every use case.
- **Integration**: every critical user-visible flow where DB state matters.
- **E2E**: optional. Only when the wire matters separately from the use case.

## What counts as "domain" for the Domain tier

"Domain logic" = the part of the code with **no I/O** (no DB, no HTTP, no time, no external services). Testable with stubs only.

**Decision rule — domain service vs use case**: does it touch I/O (repo, external API, clock, randomness, logger)? Then it's a use case in `application/use-case/`, not a domain service. Pure logic → domain service. The use case orchestrates domain services + repositories + side effects; the domain service is the pure algorithm the use case calls.

For exact directory layout per template (where `domain/models/`, `domain/services/`, `domain/repositories/`, `application/use-case/` live and how they're shaped):

- Effect (any inbound adapter) → `modules/effect/rules/effect.md` "Where things live" section
- Axum API → `templates/axum-api/rules/clean-architecture.md`

## Feature specs (Gherkin) for user-visible behavior — optional

**When this applies:** projects with multiple stakeholders tracking behavior, regulated domains, or anywhere the gain from durable scenario-code tracking (FEATURE-NNN) pays back the cost of maintaining a doc tier. Solo projects, scripts, and small services skip this section entirely; their use-case tests are the spec.

For projects that do adopt this: anything a stakeholder would describe as "the app should..." — anything that maps to a use case under `application/use-case/`, anything a product spec would mention — gets a Gherkin-style scenario doc in `docs/test/<feature>.md`. Pure helpers don't get a spec doc; their unit tests are enough.

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

- Pure helpers, value objects (`Money.add`, `Post.isPublished`) — inline domain-tier test only.
- Repository implementations — no isolated test required (use cases at the integration tier transitively exercise them); CRUD doesn't need a Gherkin scenario either.
- HTTP handlers / MCP tools — no spec at the handler level. The use-case spec covers the behavior; the handler is a 3-line shim that just dispatches.
- Domain services with non-obvious business rules → spec doc warranted (and a domain-tier test for the algorithm).

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
