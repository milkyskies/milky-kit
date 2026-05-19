use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, DbErr, EntityTrait,
    QueryFilter, QueryOrder,
};

use domain::models::post::Post;
use domain::repositories::post_repository::PostRepository;

use crate::db::entities::post;

pub struct SeaPostRepository {
    db: DatabaseConnection,
}

impl SeaPostRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

impl From<post::Model> for Post {
    fn from(model: post::Model) -> Self {
        Post {
            id: model.id,
            title: model.title,
            body: model.body,
            created_at: model.created_at.naive_utc().and_utc(),
            updated_at: model.updated_at.naive_utc().and_utc(),
        }
    }
}

impl PostRepository for SeaPostRepository {
    async fn find_all(&self) -> Result<Vec<Post>, DbErr> {
        Ok(post::Entity::find()
            .order_by_desc(post::Column::CreatedAt)
            .all(&self.db)
            .await?
            .into_iter()
            .map(Post::from)
            .collect())
    }

    async fn find_by_id(&self, id: &str) -> Result<Option<Post>, DbErr> {
        Ok(post::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .map(Post::from))
    }

    async fn create(&self, post: &Post) -> Result<Post, DbErr> {
        let active_model = post::ActiveModel {
            id: Set(post.id.clone()),
            title: Set(post.title.clone()),
            body: Set(post.body.clone()),
            created_at: Set(post.created_at.into()),
            updated_at: Set(post.updated_at.into()),
        };

        let result = active_model.insert(&self.db).await?;
        Ok(Post::from(result))
    }

    async fn update(&self, post: &Post) -> Result<Post, DbErr> {
        let existing = post::Entity::find_by_id(&post.id)
            .one(&self.db)
            .await?
            .ok_or(DbErr::RecordNotFound(format!(
                "Post not found: {}",
                post.id
            )))?;

        let mut active_model: post::ActiveModel = existing.into();
        active_model.title = Set(post.title.clone());
        active_model.body = Set(post.body.clone());
        active_model.updated_at = Set(post.updated_at.into());

        let result = active_model.update(&self.db).await?;
        Ok(Post::from(result))
    }

    async fn delete(&self, id: &str) -> Result<(), DbErr> {
        post::Entity::delete_by_id(id).exec(&self.db).await?;
        Ok(())
    }
}
