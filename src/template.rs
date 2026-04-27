use crate::config::ProjectVars;

pub fn render(content: &str, vars: &ProjectVars) -> String {
    let mut result = content
        .replace("{{project_name}}", &vars.name)
        .replace("{{worktree_dir}}", &vars.worktree_dir);

    for (key, value) in &vars.extra {
        let placeholder = format!("{{{{{}}}}}", key);
        result = result.replace(&placeholder, value);
    }

    result
}

const MD_HEADER: &str =
    "<!-- managed by milky-kit | DO NOT EDIT — changes will be overwritten on next sync -->\n\n";
const TOML_HEADER: &str =
    "# managed by milky-kit | DO NOT EDIT — changes will be overwritten on next sync\n\n";
const HASH_HEADER: &str =
    "# managed by milky-kit | DO NOT EDIT — changes will be overwritten on next sync\n\n";

pub fn add_managed_header(content: &str, extension: &str) -> String {
    match extension {
        "md" => format!("{MD_HEADER}{content}"),
        "toml" => format!("{TOML_HEADER}{content}"),
        "yml" | "yaml" | "sh" | "bash" | "zsh" => format!("{HASH_HEADER}{content}"),
        _ => content.to_string(),
    }
}

pub fn is_managed(content: &str) -> bool {
    content.contains("managed by milky-kit")
}

/// Deep-merge two JSON values: overlay keys win on object conflicts; recurses
/// into nested objects; arrays and primitives are replaced wholesale (no
/// concat). Used to merge variant package.json into base package.json without
/// duplicating the whole file in each variant.
pub fn merge_json(base: serde_json::Value, overlay: serde_json::Value) -> serde_json::Value {
    use serde_json::Value;
    match (base, overlay) {
        (Value::Object(mut b), Value::Object(o)) => {
            for (k, v) in o {
                let merged = match b.remove(&k) {
                    Some(existing) => merge_json(existing, v),
                    None => v,
                };
                b.insert(k, merged);
            }
            Value::Object(b)
        }
        (_, overlay) => overlay,
    }
}

/// Whether a file extension is treated as templatable text.
/// Empty string means "no extension" — also treated as text (e.g. `.gitignore`-less files).
pub fn is_text_ext(ext: &str) -> bool {
    matches!(
        ext,
        "rs" | "toml"
            | "json"
            | "jsonc"
            | "yaml"
            | "yml"
            | "ts"
            | "tsx"
            | "js"
            | "mjs"
            | "md"
            | "sh"
            | "bash"
            | "txt"
            | "css"
            | "html"
            | "sql"
            | "lock"
            | "gitignore"
            | "gitkeep"
            | "env"
            | "example"
            | ""
    )
}
