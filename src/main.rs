use anyhow::Result;
use clap::{Parser, Subcommand};

mod config;
mod manifest;
mod sync;
mod template;

#[derive(Parser)]
#[command(
    name = "milky-kit",
    about = "Manage shared Claude Code rules, skills, and configs across projects"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Path to milky-kit home directory
    #[arg(long, env = "MILKY_KIT_HOME")]
    kit_home: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Sync modules and skills into the current project
    Sync {
        /// Show what would change without writing
        #[arg(long)]
        dry_run: bool,
    },
    /// Show what would change on next sync
    Diff,
    /// Create a starter .claude/kit.toml
    Init,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Sync { dry_run } => {
            let kit_home = config::resolve_kit_home(cli.kit_home)?;
            sync::run(&kit_home, dry_run)
        }
        Commands::Diff => {
            let kit_home = config::resolve_kit_home(cli.kit_home)?;
            sync::run(&kit_home, true)
        }
        Commands::Init => config::init_kit_toml(),
    }
}
