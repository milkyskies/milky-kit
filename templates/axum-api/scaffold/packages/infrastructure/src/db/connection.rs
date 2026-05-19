use sea_orm::{Database, DatabaseConnection, DbErr};

pub async fn connect(database_url: &str) -> Result<DatabaseConnection, DbErr> {
    Database::connect(database_url).await
}
