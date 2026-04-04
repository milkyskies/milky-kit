use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
pub struct KitConfig {
    pub project: ProjectVars,
    pub modules: ModuleSelection,
    #[serde(default)]
    pub skills: SkillSelection,
}

#[derive(Deserialize)]
pub struct ProjectVars {
    pub name: String,
    pub worktree_dir: String,
    /// Additional custom variables for templates
    #[serde(flatten)]
    pub extra: HashMap<String, String>,
}

#[derive(Deserialize)]
pub struct ModuleSelection {
    pub include: Vec<String>,
}

#[derive(Deserialize, Default)]
pub struct SkillSelection {
    #[serde(default)]
    pub include: Vec<String>,
}

#[derive(Deserialize, Default)]
pub struct ModuleManifest {
    #[serde(default)]
    pub files: Vec<FileMapping>,
}

#[derive(Deserialize)]
pub struct FileMapping {
    pub src: String,
    pub dest: String,
}

pub fn resolve_kit_home(explicit: Option<String>) -> Result<PathBuf> {
    if let Some(path) = explicit {
        let p = PathBuf::from(path);
        if p.exists() {
            return Ok(p);
        }
        bail!("Specified kit home does not exist: {}", p.display());
    }

    if let Ok(path) = std::env::var("MILKY_KIT_HOME") {
        let p = PathBuf::from(path);
        if p.exists() {
            return Ok(p);
        }
        bail!("MILKY_KIT_HOME does not exist: {}", p.display());
    }

    let home = dirs::home_dir().context("Could not determine home directory")?;
    let default = home.join(".milky-kit");

    if default.exists() {
        Ok(default)
    } else {
        bail!(
            "milky-kit home not found. Either:\n  \
             - Clone your milky-kit repo to ~/.milky-kit\n  \
             - Set MILKY_KIT_HOME to its location\n  \
             - Pass --kit-home <path>"
        )
    }
}

pub fn load_kit_config() -> Result<KitConfig> {
    let path = Path::new(".claude/kit.toml");
    let content = std::fs::read_to_string(path)
        .context("Could not read .claude/kit.toml — run 'milky-kit init' first")?;
    let config: KitConfig =
        toml::from_str(&content).context("Failed to parse .claude/kit.toml")?;
    Ok(config)
}

pub fn load_module_manifest(module_dir: &Path) -> Result<ModuleManifest> {
    let path = module_dir.join("module.toml");
    if !path.exists() {
        return Ok(ModuleManifest::default());
    }
    let content = std::fs::read_to_string(&path)?;
    let manifest: ModuleManifest = toml::from_str(&content)?;
    Ok(manifest)
}

pub fn init_kit_toml() -> Result<()> {
    let path = Path::new(".claude/kit.toml");
    if path.exists() {
        bail!(".claude/kit.toml already exists");
    }

    std::fs::create_dir_all(".claude")?;

    let template = r#"[project]
name = "my-project"
worktree_dir = "my-project-worktrees"

[modules]
include = [
    "core",
    # "rust",
    # "react",
    # "seaorm",
    # "sqlx",
    # "shadcn",
    # "heroui",
    # "monorepo",
    # "pnpm",
    # "tauri",
]

[skills]
include = [
    "ship",
    "rulify",
    "alignify",
    "retrospective",
    "update-rule",
    "land",
    # "setup-api-client",
    # "tanstack-query-patterns",
    # "heroui-react",
    # "add-endpoint",
    # "database-seaorm",
    # "database-sqlx",
]
"#;

    std::fs::write(path, template)?;
    println!("Created .claude/kit.toml — edit it to configure your project.");
    Ok(())
}
