use anyhow::Result;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::config;
use crate::manifest::{self, Manifest};
use crate::template;

struct SyncAction {
    dest: String,
    content: String,
    source: String,
}

pub fn run(kit_home: &Path, dry_run: bool) -> Result<()> {
    let config = config::load_kit_config()?;
    let module_names = config.module_names();
    let mut managed: Vec<String> = Vec::new();
    let mut actions: Vec<SyncAction> = Vec::new();

    if !dry_run {
        fs::create_dir_all(".claude/rules")?;
        fs::create_dir_all(".claude/skills")?;
    }

    // Process modules
    for module_name in &module_names {
        let module_dir = kit_home.join("modules").join(module_name);
        if !module_dir.exists() {
            eprintln!("  ! module '{}' not found, skipping", module_name);
            continue;
        }

        // Sync rules/*.md -> .claude/rules/
        let rules_dir = module_dir.join("rules");
        if rules_dir.exists() {
            sync_rules(&rules_dir, module_name, &config, &mut actions, &mut managed)?;
        }

        // Sync files/* -> destinations per module.toml
        let module_manifest = config::load_module_manifest(&module_dir)?;
        for mapping in &module_manifest.files {
            let src = module_dir.join("files").join(&mapping.src);
            if !src.exists() {
                eprintln!(
                    "  ! file '{}' in module '{}' not found, skipping",
                    mapping.src, module_name
                );
                continue;
            }
            let content = fs::read_to_string(&src)?;
            let content = template::render(&content, &config.project);
            let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("");
            let content = template::add_managed_header(&content, ext);

            actions.push(SyncAction {
                dest: mapping.dest.clone(),
                content,
                source: format!("modules/{}/files/{}", module_name, mapping.src),
            });
            managed.push(mapping.dest.clone());
        }
    }

    // Process skills
    for skill_name in &config.skills.include {
        let skill_dir = kit_home.join("skills").join(skill_name);
        if !skill_dir.exists() {
            eprintln!("  ! skill '{}' not found, skipping", skill_name);
            continue;
        }
        let dest_prefix = format!(".claude/skills/{}", skill_name);
        sync_directory(
            &skill_dir,
            &dest_prefix,
            skill_name,
            &config,
            &mut actions,
            &mut managed,
        )?;
    }

    // Report changes
    if actions.is_empty() {
        println!("Everything up to date.");
        return Ok(());
    }

    let mut created = 0;
    let mut updated = 0;
    let mut unchanged = 0;

    for action in &actions {
        let status = if Path::new(&action.dest).exists() {
            let existing = fs::read_to_string(&action.dest).unwrap_or_default();
            if existing == action.content {
                unchanged += 1;
                "unchanged"
            } else {
                updated += 1;
                "update"
            }
        } else {
            created += 1;
            "create"
        };

        match status {
            "create" => println!("  + {} <- {}", action.dest, action.source),
            "update" => println!("  ~ {} <- {}", action.dest, action.source),
            _ => {}
        }
    }

    if dry_run {
        println!(
            "\nDry run: {} to create, {} to update, {} unchanged.",
            created, updated, unchanged
        );
        return Ok(());
    }

    // Write files
    for action in &actions {
        if let Some(parent) = Path::new(&action.dest).parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&action.dest, &action.content)?;
    }

    // Clean up files that were managed before but are no longer
    let old_manifest = manifest::load();
    let mut removed = 0;
    for old_file in &old_manifest.managed {
        if !managed.contains(old_file) && Path::new(old_file.as_str()).exists() {
            let content = fs::read_to_string(old_file).unwrap_or_default();
            if template::is_managed(&content) {
                println!("  - {} (removed from config)", old_file);
                fs::remove_file(old_file)?;
                removed += 1;
            }
        }
    }

    manifest::save(&Manifest { managed })?;

    println!(
        "\nSync complete: {} created, {} updated, {} removed, {} unchanged.",
        created, updated, removed, unchanged
    );
    Ok(())
}

fn sync_rules(
    rules_dir: &Path,
    module_name: &str,
    config: &config::KitConfig,
    actions: &mut Vec<SyncAction>,
    managed: &mut Vec<String>,
) -> Result<()> {
    for entry in fs::read_dir(rules_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let filename = entry.file_name().to_string_lossy().to_string();
        let content = fs::read_to_string(&path)?;
        let content = template::render(&content, &config.project);
        let content = template::add_managed_header(&content, "md");
        let dest = format!(".claude/rules/{}", filename);

        actions.push(SyncAction {
            dest: dest.clone(),
            content,
            source: format!("modules/{}/rules/{}", module_name, filename),
        });
        managed.push(dest);
    }
    Ok(())
}

fn sync_directory(
    src_dir: &Path,
    dest_prefix: &str,
    source_label: &str,
    config: &config::KitConfig,
    actions: &mut Vec<SyncAction>,
    managed: &mut Vec<String>,
) -> Result<()> {
    for entry in WalkDir::new(src_dir) {
        let entry = entry?;
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = entry.path().strip_prefix(src_dir)?;
        let dest = format!("{}/{}", dest_prefix, relative.display());

        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        let is_text = matches!(
            ext,
            "md" | "toml" | "json" | "yaml" | "yml" | "ts" | "js" | "mjs" | "sh" | "bash"
                | "txt" | "css" | "html"
        );

        let content = if is_text {
            let raw = fs::read_to_string(entry.path())?;
            template::render(&raw, &config.project)
        } else {
            fs::read_to_string(entry.path()).unwrap_or_default()
        };

        actions.push(SyncAction {
            dest: dest.clone(),
            content,
            source: format!("skills/{}/{}", source_label, relative.display()),
        });
        managed.push(dest);
    }
    Ok(())
}
