---
modes: [worktrees]
---

# Task Workflow — `worktrees` mode

When `.milky-kit-mode` is `worktrees`, follow these steps (`workflow.md` holds what every mode shares).

Worktrees mode has two roles. **The default is the worktree:**

- **Worktree task (default)** — unless the user explicitly says otherwise, create an isolated worktree for the task and work there. See `worktrees.md`. Spawned sub-agents on parallel tasks do this too.
- **Root checkout** — only via `/here`, or when the user explicitly says "do it here," "in root," or "in the root checkout." Then develop on a feature branch in the root exactly like `branch` mode: create the branch, claim, work, `/ship`, `/land`.

**Routing rule:** if the user did not say where to do the task, do it in a **worktree**. Work in the root checkout only on an explicit `/here` / "do it here" / "in root."

**Iron rule (both roles):** a worktree task must NEVER switch, pull, reset, or rebase the branch checked out in the **root**. No `git checkout <branch>` in root, no `git checkout main && git pull` in root from a worktree flow. To base a worktree on fresh main, `git fetch origin` and branch off `origin/main` — fetch updates refs without touching any working tree. The root's branch is sacred; someone else may be mid-edit on it.

### Root checkout — only via `/here` or an explicit "in root"

Follow the **`branch` mode** workflow (`workflow-branch.md`) verbatim: sync (`git fetch origin`, plus `git pull` if on `main`), create `feature/#<num>.<summary>` in the root checkout, claim the issue, work, `/ship`, `/land`.

### Worktree task (default)

#### Multi-Agent Environment

Multiple agents run in parallel on separate branches. This means:

- **Only touch files relevant to your task.** Do not modify, stash, reset, or discard files you didn't create or change yourself.
- **Never run `git stash`, `git reset --hard`, `git checkout -- <file>`, or `git clean`** unless you are certain those changes belong to you. When in doubt, leave it alone.
- **Never run a git command in the root checkout.** Someone may be working there on their own branch — stay in your worktree.
- If you see unexpected files or changes, investigate before acting — they likely belong to another agent working in parallel.

#### 1. Create a worktree

Each task gets its own isolated worktree, branched off fresh main. See `worktrees.md` for the full workflow.

```bash
mise run worktree:setup <num> feature/#<num>.<summary>
```

The setup task fetches `origin` and bases the new branch on `origin/main` — it never checks out `main` in the root. Then enter the worktree via the `EnterWorktree` tool — do **not** `cd`. Manual `cd` desynchronizes the harness from the shell.

```
EnterWorktree(path: "../{{worktree_dir}}/<num>")
```

Do all work — editing, building, testing, committing — from inside this directory.

#### 2. Verify worktree

Before touching any file or running any command, confirm you are in the right place:

```bash
pwd                       # must be .../{{worktree_dir}}/<num>
git branch --show-current # must be your issue branch
```

If either is wrong, stop and re-enter the correct worktree with `EnterWorktree(path: ...)` — do not use `cd`.

#### 3. Claim & work

```bash
gh issue edit <num> --add-label stage:working --remove-label stage:ready --add-assignee @me
```

**Before writing new code, find a similar existing implementation in each layer you're about to touch and follow its patterns.**

Commit semi-frequently.

#### 4. Ship via PR

**When implementation is done, run `/ship`.** Same as `branch` mode — quality gates, draft PR, CI loop, mark ready.

PR title format: `[#<num>] <issue title>`. Body starts with `closes #<num>`.

After the user merges, say "merged" to trigger `/land`. `/land` removes the worktree without touching the root's branch.

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

1. Create the epic branch: `git fetch origin && git worktree add ../{{worktree_dir}}/<epic-num> -b feature/#<num>.<summary> origin/main`
2. **Immediately create the epic PR** (even if empty) so progress is visible
3. Sub-issue worktrees branch off the **epic branch**, not main
4. Sub-issue PRs target the **epic branch** (`gh pr create --base feature/#<epic-num>.<summary>`)
5. Sub-issue PR body uses `closes #<sub-num>` as usual
6. When all sub-issues are merged, mark the epic PR as ready for review
