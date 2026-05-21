# Git Worktree Workflow

**This rule applies only when `.milky-kit-mode` is `worktrees`.** Read `.milky-kit-mode` at session start — if it says `main` or `branch`, ignore this rule entirely and follow the matching section of `workflow.md`.

When in `worktrees` mode, each task runs in its own isolated worktree. This is how parallel multi-agent work stays safe — it structurally prevents agents from touching each other's files.

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

Create the worktree with `git worktree add` (or the mise task), then **enter it with the `EnterWorktree` tool, not `cd`.** `EnterWorktree(path: ...)` switches the session's working directory into the worktree the same way `cd` would, but the harness tracks it — so the cwd, memory, and plan state all stay coherent. Manual `cd` into a worktree leaves the harness pointing at the main repo while your shell points somewhere else, which leads to tool calls running in the wrong place.

```bash
# From the main repo, ensure main is up to date
git checkout main && git pull

# Create worktree with a new branch
git worktree add ../{{worktree_dir}}/<num> -b feature/#<num>.<summary> main
```

Then enter it via the tool:

```
EnterWorktree(path: "../{{worktree_dir}}/<num>")
```

If the project has a `mise run worktree:setup` task, prefer that — it handles branch creation, environment setup, and dependency installation in one step. Still enter via the tool afterwards, not `cd`:

```bash
mise run worktree:setup <num> feature/#<num>.<summary>
```
```
EnterWorktree(path: "../{{worktree_dir}}/<num>")
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
```
```
EnterWorktree(path: "../{{worktree_dir}}/<epic-num>")
```

```bash
# Sub-issue: branch off the epic branch
git worktree add ../{{worktree_dir}}/<sub-num> -b feature/#<epic-num>/#<sub-num>.<summary> feature/#<epic-num>.<summary>
```
```
EnterWorktree(path: "../{{worktree_dir}}/<sub-num>")
```

Check `glb show <num>` — if the issue has a parent, it's a sub-issue and should branch off the epic branch. If no parent, branch off main.

## Verify Before Doing Anything

**Before editing any file or running any command**, confirm you are in the correct worktree:

```bash
pwd   # must be .../{{worktree_dir}}/<num>
git branch --show-current   # must be your issue branch
```

If either is wrong, stop and re-enter the correct worktree with `EnterWorktree(path: ...)`. Do not use `cd` to fix it. Never edit files or run task commands from the main repo directory or another agent's worktree.

## Working

Do everything — edit, build, test, commit, push — from inside the worktree. Do not `cd` or `EnterWorktree` back to the main repo directory mid-task.

### Things you must NEVER do in a worktree

- **Never run `docker compose` from a worktree directory.** The worktree may have its own `docker-compose.yml` copy which will create a separate container and port-conflict with the shared database.
- **Never run destructive SQL** (`DROP SCHEMA`, `DROP TABLE`, etc.) against the shared database. Other agents depend on it.
- **Never run `git add -A` or `git add .`** — this can stage unintended changes. Always add specific files by name.

## Cleanup

Two steps: leave the worktree session, then remove it from disk.

```
ExitWorktree(action: "keep")
```

`action: "keep"` is the correct choice here. `EnterWorktree(path: ...)` enters an existing worktree, and `ExitWorktree` will not remove worktrees it did not create — `keep` just returns the session to the main repo. Then remove the worktree explicitly:

```bash
git worktree remove ../{{worktree_dir}}/<num>
```

If the project has `mise run worktree:cleanup`, prefer that — it may also clean up databases and other resources.

## Rules

- **Always create a worktree before starting work** — never work directly in the main repo's working tree (in `worktrees` mode).
- **Always enter via `EnterWorktree(path: ...)`, never `cd`.** Manual `cd` desynchronizes the harness from the shell.
- **Never enter another agent's worktree directory.** If `../{{worktree_dir}}/<num>` already exists, another agent owns that issue — pick something else.
- **One worktree per issue.** Name it `<num>` to match the issue number.
- **Do not stash, reset, or clean** in someone else's worktree. If you see unexpected state, leave it alone.
