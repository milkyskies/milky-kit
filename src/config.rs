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
    #[serde(default)]
    pub sync: SyncConfig,
    /// Legacy flat module list (backwards compatible)
    pub modules: Option<LegacyModuleSelection>,
}

#[derive(Deserialize, Default)]
pub struct SyncConfig {
    /// Files to skip during sync (project manages them manually)
    #[serde(default)]
    pub exclude: Vec<String>,
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
    pub database: Option<String>,
    pub orm: Option<String>,
    pub frontend: Option<String>,
    pub ui: Option<String>,
    #[serde(default)]
    pub tauri: bool,
    /// Legacy — inferred automatically now, but still accepted for backwards compat
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
        let has_rust = self.stack.languages.contains(&"rust".to_string());
        let has_js = self.stack.frontend.is_some()
            || self.stack.languages.contains(&"ts".to_string())
            || self.stack.languages.contains(&"floe".to_string());

        for lang in &self.stack.languages {
            if !modules.contains(lang) {
                modules.push(lang.clone());
            }
        }
        if let Some(ref b) = self.stack.backend {
            modules.push(b.clone());
        }
        if let Some(ref db) = self.stack.database {
            if !modules.contains(db) {
                modules.push(db.clone());
            }
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

        // Auto-inferred
        if has_rust {
            modules.push("monorepo".to_string());
        }
        if has_js {
            modules.push("pnpm".to_string());
        }
        // React currently requires TypeScript
        if self.stack.frontend == Some("react".to_string())
            && !modules.contains(&"ts".to_string())
        {
            modules.push("ts".to_string());
        }
        if self.stack.tauri {
            modules.push("tauri".to_string());
        }

        // Legacy tools field (backwards compat)
        for tool in &self.stack.tools {
            if !modules.contains(tool) {
                modules.push(tool.clone());
            }
        }

        modules
    }

