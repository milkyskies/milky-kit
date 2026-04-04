use clap::{Parser, Subcommand};
use sea_orm::Database;
use sea_orm_migration::MigratorTrait;
use tracing_subscriber::EnvFilter;

mod migrator;

#[derive(Parser)]
#[command(name = "db", about = "Database migration runner")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Apply all pending migrations
    Migrate,
    /// Show migration status
    Status,
    /// Rollback last migration
    Rollback,
    /// Reset database (rollback all, then migrate)
    Reset,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
    dotenvy::dotenv().ok();

    let cli = Cli::parse();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set (or use .env)");
    let db = Database::connect(&database_url).await?;

    match cli.command {
        Command::Migrate => {
            tracing::info!("running migrations");
            migrator::Migrator::up(&db, None).await?;
            tracing::info!("all migrations complete");
        }
        Command::Status => {
            migrator::Migrator::status(&db).await?;
        }
        Command::Rollback => {
            tracing::info!("rolling back last migration");
            migrator::Migrator::down(&db, Some(1)).await?;
            tracing::info!("rollback complete");
        }
        Command::Reset => {
            tracing::info!("resetting database");
            migrator::Migrator::fresh(&db).await?;
            tracing::info!("reset complete");
        }
    }

    Ok(())
}
