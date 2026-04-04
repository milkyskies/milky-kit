use utoipa::OpenApi;

use super::dto::{CreatePostRequest, PostDto, PostListResponse, UpdatePostRequest};
use super::post_handler;

#[derive(OpenApi)]
#[openapi(
    paths(
        post_handler::list_posts,
        post_handler::get_post,
        post_handler::create_post,
        post_handler::update_post,
        post_handler::delete_post,
    ),
    components(schemas(
        PostDto,
        PostListResponse,
        CreatePostRequest,
        UpdatePostRequest,
    ))
)]
pub struct ApiDoc;
