# milky-kit

Scaffold full-stack projects from composable templates and keep their shared rules/skills/configs in sync. Built around three ideas:

- **Modules** — reusable units (`react`, `hono`, `rust`, `axum`, etc.) that ship rules, mise tasks, and scaffold trees
- **Apps** — instances of a template inside a project (`apps/api`, `apps/client`, `apps/admin`) — same template, different name
- **Variants** — swappable parts of a template (e.g. `db = "neon" | "d1" | "supabase"`, `mobile = "tauri" | "capacitor" | "none"`) that overlay onto the base scaffold

## Install

```bash
git clone git@github.com:milkyskies/milky-kit.git ~/.milky-kit
cd ~/.milky-kit && cargo install --path .
```

Or set `MILKY_KIT_HOME` to wherever you cloned it and run from there.

## Quick start

```bash
mkdir my-app && cd my-app
git init
```

Write a `milky-kit.toml`. Two equally-supported shapes:

### New shape — `[[apps]]` (recommended)

Explicit, supports multiple apps from the same template, per-app variants:

```toml
[project]
name = "my-app"
worktree_dir = "my-app-worktrees"

[[apps]]
name = "api"
template = "hono"
variants = { db = "supabase", api_style = "rpc" }

[[apps]]
name = "client"
template = "react"
variants = { mobile = "capacitor", ui = "heroui" }

[[apps]]
name = "admin"
template = "react"
# admin gets defaults: mobile=none, ui=none

[skills]
include = ["ship", "rulify", "retrospective", "land"]
```

### Legacy shape — `[stack]`

Single backend + single frontend, no app naming. Still works; synthesized into the `[[apps]]` form internally:

```toml
[project]
name = "my-app"
worktree_dir = "my-app-worktrees"

[stack]
languages = ["ts"]
backend = "hono"
database = "postgres"     # → variants = { db = "neon" }
frontend = "react"
ui = "shadcn"             # → variants = { ui = "shadcn" }
tauri = true              # → variants = { mobile = "tauri" }

[skills]
include = ["ship", "rulify", "retrospective", "land"]
```

Then:

```bash
milky-kit scaffold        # generate apps/, packages/, configs
pnpm install              # for TS projects
```

## Commands

| Command | Effect |
|---|---|
| `milky-kit scaffold` | One-shot — generates `apps/`, `packages/`, configs from your `milky-kit.toml`. Skips files that already exist. |
| `milky-kit sync` | Re-sync rules, skills, mise tasks. Idempotent. Run after editing milky-kit upstream. |
| `milky-kit diff` | Dry run of `sync` — shows what would change. |
| `milky-kit init` | Interactive `milky-kit.toml` builder. (Note: the prompt UI lags the new variant system; hand-write `[[apps]]` for new projects.) |

## How variants work

A module declares variant axes in its `module.toml`:

```toml
# modules/hono/module.toml
[variants.db]
options = ["d1", "neon", "supabase"]
default = "d1"

[variants.api_style]
options = ["rpc", "openapi"]
default = "rpc"
```

Files specific to a variant live in `variants/<axis>/<choice>/`:

```
modules/hono/
├── scaffold/                                       # always copied
│   └── apps/{{app_name}}/
│       ├── src/domain/                             # shared across all variants
│       └── src/application/
└── variants/
    ├── db/
    │   ├── d1/apps/{{app_name}}/...                # only when db=d1
    │   ├── neon/apps/{{app_name}}/...
    │   └── supabase/apps/{{app_name}}/...
    └── api_style/
        ├── rpc/apps/{{app_name}}/src/presentation/routes.ts
        └── openapi/apps/{{app_name}}/...
```

When the user picks `variants = { db = "neon", api_style = "rpc" }`:
1. Base scaffold copies first
2. Each chosen variant directory layers on top
3. **JSON files merge** (variant `package.json` overlay adds deps to base) — supports tabs/indent preserved
4. Other file collisions error loudly — design rule is variants don't write paths the base also writes

## Multi-app + `{{app_name}}`

Templates use `{{app_name}}` in paths AND content. The scaffold engine renders the same template once per `[[apps]]` entry:

```
modules/react/scaffold/apps/{{app_name}}/package.json
```

becomes

```
my-app/apps/client/package.json
my-app/apps/admin/package.json
```

with `app_name = "client"` or `"admin"` substituted. The React app code is single-source — no duplication for `client + admin`.

## Available modules

| Module | What it produces | Variant axes |
|---|---|---|
| `core` | mise.toml, AGENTS.md, CLAUDE.md, .gitignore, .env.example, worktree tasks, base rules | — |
| `pnpm` | pnpm-workspace.yaml, root package.json | — |
| `monorepo` | rust workspace Cargo.toml | — |
| `ts-shared` | `packages/tsconfig/`, `packages/biome-config/` (auto-included for any TS project) | — |
| `rust` | rust-style + clean-architecture rules | — |
| `axum` | rust API server scaffold (CRUD + OpenAPI) | — |
| `postgres` | docker-compose.yml | — |
| `sqlite` | sqlite .env stub | — |
| `seaorm` | rust ORM scaffold (entities, migrator) | — |
| `sqlx` | rust sqlx scaffold (compile-time SQL) | — |
| **`hono`** | Cloudflare Workers API + Drizzle + RPC | `db = d1 \| neon \| supabase`, `api_style = rpc \| openapi` |
| **`react`** | TanStack Router/Query + Vite + biome + Tailwind | `mobile = none \| tauri \| capacitor`, `ui = none \| shadcn \| heroui` |

The `**bold**` ones are the recently rebuilt templates that ship with full integration tests. The Rust set (`axum`/`seaorm`/`sqlx`) is older and uses the legacy `[stack]` form; it works but doesn't have variants yet.

