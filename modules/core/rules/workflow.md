# Agent Task Workflow

**MANDATORY for every task. Do NOT skip any step.**

## Read the workflow mode FIRST

At session start, before doing anything else, read the `.milky-kit-mode` file at project root:

```bash
cat .milky-kit-mode  # → main  OR  branch  OR  worktrees
```

| Mode | Branch | Worktree | Ship via |
|---|---|---|---|
| `main` | no — commit on `main` | no | push to `main` directly |
| `branch` | yes — feature branch in root checkout | no | PR to `main` |
| `worktrees` | yes — feature branch | yes — `../<worktree-dir>/<num>/` | PR to `main` |

- **`main`** — direct on main. No branches, no worktrees, no PRs. Best for solo solo work, the kit itself, small personal projects where you trust yourself.
- **`branch`** — feature branch in the root checkout. Ship via PR. No worktree directory. Best for typical solo work where you still want PR review.
- **`worktrees`** — full isolation: one worktree per task, branch, PR. Best for parallel multi-agent work or anywhere worktree isolation matters.

If `.milky-kit-mode` is missing, default to `branch` and tell the user — they should set it explicitly with `/milky-kit:mode <value>`.

To switch modes between tasks, run `/milky-kit:mode main | branch | worktrees`. The flip applies to the next task — finish whatever you're doing in the current mode first.

## glb (ghlobes) — Issue Tracking (all modes)

Use `glb` for ALL task tracking via GitHub Issues + Projects. Do NOT use TodoWrite, TaskCreate, or markdown TODOs.

### Finding Work

```bash
glb ready                    # Show unblocked issues
glb list                     # All open issues
glb show <num>               # Detailed view with dependencies
glb path                     # Critical path + high-leverage issues (--by-count, --top N)
glb next                     # Recommend next batch for parallel agents (--agents N, default 3)
```

### Creating Issues

```bash
glb create --title="Summary" --body="Why and what" --priority P2 --status Todo --points 3
```

**Issue body must include a `## Tests` section** listing the tests that need to be written to verify the work. Exception: bug-report issues that already reference a failing test, chores with no behavior change (deps, CI, docs).

**No em dashes in titles.** Issue titles and PR titles must not contain em dashes. Use a regular hyphen (-) or rewrite the sentence instead.

Priorities: P0 (critical), P1 (high), P2 (medium/default), P3 (low), P4 (backlog)

### Points

Use **Fibonacci numbers** for the `--points` field: `1, 2, 3, 5, 8, 13`.
- `1` — trivial (< 1 hour)
- `2` — small (a few hours)
- `3` — medium (half a day)
- `5` — large (full day)
- `8` — very large (2-3 days)
- `13` — epic (break it down into sub-issues instead if possible)

### Epics (sub-issues)

```bash
glb sub add <parent> <child>    # Add a sub-issue to a parent (epic)
glb sub remove <parent> <child> # Remove a sub-issue from a parent
glb sub list <parent>           # List sub-issues with progress
```

**Default: sub-issues branch off `main` and PR into `main`, just like any other issue.** The parent/child relationship is organizational only. The epic-branch workflow (sub-PRs into an epic branch) applies only in `branch` or `worktrees` mode, and only when the user explicitly asks for it.

### Rules

- Check `glb ready` before asking "what should I work on?"
- Use `glb search "query"` to find existing issues
- Do NOT create markdown TODO lists or use external trackers

## Session Start — MANDATORY (all modes)

Sync before doing anything:

```bash
git checkout main && git pull
```

## Read the Docs (all modes)

Before touching code in a feature or area you don't already know, check whether the project ships a doc for it.

1. If `docs/README.md` exists, open it; it indexes the project's product and architecture docs.
2. Find the relevant doc (feature, plugin, architecture topic) and read it before starting.

Most projects in this kit do not maintain a `docs/` directory; that is fine. The rule is "read the doc if there is one," not "every project must have docs."

---

## Task Workflow — `main` mode

When `.milky-kit-mode` is `main`, follow this section. Skip the others.

### 1. Claim the issue

```bash
glb update <num> --claim
```

### 2. Verify branch is `main`

```bash
git branch --show-current   # must be `main`
```

If not on `main`, switch (`git checkout main`).

### 3. Work

Edit, build, test directly in the project root, on `main`. **Before writing new code, find a similar existing implementation in each layer you're about to touch and follow its patterns.**

Commit semi-frequently with `(#N)` issue refs in the message:

```bash
git add <specific files>
git commit -m "<type>(<scope>): <subject> (#<num>)"
```

Never `git add -A` or `git add .` — stage specific files.

### 4. Push directly

No PRs in `main` mode. Push to `main` after each meaningful commit (or batched, your call):

```bash
git push origin main
```

Run formatter + linter before every push. No exceptions.

### 5. Close the issue

```bash
glb done <num> --comment "<short summary>"
```

For commits that fix the issue completely, include `closes #<num>` in the commit body so GitHub also closes via the commit.

---

## Task Workflow — `branch` mode

