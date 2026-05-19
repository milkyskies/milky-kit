use async_trait::async_trait;

use crate::errors::RepositoryResult;
use crate::models::post::Post;

#[async_trait]
pub trait PostRepository: Send + Sync {
    async fn find_all(&self) -> RepositoryResult<Vec<Post>>;
    async fn find_by_id(&self, id: &str) -> RepositoryResult<Post>;
    async fn create(&self, post: &Post) -> RepositoryResult<Post>;
    async fn update(&self, post: &Post) -> RepositoryResult<Post>;
    async fn delete(&self, id: &str) -> RepositoryResult<()>;
}