    /// Get template variables: project vars + stack-derived vars.
    pub fn template_vars(&self) -> ProjectVars {
        let mut extra = self.project.extra.clone();

        // Absolute path of the project root (cwd at sync time) for
        // cargo target-dir and other machine-specific paths.
        if let Ok(cwd) = std::env::current_dir() {
            if let Some(s) = cwd.to_str() {
                extra.insert("project_root".into(), s.to_string());
            }
        }

        // Derive db_driver from database choice (for ORM Cargo.toml features)
        match self.stack.database.as_deref() {
            Some("postgres") => {
                extra.insert("db_driver".into(), "sqlx-postgres".into());
                extra.insert("db_url_example".into(), format!(
                    "postgres://{}:{}@localhost:5432/{}",
                    self.project.name, self.project.name, self.project.name
                ));
            }
            Some("sqlite") => {
                extra.insert("db_driver".into(), "sqlx-sqlite".into());
                extra.insert("db_url_example".into(), "sqlite://data.db".into());
            }
            _ => {}
        }

        ProjectVars {
            name: self.project.name.clone(),
            worktree_dir: self.project.worktree_dir.clone(),
            extra,
        }
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
    let path = Path::new("milky-kit.toml");
    let content = std::fs::read_to_string(path)
        .context("Could not read milky-kit.toml — run 'milky-kit init' first")?;
    let config: KitConfig =
        toml::from_str(&content).context("Failed to parse milky-kit.toml")?;
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
    use dialoguer::{Input, Select};

    let path = Path::new("milky-kit.toml");
    if path.exists() {
        bail!("milky-kit.toml already exists");
    }

    println!("Setting up milky-kit for this project.\n");

    // Project name
    let default_name = std::env::current_dir()
        .ok()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_else(|| "my-project".to_string());

    let name: String = Input::new()
        .with_prompt("Project name")
        .default(default_name.clone())
        .interact_text()?;

    let worktree_dir = format!("{}-worktrees", name);

    // Backend language
    let lang_options = &[
        "rust    — Cargo workspace, clean architecture",
        "none    — no backend",
    ];
    let lang_idx = Select::new()
        .with_prompt("Backend language")
        .items(lang_options)
        .default(0)
        .interact()?;

    let language = if lang_idx == 0 {
        Some("rust".to_string())
    } else {
        None
    };

    // Backend framework (if language selected)
    let backend = if language.is_some() {
        let fw_options = &[
            "axum    — HTTP server, tower middleware, utoipa OpenAPI",
            "none    — library/CLI only, no HTTP server",
        ];
        let fw_idx = Select::new()
            .with_prompt("Backend framework")
            .items(fw_options)
            .default(0)
            .interact()?;
        if fw_idx == 0 {
            Some("axum".to_string())
        } else {
            None
        }
    } else {
        None
    };

    // Database (if backend selected)
    let (database, orm) = if backend.is_some() {
        let db_options = &[
            "postgres + seaorm  — PostgreSQL, entity ORM, Docker container",
            "postgres + sqlx    — PostgreSQL, compile-time SQL, Docker container",
            "sqlite + seaorm    — SQLite, file-based, no Docker (Cloudflare D1 compatible)",
            "sqlite + sqlx      — SQLite, compile-time SQL, no Docker (D1 compatible)",
            "none               — no database",
        ];
        let db_idx = Select::new()
            .with_prompt("Database")
            .items(db_options)
            .default(0)
            .interact()?;
        match db_idx {
            0 => (Some("postgres".to_string()), Some("seaorm".to_string())),
            1 => (Some("postgres".to_string()), Some("sqlx".to_string())),
            2 => (Some("sqlite".to_string()), Some("seaorm".to_string())),
            3 => (Some("sqlite".to_string()), Some("sqlx".to_string())),
            _ => (None, None),
        }
    } else {
        (None, None)
    };

    // Frontend
    let fe_options = &[
        "react   — TanStack Router + TanStack Query + Orval + Vite + Biome",
        "none    — no frontend",
    ];
    let fe_idx = Select::new()
        .with_prompt("Frontend framework")
        .items(fe_options)
        .default(0)
        .interact()?;

    let frontend = if fe_idx == 0 {
        Some("react".to_string())
    } else {
        None
    };

    // UI library (if frontend selected)
    let ui = if frontend.is_some() {
        let ui_options = &[
            "shadcn  — shadcn/ui + Tailwind CSS",
            "heroui  — HeroUI v3 + Tailwind CSS v4 + React Aria",
            "none    — just Tailwind, no component library",
        ];
        let ui_idx = Select::new()
            .with_prompt("UI library")
            .items(ui_options)
            .default(0)
            .interact()?;
        match ui_idx {
            0 => Some("shadcn".to_string()),
            1 => Some("heroui".to_string()),
            _ => None,
        }
    } else {
        None
    };

    // Tauri (optional, only if frontend selected)
    let tauri = if frontend.is_some() {
        let tauri_options = &[
            "no      — web only",
            "yes     — wrap frontend in Tauri (desktop + mobile)",
        ];
        let tauri_idx = Select::new()
            .with_prompt("Desktop/mobile app with Tauri?")
            .items(tauri_options)
            .default(0)
            .interact()?;
        tauri_idx == 1
    } else {
        false
    };

    // Build skills list
    let mut skills = vec![
        "ship", "rulify", "retrospective", "update-rule", "land",
    ];
    if frontend.is_some() {
        skills.extend(["setup-api-client", "tanstack-query-patterns", "add-endpoint"]);
    }
    if let Some(ref o) = orm {
        match o.as_str() {
            "seaorm" => skills.push("database-seaorm"),
            "sqlx" => skills.push("database-sqlx"),
            _ => {}
        }
    }

    // Build TOML
    let mut toml = format!(
        "[project]\nname = \"{}\"\nworktree_dir = \"{}\"\n\n[stack]\n",
        name, worktree_dir
    );

    if let Some(ref lang) = language {
        toml.push_str(&format!("languages = [\"{}\"]\n", lang));
    }
    if let Some(ref b) = backend {
        toml.push_str(&format!("backend = \"{}\"\n", b));
    }
    if let Some(ref db) = database {
        toml.push_str(&format!("database = \"{}\"\n", db));
    }
    if let Some(ref o) = orm {
        toml.push_str(&format!("orm = \"{}\"\n", o));
    }
    if let Some(ref f) = frontend {
        toml.push_str(&format!("frontend = \"{}\"\n", f));
    }
    if let Some(ref u) = ui {
        toml.push_str(&format!("ui = \"{}\"\n", u));
    }
    if tauri {
        toml.push_str("tauri = true\n");
    }

    toml.push_str("\n[skills]\ninclude = [\n");
    for skill in &skills {
        toml.push_str(&format!("    \"{}\",\n", skill));
    }
    toml.push_str("]\n");

    std::fs::write(path, &toml)?;

    println!("\nCreated milky-kit.toml");
    println!("Run 'milky-kit scaffold' to generate the project structure.");
    Ok(())
}
