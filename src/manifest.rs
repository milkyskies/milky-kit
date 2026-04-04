use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Default)]
pub struct Manifest {
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

pub fn save(manifest: &Manifest) -> Result<()> {
    let content = toml::to_string_pretty(manifest)?;
    std::fs::write(".claude/.managed", content)?;
    Ok(())
}
