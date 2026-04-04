# Git Worktree Workflow

Each agent works in its own isolated worktree. This is the standard way to handle parallel work — it structurally prevents agents from touching each other's files.

## Location

Worktrees live at `../{{worktree_dir}}/<issue-num>/` relative to the repo root.

```
~/Code/Projects/
├── {{project_name}}/                # main repo (stay on main here)
└── {{worktree_dir}}/
    ├── 74/                  # agent working on issue #74
    ├── 77/                  # agent working on issue #77
    └── ...
```

## Starting a Task

```bash
# From the main repo, ensure main is up to date
git checkout main && git pull

# Create worktree with a new branch
git worktree add ../{{worktree_dir}}/<num> -b feature/#<num>.<summary> main

# All work happens inside the worktree
cd ../{{worktree_dir}}/<num>
```

If the project has a `mise run worktree:setup` task, prefer that — it handles branch creation, environment setup, and dependency installation in one step:
```bash
mise run worktree:setup <num> feature/#<num>.<summary>
cd ../{{worktree_dir}}/<num>
```

Use the right branch prefix for the type of work:
```
feature/#<num>.<summary>   # new functionality (standalone or epic)
fix/#<num>.<summary>       # bug fixes
chore/#<num>.<summary>     # maintenance, deps, tooling
```

### Epic and sub-issue worktrees

Epics use `feature/` prefix — same as standalone issues. Sub-tasks nest under the epic number to show the relationship.

```bash
# Epic: create worktree from main
git worktree add ../{{worktree_dir}}/<epic-num> -b feature/#<epic-num>.<summary> main
cd ../{{worktree_dir}}/<epic-num>

# Sub-issue: branch off the epic branch
git worktree add ../{{worktree_dir}}/<sub-num> -b feature/#<epic-num>/#<sub-num>.<summary> feature/#<epic-num>.<summary>
cd ../{{worktree_dir}}/<sub-num>
```

Check `glb show <num>` — if the issue has a parent, it's a sub-issue and should branch off the epic branch. If no parent, branch off main.

## Verify Before Doing Anything

**Before editing any file or running any command**, confirm you are in the correct worktree:

```bash
pwd   # must be .../{{worktree_dir}}/<num>
git branch --show-current   # must be your issue branch
```

If either is wrong, stop and navigate to the correct worktree first. Never edit files or run task commands from the main repo directory or another agent's worktree.

## Working

Do everything — edit, build, test, commit, push — from inside the worktree directory. Do not return to the main repo directory to do task work.

### Things you must NEVER do in a worktree

- **Never run `docker compose` from a worktree directory.** The worktree may have its own `docker-compose.yml` copy which will create a separate container and port-conflict with the shared database.
- **Never run destructive SQL** (`DROP SCHEMA`, `DROP TABLE`, etc.) against the shared database. Other agents depend on it.
- **Never run `git add -A` or `git add .`** — this can stage unintended changes. Always add specific files by name.

## Cleanup

Remove the worktree when done:
```bash
git worktree remove ../{{worktree_dir}}/<num>
```

If the project has `mise run worktree:cleanup`, prefer that — it may also clean up databases and other resources.

## Rules

- **Always create a worktree before starting work** — never work directly in the main repo's working tree.
- **Never enter another agent's worktree directory.** If `../{{worktree_dir}}/<num>` already exists, another agent owns that issue — pick something else.
- **One worktree per issue.** Name it `<num>` to match the issue number.
- **Do not stash, reset, or clean** in someone else's worktree. If you see unexpected state, leave it alone.
