# Rust testing conventions

This file is the Rust-specific tool layer for `modules/core/rules/testing.md`. Read that first for the universal 3-tier model + Gherkin spec convention. Anything below is Rust-flavor — `cargo test`, `proptest`, `sqlx`, `tokio::test`.

## Unit tests

Inline in the source file:

```rust
// src/domain/services/pricing.rs
pub fn compute_discount(...) -> Money { ... }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loyalty_customer_gets_10_percent_discount() {
        let result = compute_discount(...);
        assert_eq!(result, Money::cents(900));
    }
}
```

- `#[cfg(test)] mod tests` block at the bottom of the source file.
- Group related tests in the same `mod tests`.
- One `use super::*` at the top so `pub fn`s and `pub struct`s in the same file are reachable.

## Use-case tests

`src/application/use_case/<verb>_<resource>.rs` + a test module that injects a stub repository:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::repositories::PostRepository;

    struct StubPostRepository;
    impl PostRepository for StubPostRepository {
        async fn create(&self, input: NewPost) -> Result<Post, DbError> {
            Ok(Post { id: "p_test".into(), ..input.into() })
        }
        // ... stub the rest
    }

    #[tokio::test]
    async fn POST_001_creates_post_with_generated_id() {
        let repo = StubPostRepository;
        let post = create_post(&repo, CreatePostInput { ... }).await.unwrap();
        assert_eq!(post.id, "p_test");
    }
}
```

- `#[tokio::test]` for async use cases. `#[test]` for synchronous.
- Stub repositories by impl'ing the trait inline in the test module. No mocking library required for clean architecture; the trait abstraction makes hand-rolled stubs trivial.

## Integration tests

`tests/` directory at the crate root (not under `src/`):

```rust
// tests/post_repository_integration.rs
use my_crate::infrastructure::db::{PostRepository, make_db_pool};

#[sqlx::test]
async fn finds_posts_by_published_date_range(pool: sqlx::PgPool) {
    let repo = PostRepository::new(pool);
    repo.create(...).await.unwrap();
    let results = repo.find_by_date_range(...).await.unwrap();
    assert_eq!(results.len(), 1);
}
```

- `#[sqlx::test]` provides a fresh test database per test via `sqlx-cli` migrations. Wipes between tests automatically.
- For SeaORM: equivalent fixture macro or set up a `setup_test_db()` helper that rolls back at the end.
- One file per resource (`tests/post_repository_integration.rs`, `tests/user_repository_integration.rs`).
- Cargo auto-discovers anything under `tests/` as integration tests when you run `cargo test`.

## E2E tests

Same `tests/` dir, against the running Axum app:

```rust
// tests/posts_e2e.rs
#[tokio::test]
async fn POST_005_create_then_get_post() {
    let app = test_app().await;
    let create_resp = app.post("/posts").json(&...).send().await;
    assert_eq!(create_resp.status(), 201);
    // ...
}
```

- Spin up the Axum app via `axum_test::TestServer` or `reqwest::Client` against a `tokio::spawn`'d server bound to port 0.
- One file per resource or per user flow.

## Property tests

Use `proptest` for functions with wide input spaces (parsers, serialization round-trips, state machines):

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn money_addition_is_commutative(a: i64, b: i64) {
        let x = Money::cents(a);
        let y = Money::cents(b);
        prop_assert_eq!(x + y, y + x);
    }
}
```

Add when a unit test feels like it's only covering the happy path.

## Keep tests fast

- No network in unit/use-case tests. External clients go through trait abstractions; stub the trait.
- No `std::thread::sleep`. Use `tokio::time::pause()` for time-dependent logic (and `tokio::time::advance(d)` to move the test clock).
- `cargo test --release` for property tests that are slow under default optimization; default profile is fine for everything else.
- `cargo nextest run` if you want parallelism + better output.

## Test name → scenario code

When a feature spec doc exists under `docs/test/<feature>.md`, the test name must contain the scenario code:

```rust
#[test]
fn POST_001_rejects_empty_title() { ... }
```

Rust doesn't allow hyphens in identifiers; use underscores (`POST_001` ↔ `POST-001` in the spec doc). `grep POST_001 -r src tests` finds the test from the spec; `grep POST-001 docs/test/` finds the spec from the test.
