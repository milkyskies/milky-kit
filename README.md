# milky-kit

Manage shared Claude Code rules, skills, and configs across projects.

## Install

```bash
# Clone to home directory
git clone git@github.com:milkyskies/milky-kit.git ~/.milky-kit

# Install the CLI
cd ~/.milky-kit && cargo install --path .
```

## Commands

| Command | What it does |
|---|---|
| `milky-kit sync` | Copy modules + skills into `.claude/` based on `milky-kit.toml` |
| `milky-kit sync --dry-run` | Show what would change without writing |
| `milky-kit diff` | Same as `sync --dry-run` |
| `milky-kit init` | Create a starter `.claude/milky-kit.toml` |

## Setup

### New project

```bash
cd my-project
milky-kit init              # creates .claude/milky-kit.toml
# Edit milky-kit.toml — uncomment the modules and skills you want
milky-kit sync              # copies rules + skills into .claude/
```

### Existing project

```bash
cd my-project
# Create .claude/milky-kit.toml (see scaffold/.claude/milky-kit.toml for example)
milky-kit sync
```

## Configuration

Each project has `.claude/milky-kit.toml`:

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

## How-to

### Edit a shared rule

```bash
vim ~/.milky-kit/modules/rust/rules/rust-style.md
cd ~/.milky-kit && git add -A && git commit -m "update rust style" && git push

# Sync to each project
cd ~/Code/Projects/argus && milky-kit sync
cd ~/Code/Projects/floe && milky-kit sync
```

### Add a new rule to an existing module

Create the file in the module's `rules/` directory. It gets picked up automatically on next sync for any project that includes that module.

```bash
vim ~/.milky-kit/modules/rust/rules/error-handling.md
cd ~/Code/Projects/argus && milky-kit sync
# .claude/rules/error-handling.md appears
```

### Add a new module

```bash
mkdir -p ~/.milky-kit/modules/svelte/rules
vim ~/.milky-kit/modules/svelte/rules/svelte-patterns.md
```

Then add it to your project's `milky-kit.toml`:

```toml
[modules]
include = ["core", "svelte"]
```

Run `milky-kit sync`.

### Add a new skill

```bash
mkdir -p ~/.milky-kit/skills/my-skill
vim ~/.milky-kit/skills/my-skill/SKILL.md
```

Then add it to your project's `milky-kit.toml`:

```toml
[skills]
include = ["ship", "rulify", "my-skill"]
```

Run `milky-kit sync`.

### Add a config file (biome.json, tsconfig, etc.)

Put the file in the module's `files/` directory and create a `module.toml` to map it to its destination:

```bash
mkdir -p ~/.milky-kit/modules/react/files
cp biome.json ~/.milky-kit/modules/react/files/biome.json

cat > ~/.milky-kit/modules/react/module.toml << 'EOF'
[[files]]
src = "biome.json"
dest = "biome.json"
EOF
```

Run `milky-kit sync` — copies `biome.json` to the project root.

### Remove a module or skill

Remove it from `milky-kit.toml` and run `milky-kit sync`. Any managed files from that module get deleted automatically.

### Add a project-specific rule (not shared)

Just create the file directly in `.claude/rules/`. milky-kit only touches files it created (they have `<!-- managed by milky-kit -->` at the top). Your files are never overwritten.

## Template variables

Rules can use `{{project_name}}` and `{{worktree_dir}}` — they get replaced during sync with values from `milky-kit.toml`. Custom variables work too: add any key under `[project]` and use `{{key_name}}` in module files.

## How it works

1. Reads `.claude/milky-kit.toml` for module and skill selections
2. Copies `modules/<name>/rules/*.md` into `.claude/rules/`
3. Copies `modules/<name>/files/*` to destinations specified in `module.toml`
4. Copies selected skills into `.claude/skills/`
5. Replaces `{{variables}}` in all copied files
6. Tracks managed files in `.claude/.managed` — only overwrites its own files
7. Cleans up files that were previously managed but removed from config
