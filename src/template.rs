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

/// Strip `//` line comments and `/* ... */` block comments from a JSONC source
/// so it can be parsed by a plain JSON parser. Comments inside string literals
/// are preserved by tracking string state (with `\\` escape handling).
///
/// Trailing commas (the other JSONC nicety) aren't stripped — none of our
/// templates use them. If we add some later, extend this with a second pass.
pub fn strip_jsonc_comments(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    let mut in_string = false;
    let mut escaped = false;

    while i < bytes.len() {
        let c = bytes[i];

        if in_string {
            out.push(c as char);
            if escaped {
                escaped = false;
            } else if c == b'\\' {
                escaped = true;
            } else if c == b'"' {
                in_string = false;
            }
            i += 1;
            continue;
        }

        if c == b'"' {
            in_string = true;
            out.push('"');
            i += 1;
            continue;
        }

        // Line comment: `//` -> skip to end of line (but keep the newline).
        if c == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'/' {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }

        // Block comment: `/* ... */` -> skip everything inside, including
        // newlines. JSON parsers don't care about extra whitespace afterwards.
        if c == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
            continue;
        }

        out.push(c as char);
        i += 1;
    }

    out
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
