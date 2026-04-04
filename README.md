# milky-kit

Manage shared Claude Code rules, skills, and configs across projects.

## Install

```bash
# Clone to home directory
git clone git@github.com:milkyskies/milky-kit.git ~/.milky-kit

# Install the CLI
cd ~/.milky-kit && cargo install --path .
```

## Usage

### New project

```bash
cd my-project
milky-kit init              # creates .claude/kit.toml
# Edit kit.toml — pick your modules and skills
milky-kit sync              # copies rules + skills into .claude/
```

### Existing project

```bash
cd my-project
# Create .claude/kit.toml (see scaffold/.claude/kit.toml for example)
milky-kit sync
```

### Updating shared rules

```bash
# Edit a rule in ~/.milky-kit/modules/...
cd ~/.milky-kit && git add -A && git commit -m "update rust style"

# Sync to each project
cd ~/Code/Projects/argus && milky-kit sync
cd ~/Code/Projects/agent-os && milky-kit sync
```

## Commands

| Command | What it does |
|---|---|
| `milky-kit sync` | Copy modules + skills into `.claude/` based on `kit.toml` |
| `milky-kit sync --dry-run` | Show what would change without writing |
| `milky-kit diff` | Same as `sync --dry-run` |
| `milky-kit init` | Create a starter `.claude/kit.toml` |

## Configuration

Each project has `.claude/kit.toml`:

```toml
[project]
name = "my-project"
worktree_dir = "my-project-worktrees"

[modules]
include = [
    "core",        # always — workflow, worktrees, testing, general practices
    "rust",        # Rust style + clean architecture
    "react",       # React frontend patterns
    "seaorm",      # SeaORM database conventions
    # "sqlx",      # sqlx database conventions (pick one ORM)
    "shadcn",      # shadcn/ui components
    # "heroui",    # HeroUI v3 components (pick one UI library)
    "monorepo",    # monorepo workspace conventions
    "pnpm",        # pnpm package manager
    "tauri",       # Tauri desktop/mobile app
]

[skills]
include = [
    "ship",                    # quality gates + PR pipeline
    "rulify",                  # rule compliance check
    "alignify",                # pattern consistency check
    "retrospective",           # session review
    "update-rule",             # create/update rules
    "land",                    # post-merge cleanup
    "setup-api-client",        # React + TanStack Query scaffolding
    "tanstack-query-patterns", # TanStack Query reference
    # "heroui-react",          # HeroUI docs + scripts
    # "add-endpoint",          # end-to-end endpoint skill
    # "database-seaorm",       # SeaORM database operations
    # "database-sqlx",         # sqlx database operations
]
```

## Modules

| Module | What it covers |
|---|---|
| `core` | Workflow, worktrees, testing, config, general practices |
| `rust` | Rust style, clean architecture |
| `react` | Frontend structure, component patterns |
| `seaorm` | SeaORM database conventions |
| `sqlx` | sqlx database conventions |
| `shadcn` | shadcn/ui components |
| `heroui` | HeroUI v3 components |
| `monorepo` | Workspace conventions |
| `pnpm` | pnpm package manager |
| `tauri` | Tauri desktop/mobile app |

## Template variables

Rules can use `{{project_name}}` and `{{worktree_dir}}` which get replaced during sync.

## Project-specific rules

Files in `.claude/rules/` that weren't created by milky-kit are never touched. Add project-specific rules (like `reference-*.md`) directly in the project.

## How it works

1. Reads `.claude/kit.toml` for module and skill selections
2. Copies `modules/<name>/rules/*.md` into `.claude/rules/`
3. Copies `modules/<name>/files/*` to destinations specified in `module.toml`
4. Copies selected skills into `.claude/skills/`
5. Replaces `{{variables}}` in all copied files
6. Tracks managed files in `.claude/.managed` — only overwrites its own files
7. Cleans up files that were previously managed but removed from config
