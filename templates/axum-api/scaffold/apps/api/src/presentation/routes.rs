use axum::routing::{delete, get, patch, post};
use axum::Router;

use crate::AppState;
use super::post_handler;

pub fn app_router(state: AppState) -> Router {
    Router::new()
        .route("/api/posts", get(post_handler::list_posts).post(post_handler::create_post))
        .route(
            "/api/posts/{id}",
            get(post_handler::get_post)
                .patch(post_handler::update_post)
                .delete(post_handler::delete_post),
        )
        .with_state(state)
}
