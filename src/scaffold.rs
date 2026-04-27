use anyhow::{bail, Result};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::config::{self, ProjectVars};
use crate::template;

pub fn run(kit_home: &Path) -> Result<()> {
    let config = config::load_kit_config()?;
    let module_names = config.module_names();
    let vars = config.template_vars(kit_home);

    println!("Scaffolding project '{}'...\n", config.project.name);

    let mut created = 0;
    let mut skipped = 0;
    // Files written by this run, used to detect base/variant path collisions
    // within the same module. User-edited pre-existing files are not in this
    // set and remain skipped silently.
    let mut written: HashSet<String> = HashSet::new();

    for module_name in &module_names {
        let module_dir = kit_home.join("modules").join(module_name);

        let scaffold_dir = module_dir.join("scaffold");
        if scaffold_dir.exists() {
            copy_tree(
                &scaffold_dir,
                module_name,
                &vars,
                &mut created,
                &mut skipped,
                &mut written,
                None,
            )?;
        }

        let manifest = config::load_module_manifest(&module_dir)?;
        for (axis, axis_def) in &manifest.variants {
            let chosen = config.chosen_variant(module_name, axis, axis_def)?;
            let variant_dir = module_dir.join("variants").join(axis).join(chosen);
            if !variant_dir.exists() {
                bail!(
                    "Module '{}' declares variant {}={} but directory '{}' is missing",
                    module_name,
                    axis,
                    chosen,
                    variant_dir.display()
                );
            }
            let label = format!("{}[{}={}]", module_name, axis, chosen);
            copy_tree(
                &variant_dir,
                &label,
                &vars,
                &mut created,
                &mut skipped,
                &mut written,
                Some(module_name.as_str()),
            )?;
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

#[allow(clippy::too_many_arguments)]
fn copy_tree(
    src_dir: &Path,
    source_label: &str,
    vars: &ProjectVars,
    created: &mut usize,
    skipped: &mut usize,
    written: &mut HashSet<String>,
    // When Some(module), this is a variant overlay — colliding with a path the
    // base scaffold wrote in this run is a configuration error.
    variant_of_module: Option<&str>,
) -> Result<()> {
    for entry in WalkDir::new(src_dir) {
        let entry = entry?;
        if !entry.file_type().is_file() {
            continue;
        }

        let relative = entry.path().strip_prefix(src_dir)?;
        let dest = relative.to_string_lossy().to_string();

        if let Some(module) = variant_of_module {
            if written.contains(&dest) {
                bail!(
                    "Variant '{}' overlaps base scaffold path '{}' in module '{}' — variants must not write paths the base scaffold also writes",
                    source_label,
                    dest,
                    module
                );
            }
        }

        if Path::new(&dest).exists() {
            *skipped += 1;
            continue;
        }

        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let content = if template::is_text_ext(ext) {
            let raw = fs::read_to_string(entry.path())?;
            template::render(&raw, vars)
        } else {
            fs::read_to_string(entry.path()).unwrap_or_default()
        };

        if let Some(parent) = Path::new(&dest).parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)?;
            }
        }
        fs::write(&dest, content)?;
        written.insert(dest.clone());
        println!("  + {} (from {})", dest, source_label);
        *created += 1;
    }
    Ok(())
}

fn generate_project_setup_rule(config: &config::KitConfig) -> Result<()> {
    let path = ".claude/rules/project-setup.md";
    if Path::new(path).exists() {
        return Ok(());
    }

    let mut content = String::from(
        "# Project Setup\n\nThis project was scaffolded with milky-kit.\n\n## Stack\n",
    );

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
