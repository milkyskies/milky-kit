mod config;
mod presentation;

use config::Config;
use presentation::openapi::ApiDoc;
use presentation::routes::app_router;
use sea_orm::Database;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(Clone)]
pub struct AppState {
    pub db: sea_orm::DatabaseConnection,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = Config::from_env()?;

    tracing::info!("Connecting to database...");
    let db = Database::connect(&config.database_url).await?;
    tracing::info!("Database connected");

    let state = AppState { db };

    let cors = CorsLayer::very_permissive();

    let app = app_router(state)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!("Listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;

    Ok(())
}
