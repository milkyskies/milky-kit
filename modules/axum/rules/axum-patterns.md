---
paths:
  - "**/presentation/**/*.rs"
---

# Axum Patterns

## Handler conventions

- Handlers live in `apps/api/src/presentation/` -- one file per resource (e.g. `post_handler.rs`).
- Handlers are thin: extract input, call the repository or use case, return a response. No business logic.
- Use `axum::extract::State` to access the database pool (or an app state struct).
- Use `axum::extract::Path` for URL parameters, `axum::extract::Json` for request bodies.
- Return `axum::Json<T>` for success, or use `axum::response::IntoResponse` for error types.

## Route registration

- Define routes in `presentation/routes.rs` as a function returning `Router<AppState>`.
- Group related routes under a common prefix using `.nest()` or `.route()`:
  ```rust
  Router::new()
      .route("/api/posts", get(list_posts).post(create_post))
      .route("/api/posts/{id}", get(get_post).patch(update_post).delete(delete_post))
  ```
- Register the router in `main.rs` by merging or nesting.

## Middleware

- **CORS**: use `tower_http::cors::CorsLayer`. Configure allowed origins, methods, and headers.
- **Tracing**: use `tower_http::trace::TraceLayer` for request/response logging.
- Apply middleware as layers on the router:
  ```rust
  router.layer(TraceLayer::new_for_http()).layer(cors)
  ```

## State

- Define an `AppState` struct (or type alias) holding the `sea_orm::DatabaseConnection`.
- Pass it to the router via `.with_state(state)`.
- Handlers extract it with `State(state): State<AppState>`.

## Error handling

- Define a presentation-level error type that implements `IntoResponse`.
- Map domain errors (e.g. `RepositoryError::NotFound`) to HTTP status codes (e.g. 404).
- Never expose internal error details to clients -- log them, return a generic message.

## OpenAPI

- Annotate handlers with `#[utoipa::path(...)]` for automatic spec generation.
- Register all paths and schemas in `presentation/openapi.rs`.
- Serve Swagger UI via `utoipa_swagger_ui::SwaggerUi`.
