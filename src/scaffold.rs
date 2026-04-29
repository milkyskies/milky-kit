use anyhow::{bail, Context, Result};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::config::{self, ProjectVars};
use crate::template;

pub fn run(kit_home: &Path) -> Result<()> {
    let config = config::load_kit_config()?;
    let module_names = config.module_names();
    let apps = config.resolved_apps();
    let app_templates: HashSet<String> = apps.iter().map(|a| a.template.clone()).collect();

    println!("Scaffolding project '{}'...\n", config.project.name);

    let base_vars = config.template_vars(kit_home);
    let mut created = 0;
    let mut skipped = 0;
    // Files written by this run, used to detect base/variant path collisions
    // within the same module/app. User-edited pre-existing files are not in
    // this set and remain skipped silently.
    let mut written: HashSet<String> = HashSet::new();

    // Render infrastructure modules (one-shot, no app context). App templates
    // are skipped here and rendered per-app below.
    for module_name in &module_names {
        if app_templates.contains(module_name) {
            continue;
        }
        render_module(
            kit_home,
            module_name,
            &HashMap::new(),
            &base_vars,
            &mut created,
            &mut skipped,
            &mut written,
        )?;
    }

    // Render app templates once per [[apps]] entry, with app_name in scope.
    for app in &apps {
        let mut vars = base_vars.clone();
        vars.extra.insert("app_name".into(), app.name.clone());
        render_module(
            kit_home,
            &app.template,
            &app.variants,
            &vars,
            &mut created,
            &mut skipped,
            &mut written,
        )?;
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
fn render_module(
    kit_home: &Path,
    module_name: &str,
    variants: &HashMap<String, String>,
    vars: &ProjectVars,
    created: &mut usize,
    skipped: &mut usize,
    written: &mut HashSet<String>,
) -> Result<()> {
    let module_dir = kit_home.join("modules").join(module_name);

    let scaffold_dir = module_dir.join("scaffold");
    if scaffold_dir.exists() {
        copy_tree(
            &scaffold_dir,
            module_name,
            vars,
            created,
            skipped,
            written,
            None,
        )?;
    }

    let manifest = config::load_module_manifest(&module_dir)?;
    for (axis, axis_def) in &manifest.variants {
        let chosen = config::KitConfig::resolve_variant(variants, module_name, axis, axis_def)?;
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
            vars,
            created,
            skipped,
            written,
            Some(module_name),
        )?;
    }
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
        // `rules/` is sync-managed (lands in .claude/rules/), not scaffold-copied.
        // Skip it here so a variant directory with both `apps/` and `rules/`
        // doesn't dump rules at the project root.
        if relative.starts_with("rules") {
            continue;
        }
        // Path itself is templated: `apps/{{app_name}}/...` -> `apps/client/...`
        let dest = template::render(&relative.to_string_lossy(), vars);

        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let raw_content = if template::is_text_ext(ext) {
            let raw = fs::read_to_string(entry.path())?;
            template::render(&raw, vars)
        } else {
            fs::read_to_string(entry.path()).unwrap_or_default()
        };

        // Variant overlap handling. JSON files deep-merge with the base file
        // (so a variant can add deps/scripts to package.json without owning
        // the whole file). Other files: variant collision is a hard error
        // because we have no merge strategy and silent override would be
        // confusing.
        let is_variant = variant_of_module.is_some();
        let base_existed = written.contains(&dest);
        let content = if is_variant && base_existed && ext == "json" {
            let base_text = fs::read_to_string(&dest)?;
            let base_json: serde_json::Value = serde_json::from_str(&base_text)
                .with_context(|| format!("Parsing base JSON at {} for variant merge", dest))?;
            let overlay_json: serde_json::Value = serde_json::from_str(&raw_content)
                .with_context(|| format!("Parsing variant JSON from {}", entry.path().display()))?;
            let merged = template::merge_json(base_json, overlay_json);
            // Use tab indent to match the conventional formatting in this kit.
            let mut buf = Vec::new();
            let formatter = serde_json::ser::PrettyFormatter::with_indent(b"\t");
            let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
            use serde::Serialize;
            merged.serialize(&mut ser)?;
            String::from_utf8(buf)? + "\n"
        } else {
            if let Some(module) = variant_of_module {
                if base_existed {
                    bail!(
                        "Variant '{}' overlaps base scaffold path '{}' in module '{}' — non-JSON files cannot be merged; rename the variant file or move it to a unique path",
                        source_label,
                        dest,
                        module
                    );
                }
            }
            if Path::new(&dest).exists() && !base_existed {
                *skipped += 1;
                continue;
            }
            raw_content
        };

        if let Some(parent) = Path::new(&dest).parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)?;
            }
        }
        fs::write(&dest, content)?;
        written.insert(dest.clone());
        let verb = if base_existed { "~" } else { "+" };
        println!("  {} {} (from {})", verb, dest, source_label);
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
