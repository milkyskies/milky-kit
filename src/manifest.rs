use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Serialize, Deserialize, Default)]
pub struct Manifest {
    pub kit_version: Option<String>,
    pub kit_commit: Option<String>,
    pub last_sync: Option<String>,
    pub managed: Vec<String>,
}

pub fn load() -> Manifest {
    let path = Path::new(".claude/.managed");
    if let Ok(content) = std::fs::read_to_string(path) {
        toml::from_str(&content).unwrap_or_default()
    } else {
        Manifest::default()
    }
}

pub fn save(manifest: &Manifest, kit_home: &Path) -> Result<()> {
    let commit = get_git_commit(kit_home);
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

    let manifest = Manifest {
        kit_version: Some(env!("CARGO_PKG_VERSION").to_string()),
        kit_commit: commit,
        last_sync: Some(now),
        managed: manifest.managed.clone(),
    };

    let content = toml::to_string_pretty(&manifest)?;
    std::fs::write(".claude/.managed", content)?;
    Ok(())
}

fn get_git_commit(kit_home: &Path) -> Option<String> {
    Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .current_dir(kit_home)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
}
