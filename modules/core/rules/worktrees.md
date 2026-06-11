# Git Worktree Workflow

**This rule applies only when `.milky-kit-mode` is `worktrees`.** Read `.milky-kit-mode` at session start — if it says `main` or `branch`, ignore this rule entirely and follow the matching section of `workflow.md`.

In `worktrees` mode a **lead** agent develops on a feature branch in the root checkout, and **delegated** tasks each run in their own isolated worktree. This rule covers the delegated worktree side; the lead follows the `branch` mode workflow in `workflow.md`.

**Iron rule:** a worktree task must NEVER switch, pull, reset, or rebase the branch checked out in the **root**. The root holds the lead's in-progress branch. Base worktrees on fresh main with `git fetch origin` + `origin/main` — never `git checkout main` in the root. Worktree isolation is what keeps parallel agents (and the lead) from touching each other's files.

## Location

Worktrees live at `../{{worktree_dir}}/<issue-num>/` relative to the repo root.

```
~/Code/Projects/
├── {{project_name}}/                # lead checkout — on a feature branch or main; never switched by a worktree task
└── {{worktree_dir}}/
    ├── 74/                  # agent working on issue #74
    ├── 77/                  # agent working on issue #77
    └── ...
```

## Starting a Task

Create the worktree with `git worktree add` (or the mise task), then **enter it with the `EnterWorktree` tool, not `cd`.** `EnterWorktree(path: ...)` switches the session's working directory into the worktree the same way `cd` would, but the harness tracks it — so the cwd, memory, and plan state all stay coherent. Manual `cd` into a worktree leaves the harness pointing at the main repo while your shell points somewhere else, which leads to tool calls running in the wrong place.

```bash
# Update remote refs WITHOUT touching the root's checked-out branch
git fetch origin

# Create the worktree, branching off fresh main
git worktree add ../{{worktree_dir}}/<num> -b feature/#<num>.<summary> origin/main
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
# Epic: create worktree from fresh main (fetch first, never checkout main in root)
git fetch origin
git worktree add ../{{worktree_dir}}/<epic-num> -b feature/#<epic-num>.<summary> origin/main
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

Check `glb show <num>` — if the issue has a parent, it's a sub-issue and should branch off the epic branch. If no parent, branch off `origin/main`.

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

- **Never run a git command that changes the root's checked-out branch.** No `git checkout main`, no `git pull` in the root, no `git checkout <other-branch>` in the root. The lead is mid-task on the root branch, and switching it from a worktree flow destroys their state. Use `git fetch origin` if you need fresh refs.
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

- **Never touch the root's branch from a worktree.** No `git checkout`/`pull`/`reset`/`rebase` against the root checkout. Base worktrees on `origin/main` after `git fetch origin`.
- **The lead works in the root checkout; delegated tasks get worktrees.** If you were told to do a task in a worktree (or you're a spawned parallel agent), create the worktree first — never do delegated work in the root tree. The lead's own development happens in root on a feature branch, per the `branch` workflow.
- **Always enter via `EnterWorktree(path: ...)`, never `cd`.** Manual `cd` desynchronizes the harness from the shell.
- **Never enter another agent's worktree directory.** If `../{{worktree_dir}}/<num>` already exists, another agent owns that issue — pick something else.
- **One worktree per issue.** Name it `<num>` to match the issue number.
- **Do not stash, reset, or clean** in someone else's worktree. If you see unexpected state, leave it alone.
