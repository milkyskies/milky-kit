# Rust testing conventions

This file is the Rust-specific tool layer for `modules/core/rules/testing.md`. Read that first for the universal 3-tier model + Gherkin spec convention. Anything below is Rust-flavor — `cargo test`, `proptest`, `sqlx`, `tokio::test`.

## Domain-tier tests

All no-I/O tests live inline in the source file via `#[cfg(test)] mod tests`. This covers pure functions on entities, domain services, and use cases with stubbed repositories.

Pure functions on entities (`src/domain/models/<resource>.rs`):

```rust
pub fn is_published(post: &Post) -> bool { ... }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn POST_001_is_not_published_without_published_at() {
        let post = Post { published_at: None, ..Default::default() };
        assert!(!is_published(&post));
    }
}
```

Domain services (`src/domain/services/<concept>.rs`): same `#[cfg(test)] mod tests` pattern at the bottom of the source file.

Use cases with stubbed repositories (`src/application/use_case/<verb>_<resource>.rs`):

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

- `#[tokio::test]` for async, `#[test]` for sync. Group related tests in the same `mod tests`. One `use super::*` at the top.
- Stub repositories by impl'ing the trait inline. No mocking library required — the trait abstraction makes hand-rolled stubs trivial.

## Integration-tier tests

`tests/` directory at the crate root (not under `src/`). Test the use case end-to-end against a real Postgres test DB. Don't write isolated repository tests; testing the use case exercises the repo transitively.

```rust
// tests/create_post_integration.rs
use my_crate::application::use_case::create_post;
use my_crate::infrastructure::db::{PostRepository, make_db_pool};

#[sqlx::test]
async fn POST_005_persists_post_with_published_at(pool: sqlx::PgPool) {
    let repo = PostRepository::new(pool);
    let post = create_post(&repo, CreatePostInput {
        title: "Hello".into(),
        published_at: Some(Utc::now()),
        ..Default::default()
    }).await.unwrap();

    let fetched = repo.find_by_id(&post.id).await.unwrap().unwrap();
    assert!(fetched.is_published());
}
```

- `#[sqlx::test]` provides a fresh test database per test via `sqlx-cli` migrations. Wipes between tests automatically.
- For SeaORM: equivalent fixture macro or a `setup_test_db()` helper that rolls back at the end.
- One file per use case (`tests/create_post_integration.rs`, `tests/checkout_order_integration.rs`).
- Cargo auto-discovers anything under `tests/` as integration tests when you run `cargo test`.

## E2E-tier tests (opt-in)

Same `tests/` dir, against the running Axum app:

```rust
// tests/posts_e2e.rs
#[tokio::test]
async fn POST_007_create_then_get_post() {
    let app = test_app().await;
    let create_resp = app.post("/posts").json(&...).send().await;
    assert_eq!(create_resp.status(), 201);
    // ...
}
```

- Spin up the Axum app via `axum_test::TestServer` or `reqwest::Client` against a `tokio::spawn`'d server bound to port 0.
- One file per resource or per user flow.
- Only add when the wire matters separately from the use case.

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

Add when a domain-tier test feels like it's only covering the happy path.

## Keep tests fast

- No network in domain-tier tests. External clients go through trait abstractions; stub the trait.
- No `std::thread::sleep`. Use `tokio::time::pause()` for time-dependent logic (`tokio::time::advance(d)` moves the test clock).
- `cargo test --release` for property tests that are slow under default optimization; default profile is fine otherwise.
- `cargo nextest run` for parallelism + better output.

## Test name → scenario code

When a feature spec exists under `docs/test/<feature>.md`, the test name contains the scenario code:

```rust
#[test]
fn POST_001_rejects_empty_title() { ... }
```

Rust doesn't allow hyphens in identifiers; use underscores (`POST_001` ↔ `POST-001` in the spec doc). `grep POST_001 -r src tests` finds the test from the spec; `grep POST-001 docs/test/` finds the spec from the test.
