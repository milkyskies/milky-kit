use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::Utc;
use domain::models::post::Post;
use domain::repositories::post_repository::PostRepository;
use infrastructure::db::repositories::post_repository::SeaPostRepository;
use sea_orm::DbErr;

use super::dto::{CreatePostRequest, PostDto, PostListResponse, UpdatePostRequest};
use crate::AppState;

fn map_db_error(err: DbErr) -> (StatusCode, String) {
    match &err {
        DbErr::RecordNotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
        _ => {
            tracing::error!("Database error: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/posts",
    responses(
        (status = 200, description = "List all posts", body = PostListResponse)
    )
)]
pub async fn list_posts(State(state): State<AppState>) -> impl IntoResponse {
    let repo = SeaPostRepository::new(state.db.clone());

    match repo.find_all().await {
        Ok(posts) => {
            let response = PostListResponse {
                posts: posts.into_iter().map(PostDto::from).collect(),
            };
            Ok(Json(response))
        }
        Err(err) => Err(map_db_error(err)),
    }
}

#[utoipa::path(
    get,
    path = "/api/posts/{id}",
    params(
        ("id" = String, Path, description = "Post ID")
    ),
    responses(
        (status = 200, description = "Post found", body = PostDto),
        (status = 404, description = "Post not found")
    )
)]
pub async fn get_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let repo = SeaPostRepository::new(state.db.clone());

    match repo.find_by_id(&id).await {
        Ok(Some(post)) => Ok(Json(PostDto::from(post))),
        Ok(None) => Err((StatusCode::NOT_FOUND, format!("Post not found: {id}"))),
        Err(err) => Err(map_db_error(err)),
    }
}

#[utoipa::path(
    post,
    path = "/api/posts",
    request_body = CreatePostRequest,
    responses(
        (status = 201, description = "Post created", body = PostDto)
    )
)]
pub async fn create_post(
    State(state): State<AppState>,
    Json(payload): Json<CreatePostRequest>,
) -> impl IntoResponse {
    let repo = SeaPostRepository::new(state.db.clone());

    let now = Utc::now();
    let post = Post {
        id: uuid::Uuid::new_v4().to_string(),
        title: payload.title,
        body: payload.body,
        created_at: now,
        updated_at: now,
    };

    match repo.create(&post).await {
        Ok(created) => Ok((StatusCode::CREATED, Json(PostDto::from(created)))),
        Err(err) => Err(map_db_error(err)),
    }
}

#[utoipa::path(
    patch,
    path = "/api/posts/{id}",
    params(
        ("id" = String, Path, description = "Post ID")
    ),
    request_body = UpdatePostRequest,
    responses(
        (status = 200, description = "Post updated", body = PostDto),
        (status = 404, description = "Post not found")
    )
)]
pub async fn update_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePostRequest>,
) -> impl IntoResponse {
    let repo = SeaPostRepository::new(state.db.clone());

    let existing = match repo.find_by_id(&id).await {
        Ok(Some(post)) => post,
        Ok(None) => return Err((StatusCode::NOT_FOUND, format!("Post not found: {id}"))),
        Err(err) => return Err(map_db_error(err)),
    };

    let updated = Post {
        id: existing.id,
        title: payload.title.unwrap_or(existing.title),
        body: payload.body.unwrap_or(existing.body),
        created_at: existing.created_at,
        updated_at: Utc::now(),
    };

    match repo.update(&updated).await {
        Ok(post) => Ok(Json(PostDto::from(post))),
        Err(err) => Err(map_db_error(err)),
    }
}

#[utoipa::path(
    delete,
    path = "/api/posts/{id}",
    params(
        ("id" = String, Path, description = "Post ID")
    ),
    responses(
        (status = 204, description = "Post deleted"),
        (status = 404, description = "Post not found")
    )
)]
pub async fn delete_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let repo = SeaPostRepository::new(state.db.clone());

    match repo.delete(&id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(err) => Err(map_db_error(err)),
    }
}
