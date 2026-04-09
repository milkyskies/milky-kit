# milky-kit

Manage shared Claude Code rules, skills, and configs across projects. Scaffold new projects with a working CRUD example from your preferred stack.

## Install

```bash
git clone git@github.com:milkyskies/milky-kit.git ~/.milky-kit
cd ~/.milky-kit && cargo install --path .
```

## Quick start - new project

```bash
mkdir my-app && cd my-app

milky-kit init          # interactive - picks your stack
milky-kit scaffold      # creates full project with working CRUD example

# One-time setup
gh repo create my-app --source . --push
glb init                # task tracking via GitHub Issues + Projects
mise run db:setup       # start Postgres + run migrations
mise run dev            # full stack running
```

## Quick start - existing project

```bash
cd my-project
milky-kit init          # configure your stack
milky-kit sync          # sync rules, skills, and mise tasks
```

## Commands

| Command | What it does |
|---|---|
| `milky-kit init` | Interactive setup - asks about your stack, creates `milky-kit.toml` |
| `milky-kit scaffold` | Generate full project structure from module templates |
| `milky-kit sync` | Sync rules, skills, and mise tasks from your config |
| `milky-kit diff` | Dry run - show what sync would change |

## Configuration

`milky-kit init` creates `milky-kit.toml` at the project root interactively:

```
Project name: my-app

Backend language:
> rust    - Cargo workspace, clean architecture
  none    - no backend

Backend framework:
> axum    - HTTP server, tower middleware, utoipa OpenAPI
  none    - library/CLI only, no HTTP server

Database:
> postgres + seaorm  - PostgreSQL, entity ORM, Docker container
  postgres + sqlx    - PostgreSQL, compile-time SQL, Docker container
  sqlite + seaorm    - SQLite, file-based, no Docker (Cloudflare D1 compatible)
  sqlite + sqlx      - SQLite, compile-time SQL, no Docker (D1 compatible)
  none               - no database

Frontend framework:
> react   - TanStack Router + TanStack Query + Orval + Vite + Biome
  none    - no frontend

UI library:
> shadcn  - shadcn/ui + Tailwind CSS
  heroui  - HeroUI v3 + Tailwind CSS v4 + React Aria
  none    - just Tailwind, no component library
```

Example output:

```toml
# Full-stack project
[project]
name = "my-app"
worktree_dir = "my-app-worktrees"

[stack]
languages = ["rust"]
backend = "axum"
database = "postgres"
orm = "seaorm"
frontend = "react"
ui = "shadcn"

[skills]
include = [
    "ship",
    "rulify",
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
include = ["ship", "rulify", "retrospective", "land"]
```

`pnpm` and `monorepo` (Cargo workspace) are auto-inferred from your stack - no need to specify them.

## Project layout

```
my-project/
├── milky-kit.toml          # milky-kit config (your stack choices)
├── milky-kit.lock          # milky-kit state (version, commit, managed files)
├── mise.toml               # project-owned composite tasks
├── .mise/tasks/            # synced task scripts (managed by milky-kit)
├── .claude/
│   ├── settings.json       # Claude Code settings
│   ├── rules/              # synced rules (managed) + project-specific rules
│   └── skills/             # synced skills (managed)
├── Cargo.toml              # workspace (scaffolded)
├── docker-compose.yml      # PostgreSQL (scaffolded, postgres only)
└── apps/, packages/        # your code (scaffolded)
```

## What gets synced vs scaffolded

| Type | When | Overwrites? | Examples |
|---|---|---|---|
| **Synced** | Every `milky-kit sync` | Yes (managed files only) | `.claude/rules/*.md`, `.claude/skills/*/`, `.mise/tasks/**` |
| **Scaffolded** | Once (`milky-kit scaffold`) | Never | `Cargo.toml`, `mise.toml`, `apps/`, `packages/`, source code |
| **Project-specific** | You create manually | Never touched by milky-kit | `.claude/rules/my-custom-rule.md`, project-specific scripts |

Synced files have a `<!-- managed by milky-kit -->` header so you know they're managed.

