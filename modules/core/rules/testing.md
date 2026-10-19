# Testing

Write a test only when at least one of these is true:

1. **It is a bug fix.** A failing test proves the bug, then the fix makes it pass.
2. **A mistake would be silent.** Branches, math, parsing, state changes: logic the compiler and a quick look at the result would not catch.
3. **Other code depends on the behaviour.** A contract other modules, agents or users rely on, such as a parser or a wire format.

Never write these:

- A test that restates the code: mocking everything and asserting the calls happened.
- Tests for pass-through functions, mappings, wiring, configuration or simple getters.
- Tests for UI layout or wording. Look at the screen instead.
- A test per function by habit. Write one test per behaviour, with a few representative cases, not ten near-copies.

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
- **Written for**: domain logic that meets one of the conditions at the top.

### Integration

- **Use cases against a real test database.** Catches SQL + orchestration bugs in one test. No separate repository-method tier — testing the use case transitively exercises the repo, and that's enough.
- **Live in `tests/integration/`**, not next to the source.
- **Written for**: the few flows where a bug at the SQL layer would be silent and expensive.
- **Use a dedicated test database.** Wipe between tests or use transactions that roll back. Never against the dev DB.

### E2E (opt-in)

- **Full HTTP/MCP boundary**: request → handler → use case → DB → response, against the actual server.
- **Live in `tests/e2e/`**.
- **Add when you have user-critical flows that must be verified at the wire** (auth, checkout, signup). Skip if you don't — not every project needs E2E.

## What counts as "domain" for the Domain tier

"Domain logic" = the part of the code with **no I/O** (no DB, no HTTP, no time, no external services). Testable with stubs only.

**Decision rule — domain service vs use case**: does it touch I/O (repo, external API, clock, randomness, logger)? Then it's a use case in `application/use-case/`, not a domain service. Pure logic → domain service. The use case orchestrates domain services + repositories + side effects; the domain service is the pure algorithm the use case calls.

For exact directory layout per template (where `domain/models/`, `domain/services/`, `domain/repositories/`, `application/use-case/` live and how they're shaped):

- Effect (any inbound adapter) → `modules/effect/rules/effect.md` "Where things live" section
- Axum API → `templates/axum-api/rules/clean-architecture.md`

## Test naming

- Behavior, not function: `task_with_past_due_date_is_overdue`, not `test_is_overdue`.
- Group related tests in the same block (Rust: same `mod tests`; vitest: same `describe`).

## Keep tests fast

- No network calls in unit / use-case tests. If you must, mock at the service boundary (in Effect, swap the Layer; in vitest, `vi.mock`).
- No `sleep`. Use a clock service / `TestClock` / `tokio::time::pause()` for time-dependent logic.
- Dedicated test database for integration tests.

## Property testing

For functions with wide input spaces (parsers, serialization round-trips, state machines), reach for property tests. Rust: `proptest`. TS: `fast-check`. Use when a unit test feels like it's only covering the happy path.