## Project layout (after scaffold)

```
my-app/
├── milky-kit.toml          # your config
├── milky-kit.lock          # auto-managed (lists every file synced)
├── mise.toml               # composite tasks (project-owned)
├── .mise/tasks/            # per-module synced tasks
├── .claude/
│   ├── rules/              # synced rules (.md, managed)
│   ├── skills/              # synced skills (managed)
│   └── settings.json       # project-owned
├── apps/
│   ├── api/                # one [[apps]] entry → one dir
│   └── client/
├── packages/               # auto: tsconfig, biome-config, ...
├── docker-compose.yml      # only if a postgres-using variant ships one
├── AGENTS.md               # synced (with @-refs to all rules)
├── CLAUDE.md               # synced
├── opencode.json           # synced (OpenCode config)
└── package.json            # synced (workspace root)
```

## Synced vs scaffolded vs project-owned

| | Where it goes | When | Idempotent? | Touched by sync? |
|---|---|---|---|---|
| **Scaffolded** | `apps/`, `packages/`, root `Cargo.toml`, etc. | One-shot via `scaffold` | No (skips existing files) | No |
| **Synced** | `.claude/rules/`, `.claude/skills/`, `.mise/tasks/`, `AGENTS.md`, etc. | Every `sync` run | Yes (managed-marker header) | Yes (overwrites) |
| **Project-owned** | Everything else (`src/` you wrote, `.claude/rules/my-rule.md` you added, etc.) | n/a | n/a | Never touched |

Synced files have a `managed by milky-kit | DO NOT EDIT` header. milky-kit only deletes/overwrites files it remembers from `milky-kit.lock`.

## Excluding from sync

```toml
[sync]
exclude = [
    "ship/SKILL.md",                # matches .claude/skills/ship/SKILL.md
    ".claude/rules/testing.md",     # exact path
    ".cargo/config.toml",
]
```

Excluded files are skipped by sync. The project owns them.

## How-to

### Edit a shared rule

```bash
vim ~/.milky-kit/modules/rust/rules/rust-style.md
cd ~/.milky-kit && git add -A && git commit -m "update rust style" && git push

# Sync to each project that uses it
cd ~/Code/Projects/my-app && milky-kit sync
```

### Add a synced mise task

```bash
cat > ~/.milky-kit/modules/rust/files/mise-tasks/test/rust << 'EOF'
#!/bin/bash
#MISE description="Run Rust tests"
set -euo pipefail
cargo nextest run
EOF
chmod +x ~/.milky-kit/modules/rust/files/mise-tasks/test/rust

# Map it
echo '
[[files]]
src = "mise-tasks/test/rust"
dest = ".mise/tasks/test/rust"' >> ~/.milky-kit/modules/rust/module.toml
```

### Add a new variant

Pick an axis on a module, drop files in `variants/<axis>/<choice>/`. The scaffold engine picks them up; sync picks up rules in `variants/<axis>/<choice>/rules/`. See `modules/hono/variants/db/supabase/` for a complete example.

### Add a new module

Create `modules/<name>/`:
- `module.toml` — declares `[[files]]` mappings and `[variants.<axis>]` blocks
- `rules/*.md` — rules to sync
- `files/<...>` — files mapped via `[[files]]`
- `scaffold/<...>` — one-shot files copied at scaffold time
- `variants/<axis>/<choice>/<...>` — variant overlays

Then reference it from `[[apps]]` (`template = "<name>"`) or include it via `[stack]` if it's an infra module.

## Testing

The scaffold engine has an end-to-end integration test:

```bash
bash scripts/test-scaffold.sh                   # all fixtures
bash scripts/test-scaffold.sh ts-fullstack      # one fixture
KEEP_SCAFFOLD=1 bash scripts/test-scaffold.sh   # leave temp dirs for debugging
```

For each fixture in `scripts/scaffold-fixtures/<name>/milky-kit.toml`:
1. `milky-kit scaffold` into a temp dir
2. `pnpm install` if `pnpm-workspace.yaml` was emitted
3. Per app: `pnpm routes:generate` + `pnpm typecheck` + `pnpm lint`
4. `cargo check` if `Cargo.toml` was emitted

Add a fixture when you add a variant or stack combination worth keeping green. CI runs the same script via `.github/workflows/scaffold-test.yml` on every push.

## Template variables

Module files (any text file, including paths) use `{{var}}` substitution:

| Variable | Source |
|---|---|
| `{{project_name}}` | `[project].name` |
| `{{worktree_dir}}` | `[project].worktree_dir` |
| `{{app_name}}` | Set per-app when rendering an app template |
| `{{project_root}}` | Absolute path to project root |
| `{{db_driver}}`, `{{db_url_example}}` | Derived from `[stack].database` (legacy) |
| Anything in `[project]` | `[project].my_var = "x"` → `{{my_var}}` |

## Lock file

`milky-kit.lock` records what was synced:

```toml
kit_version = "0.1.0"
kit_commit = "a51cf15"
last_sync = "2026-04-29T04:40:35Z"
managed = [
    ".claude/rules/workflow.md",
    ".mise/tasks/worktree/setup",
    # ...
]
```

Used to detect files that should be removed when a module is removed from the config. Glance at it to see if a project is behind.

## Open questions / known gaps

- **`milky-kit init`** is still wired to the legacy `[stack]` prompt — doesn't generate `[[apps]]` form. Hand-write configs for now.
- The Rust side (`axum`, `seaorm`, `sqlx`) hasn't been migrated to the variant system yet. Works fine via `[stack]`, but no per-app variants.
- No automatic migration tool for legacy → `[[apps]]`. The legacy form keeps working indefinitely; migrate when you need a new feature.
