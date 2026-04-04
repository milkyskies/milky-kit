# milky-kit

Manage shared Claude Code rules, skills, and configs across projects. Scaffold new projects with a working CRUD example from your preferred stack.

## Install

```bash
git clone git@github.com:milkyskies/milky-kit.git ~/.milky-kit
cd ~/.milky-kit && cargo install --path .
```

## Quick start — new project

```bash
mkdir my-app && cd my-app

milky-kit init          # interactive — picks your stack
milky-kit scaffold      # creates full project with working CRUD example

# One-time setup
gh repo create my-app --source . --push
glb init                # task tracking via GitHub Issues + Projects
mise run db:setup       # start Postgres + run migrations
mise run dev            # full stack running
```

## Quick start — existing project

```bash
cd my-project
milky-kit init          # configure your stack
milky-kit sync          # sync rules + skills into .claude/
```

## Commands

| Command | What it does |
|---|---|
| `milky-kit init` | Interactive setup — asks about your stack, creates `.claude/milky-kit.toml` |
| `milky-kit scaffold` | Generate full project structure from module templates (working CRUD, mise tasks, configs) |
| `milky-kit sync` | Sync rules + skills into `.claude/` from your config |
| `milky-kit diff` | Dry run — show what sync would change |

## Configuration

`milky-kit init` creates `.claude/milky-kit.toml` interactively. Example output:

```toml
# Full-stack project
[project]
name = "my-app"
worktree_dir = "my-app-worktrees"

[stack]
languages = ["rust"]
backend = "axum"
orm = "seaorm"
frontend = "react"
ui = "shadcn"
tools = ["pnpm", "monorepo"]

[skills]
include = [
    "ship",
    "rulify",
    "alignify",
    "retrospective",
    "update-rule",
    "land",
    "setup-api-client",
    "tanstack-query-patterns",
    "add-endpoint",
    "database-seaorm",
]
```

```toml
# Rust-only project (no API, no frontend)
[project]
name = "my-tool"
worktree_dir = "my-tool-worktrees"

[stack]
languages = ["rust"]

[skills]
include = ["ship", "rulify", "alignify", "retrospective", "land"]
```

All `[stack]` fields are optional except `languages`.

## What scaffold creates

For a full-stack project (rust + axum + seaorm + react + shadcn + pnpm + monorepo):

- **66 files** with a working posts CRUD example across every layer
- **mise.toml** with 16 tasks: dev servers, quality gates, formatting, database, worktree management
- **Cargo workspace** with domain/application/infrastructure packages + API server + migration runner
- **React app** with TanStack Router, TanStack Query, Orval codegen, Biome, Vite
- **Claude rules + skills** synced from your selected modules
- **`.claude/rules/project-setup.md`** giving Claude instant context about your stack

## Modules

| Module | Rules | Scaffold |
|---|---|---|
| `core` | Workflow, worktrees, testing, config, general practices | mise.toml, docker-compose, .gitignore, CLAUDE.md, .env |
| `rust` | Rust style, naming, error handling | domain/application/infrastructure packages, Post model |
| `axum` | Handler patterns, route registration, middleware | API server with CRUD handlers, OpenAPI, DTOs |
| `seaorm` | SeaORM database conventions | Migration runner, posts migration, entities, repositories |
| `sqlx` | sqlx database conventions | Migration files, .sqlx offline metadata |
| `react` | Frontend structure, component patterns | Vite + TanStack Router + Query + Orval, posts page |
| `shadcn` | shadcn/ui components | Tailwind CSS setup |
| `heroui` | HeroUI v3 components | Tailwind + HeroUI styles, theme variables |
| `pnpm` | pnpm workspace conventions | Root package.json, pnpm-workspace.yaml |
| `monorepo` | Workspace conventions | Cargo.toml workspace |
| `tauri` | Mobile-first, Tauri app conventions | *(rules only)* |

## How-to

### Edit a shared rule

```bash
vim ~/.milky-kit/modules/rust/rules/rust-style.md
cd ~/.milky-kit && git add -A && git commit -m "update rust style" && git push

# Sync to each project
cd ~/Code/Projects/my-app && milky-kit sync
```

### Add a new rule to an existing module

Create the file in the module's `rules/` directory. Picked up automatically on next sync.

```bash
vim ~/.milky-kit/modules/rust/rules/error-handling.md
cd ~/Code/Projects/my-app && milky-kit sync
```

### Add a new module

```bash
mkdir -p ~/.milky-kit/modules/svelte/rules
vim ~/.milky-kit/modules/svelte/rules/svelte-patterns.md
```

Add it to your project's `[stack]` and run `milky-kit sync`.

### Add a config file (biome.json, tsconfig, etc.)

Put the file in the module's `files/` directory with a `module.toml` mapping:

```bash
mkdir -p ~/.milky-kit/modules/react/files
cp biome.json ~/.milky-kit/modules/react/files/biome.json

cat > ~/.milky-kit/modules/react/module.toml << 'EOF'
[[files]]
src = "biome.json"
dest = "biome.json"
EOF
```

### Add a project-specific rule

Create files directly in `.claude/rules/`. milky-kit only touches files it created (marked with `<!-- managed by milky-kit -->`).

### Remove a module

Remove it from `milky-kit.toml` and run `milky-kit sync`. Managed files from that module get deleted automatically.

## Template variables

Module files can use `{{project_name}}` and `{{worktree_dir}}` which get replaced during sync and scaffold. Custom variables work too — add any key under `[project]`.

## How it works

**Sync** (runs every time):
1. Reads `.claude/milky-kit.toml`
2. Copies `modules/<name>/rules/*.md` into `.claude/rules/` with managed header
3. Copies selected skills into `.claude/skills/`
4. Replaces `{{variables}}`, tracks managed files in `.claude/.managed`
5. Cleans up files removed from config

**Scaffold** (runs once for new projects):
1. For each module, copies `modules/<name>/scaffold/**` into the project root
2. Replaces `{{variables}}` in all files
3. Never overwrites existing files
4. Generates `.claude/rules/project-setup.md` with stack context for Claude
5. Runs sync automatically at the end
