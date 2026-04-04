use anyhow::Result;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::config;
use crate::template;

pub fn run(kit_home: &Path) -> Result<()> {
    let config = config::load_kit_config()?;
    let module_names = config.module_names();

    println!("Scaffolding project '{}'...\n", config.project.name);

    let mut created = 0;
    let mut skipped = 0;

    // Process each module's scaffold/ directory
    for module_name in &module_names {
        let scaffold_dir = kit_home.join("modules").join(module_name).join("scaffold");
        if !scaffold_dir.exists() {
            continue;
        }

        for entry in WalkDir::new(&scaffold_dir) {
            let entry = entry?;
            if !entry.file_type().is_file() {
                continue;
            }

            let relative = entry.path().strip_prefix(&scaffold_dir)?;
            let dest = relative.to_string_lossy().to_string();

            // Never overwrite existing files
            if Path::new(&dest).exists() {
                skipped += 1;
                continue;
            }

            // Read and template the file
            let ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let is_text = matches!(
                ext,
                "rs" | "toml" | "json" | "yaml" | "yml" | "ts" | "tsx" | "js" | "mjs" | "md"
                    | "sh" | "bash" | "txt" | "css" | "html" | "sql" | "lock" | "gitignore"
                    | "gitkeep" | "env" | "example" | ""
            );

            let content = if is_text {
                let raw = fs::read_to_string(entry.path())?;
                template::render(&raw, &config.template_vars())
            } else {
                fs::read_to_string(entry.path()).unwrap_or_default()
            };

            // Create parent directories and write
            if let Some(parent) = Path::new(&dest).parent() {
                if !parent.as_os_str().is_empty() {
                    fs::create_dir_all(parent)?;
                }
            }
            fs::write(&dest, content)?;
            println!("  + {} (from {})", dest, module_name);
            created += 1;
        }
    }

    // Generate .claude/rules/project-setup.md
    generate_project_setup_rule(&config)?;
    created += 1;

    println!(
        "\nScaffold complete: {} files created, {} skipped (already exist).",
        created, skipped
    );

    // Run sync to populate rules + skills
    println!("\nRunning sync for rules and skills...\n");
    crate::sync::run(kit_home, false)?;

    Ok(())
}

fn generate_project_setup_rule(config: &config::KitConfig) -> Result<()> {
    let path = ".claude/rules/project-setup.md";
    if Path::new(path).exists() {
        return Ok(());
    }

    let mut content = String::from("# Project Setup\n\nThis project was scaffolded with milky-kit.\n\n## Stack\n");

    for lang in &config.stack.languages {
        content.push_str(&format!("- Language: {}\n", lang));
    }
    if let Some(ref b) = config.stack.backend {
        content.push_str(&format!("- Backend: {}\n", b));
    }
    if let Some(ref o) = config.stack.orm {
        content.push_str(&format!("- ORM: {}\n", o));
    }
    if let Some(ref f) = config.stack.frontend {
        content.push_str(&format!("- Frontend: {}\n", f));
    }
    if let Some(ref u) = config.stack.ui {
        content.push_str(&format!("- UI: {}\n", u));
    }
    if !config.stack.tools.is_empty() {
        content.push_str(&format!("- Tools: {}\n", config.stack.tools.join(", ")));
    }

    content.push_str(
        r#"
## Starter resource

A `posts` CRUD resource is included as a working example across all layers.
When adding a new resource, follow the posts pattern in each layer.

## Development

All commands go through mise:
- `mise run dev` — start full stack
- `mise run check` — run all quality gates
- `mise run fmt` — format everything
- `mise run db:migrate` — run migrations
- `mise run api:generate` — regenerate OpenAPI client
- `mise run worktree:setup <num> <branch>` — create isolated worktree
"#,
    );

    fs::create_dir_all(".claude/rules")?;
    fs::write(path, content)?;
    println!("  + {} (project context for Claude)", path);
    Ok(())
}