When `.milky-kit-mode` is `branch`, follow this section. Skip the others.

### 1. Sync + create branch (in root checkout)

```bash
git checkout main && git pull
git checkout -b feature/#<num>.<summary>
```

Use the right branch prefix:
- `feature/#<num>.<summary>` — new functionality
- `fix/#<num>.<summary>` — bug fix
- `chore/#<num>.<summary>` — maintenance

No worktree directory. The branch lives in the same root checkout.

### 2. Verify branch

```bash
git branch --show-current   # must be your issue branch, NOT main
```

If you're still on main, stop and switch.

### 3. Claim & work

```bash
glb update <num> --claim
```

**Before writing new code, find a similar existing implementation in each layer you're about to touch and follow its patterns.**

Commit semi-frequently — don't save everything for one giant commit. Stage specific files, never `git add -A`.

### 4. Ship via PR

**When implementation is done, run `/ship`.** It handles quality gates, code review, draft PR, CI loop, and mark-ready.

After the user merges, say "merged" to trigger `/land`. `/land` switches back to `main`, pulls, and deletes the local branch.

PR title format: `[#<num>] <issue title>`. Body starts with `closes #<num>`.

---

## Task Workflow — `worktrees` mode

When `.milky-kit-mode` is `worktrees`, follow this section. Skip the others.

### Multi-Agent Environment (worktrees mode only)

Multiple agents run in parallel on separate branches. This means:

- **Only touch files relevant to your task.** Do not modify, stash, reset, or discard files you didn't create or change yourself.
- **Never run `git stash`, `git reset --hard`, `git checkout -- <file>`, or `git clean`** unless you are certain those changes belong to you. When in doubt, leave it alone.
- If you see unexpected files or changes, investigate before acting — they likely belong to another agent working in parallel.

### 1. Create a Worktree

Each task gets its own isolated worktree. See `worktrees.md` for the full workflow.

```bash
mise run worktree:setup <num> feature/#<num>.<summary>
```

Then enter the worktree via the `EnterWorktree` tool — do **not** `cd`. Manual `cd` desynchronizes the harness from the shell.

```
EnterWorktree(path: "../{{worktree_dir}}/<num>")
```

Do all work — editing, building, testing, committing — from inside this directory.

### 2. Verify Worktree

Before touching any file or running any command, confirm you are in the right place:

```bash
pwd                       # must be .../{{worktree_dir}}/<num>
git branch --show-current # must be your issue branch
```

If either is wrong, stop and re-enter the correct worktree with `EnterWorktree(path: ...)` — do not use `cd`.

### 3. Claim & Work

```bash
glb update <num> --claim
```

**Before writing new code, find a similar existing implementation in each layer you're about to touch and follow its patterns.**

Commit semi-frequently.

### 4. Ship via PR

**When implementation is done, run `/ship`.** Same as `branch` mode — quality gates, draft PR, CI loop, mark ready.

PR title format: `[#<num>] <issue title>`. Body starts with `closes #<num>`.

After the user merges, say "merged" to trigger `/land`. `/land` cleans up the worktree.

### Epic-branch workflow (worktrees mode, on request)

When the user explicitly asks for an epic branch:

```
main
 └── feature/#409.llm-infrastructure              <- epic branch
      ├── feature/#409/#505.model-registry        <- PRs into epic branch
      ├── feature/#409/#498.complexity-routing    <- PRs into epic branch
      └── feature/#409/#494.cost-tracking         <- PRs into epic branch

# When all sub-issues are done:
feature/#409.llm-infrastructure -> main            <- one final PR
```

1. Create the epic branch: `git worktree add ../{{worktree_dir}}/<epic-num> -b feature/#<num>.<summary> main`
2. **Immediately create the epic PR** (even if empty) so progress is visible
3. Sub-issue worktrees branch off the **epic branch**, not main
4. Sub-issue PRs target the **epic branch** (`gh pr create --base feature/#<epic-num>.<summary>`)
5. Sub-issue PR body uses `closes #<sub-num>` as usual
6. When all sub-issues are merged, mark the epic PR as ready for review

---

## Pull Request format (`branch` and `worktrees` modes)

Every PR must link back to the issue it closes. This applies whether you open the PR via `/ship` or `gh pr create` directly.

- **Title:** `[#<num>] <issue title>` — e.g. `[#22] Retire Cloudflare Pages branch previews`. Use the issue title from `glb show <num>`, not a conventional-commit summary.
- **Sub-issue title** (epic-branch workflow only): `[#<epic-num>/#<num>] <issue title>`.
- **Body:** must start with `closes #<num>` on the first line so GitHub auto-closes the issue on merge.

Do NOT use conventional-commit titles for PRs — those belong on commits, not PRs. The `[#<num>]` prefix is what links the PR to the tracker.

---

## Session Completion (all modes)

- **NEVER stop before pushing** — that leaves work stranded locally. YOU must push; never say "ready to push when you are."
- **File issues** for any remaining work — `glb create`
- If push fails, resolve and retry until it succeeds