## Modules

| Module | Rules | Synced tasks | Scaffold |
|---|---|---|---|
| `core` | Workflow, worktrees, testing, config, general | `dev:api`, `dev:client`, `worktree:setup`, `worktree:cleanup` | mise.toml, .gitignore, CLAUDE.md, .env |
| `rust` | Rust style, naming, error handling | `check:rust`, `fmt:rust` | domain/application/infrastructure packages |
| `axum` | Handler patterns, route registration | - | API server with CRUD handlers, OpenAPI |
| `postgres` | - | `db:up`, `db:reset` | docker-compose.yml |
| `sqlite` | - | - | SQLite .env (no Docker) |
| `seaorm` | SeaORM database conventions | `db:migrate`, `db:status` | Migration runner, entities, repositories |
| `sqlx` | sqlx database conventions | - | Migration files, .sqlx metadata |
| `react` | Frontend structure, component patterns | `check:frontend`, `fmt:frontend`, `api:generate` | Vite + TanStack Router + Query + Orval, posts page |
| `shadcn` | shadcn/ui components | - | Tailwind CSS setup |
| `heroui` | HeroUI v3 components | - | Tailwind + HeroUI styles, theme variables |
| `tauri` | Mobile-first, Tauri app | - | *(rules only)* |

`pnpm` (workspace config) and `monorepo` (Cargo workspace) are auto-included based on your stack.

## Excluding files from sync

If a project needs a custom version of a synced file:

```toml
[sync]
exclude = [
    "check/rust",          # matches .mise/tasks/check/rust
    "testing.md",          # matches .claude/rules/testing.md
]
```

Excluded files won't be synced - you manage them yourself.

## How-to

### Edit a shared rule

```bash
vim ~/.milky-kit/modules/rust/rules/rust-style.md
cd ~/.milky-kit && git add -A && git commit -m "update rust style" && git push

# Sync to each project
cd ~/Code/Projects/my-app && milky-kit sync
```

### Add a synced mise task

Put it in a module's `files/` directory and map it in `module.toml`:

```bash
# Create the task script
cat > ~/.milky-kit/modules/rust/files/mise-tasks/test/rust << 'EOF'
#!/bin/bash
# mise description="Run Rust tests"
set -euo pipefail
cargo nextest run
EOF
chmod +x ~/.milky-kit/modules/rust/files/mise-tasks/test/rust

# Map it in module.toml
cat >> ~/.milky-kit/modules/rust/module.toml << 'EOF'
[[files]]
src = "mise-tasks/test/rust"
dest = ".mise/tasks/test/rust"
EOF
```

Next `milky-kit sync` pushes it to all projects using the `rust` module.

### Add a config file (biome.json, tsconfig, etc.)

Same mechanism - put in `files/`, map in `module.toml`:

```bash
mkdir -p ~/.milky-kit/modules/react/files
cp biome.json ~/.milky-kit/modules/react/files/biome.json

cat >> ~/.milky-kit/modules/react/module.toml << 'EOF'
[[files]]
src = "biome.json"
dest = "biome.json"
EOF
```

### Add a project-specific rule

Create files directly in `.claude/rules/`. milky-kit only touches files it created.

### Remove a module

Remove it from `milky-kit.toml` and run `milky-kit sync`. Managed files from that module get deleted automatically.

## Template variables

Module files can use `{{project_name}}` and `{{worktree_dir}}` - replaced during sync and scaffold. Custom variables work too: add any key under `[project]`.

Stack-derived variables are set automatically:
- `{{db_driver}}` - `sqlx-postgres` or `sqlx-sqlite` (from database choice)
- `{{db_url_example}}` - connection string for .env

## Version tracking

`milky-kit.lock` records what was synced:

```toml
kit_version = "0.1.0"
kit_commit = "a6973b3"
last_sync = "2026-04-04T04:40:35Z"
managed = [
    ".claude/rules/worktrees.md",
    ".mise/tasks/check/rust",
    # ...
]
```

Glance at any project's lock file to see if it's behind.
