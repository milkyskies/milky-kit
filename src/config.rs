use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
pub struct KitConfig {
    pub project: ProjectVars,
    #[serde(default)]
    pub stack: StackConfig,
    #[serde(default)]
    pub skills: SkillSelection,
    /// Legacy flat module list (backwards compatible)
    pub modules: Option<LegacyModuleSelection>,
}

#[derive(Deserialize)]
pub struct ProjectVars {
    pub name: String,
    pub worktree_dir: String,
    #[serde(flatten)]
    pub extra: HashMap<String, String>,
}

#[derive(Deserialize, Default)]
pub struct StackConfig {
    #[serde(default)]
    pub languages: Vec<String>,
    pub backend: Option<String>,
    pub orm: Option<String>,
    pub frontend: Option<String>,
    pub ui: Option<String>,
    #[serde(default)]
    pub tools: Vec<String>,
}

#[derive(Deserialize)]
pub struct LegacyModuleSelection {
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

impl KitConfig {
    /// Collect all module names from the config (core is always included).
    pub fn module_names(&self) -> Vec<String> {
        let mut modules = vec!["core".to_string()];

        // Legacy format: [modules] include = [...]
        if let Some(ref m) = self.modules {
            for name in &m.include {
                if name != "core" && !modules.contains(name) {
                    modules.push(name.clone());
                }
            }
            return modules;
        }

        // New format: [stack]
        for lang in &self.stack.languages {
            if !modules.contains(lang) {
                modules.push(lang.clone());
            }
        }
        if let Some(ref b) = self.stack.backend {
            modules.push(b.clone());
        }
        if let Some(ref o) = self.stack.orm {
            modules.push(o.clone());
        }
        if let Some(ref f) = self.stack.frontend {
            modules.push(f.clone());
        }
        if let Some(ref u) = self.stack.ui {
            modules.push(u.clone());
        }
        for tool in &self.stack.tools {
            if !modules.contains(tool) {
                modules.push(tool.clone());
            }
        }

        modules
    }

    /// Validate that the stack configuration is coherent.
    pub fn validate(&self) -> Result<()> {
        if self.modules.is_some() {
            return Ok(()); // Skip validation for legacy format
        }

        let langs = &self.stack.languages;

        if let Some(ref backend) = self.stack.backend {
            match backend.as_str() {
                "axum" if !langs.contains(&"rust".to_string()) => {
                    bail!("axum requires 'rust' in languages");
                }
                "hono" if !langs.contains(&"floe".to_string()) && !langs.contains(&"ts".to_string()) => {
                    bail!("hono requires 'floe' or 'ts' in languages");
                }
                _ => {}
            }
        }

        if let Some(ref orm) = self.stack.orm {
            match orm.as_str() {
                "seaorm" | "sqlx" if !langs.contains(&"rust".to_string()) => {
                    bail!("{} requires 'rust' in languages", orm);
                }
                _ => {}
            }
        }

        Ok(())
    }
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
    let path = Path::new(".claude/milky-kit.toml");
    let content = std::fs::read_to_string(path)
        .context("Could not read .claude/milky-kit.toml — run 'milky-kit init' first")?;
    let config: KitConfig =
        toml::from_str(&content).context("Failed to parse .claude/milky-kit.toml")?;
    config.validate()?;
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
    let path = Path::new(".claude/milky-kit.toml");
    if path.exists() {
        bail!(".claude/milky-kit.toml already exists");
    }

    std::fs::create_dir_all(".claude")?;

    let template = r#"[project]
name = "my-project"
worktree_dir = "my-project-worktrees"

[stack]
languages = ["rust"]
# backend = "axum"
# orm = "seaorm"
# frontend = "react"
# ui = "shadcn"         # or "heroui"
# tools = ["pnpm", "monorepo"]

[skills]
include = [
    "ship",
    "rulify",
    "alignify",
    "retrospective",
    "update-rule",
    "land",
]
"#;

    std::fs::write(path, template)?;
    println!("Created .claude/milky-kit.toml — edit it to configure your project.");
    Ok(())
}
