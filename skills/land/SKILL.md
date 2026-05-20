---
name: land
description: >
  Clean up after a PR is merged - close the issue, remove the worktree + DB, and sync main.
  TRIGGER when: the user says "merged", "landed", "done", or confirms a PR has been merged.
  DO NOT TRIGGER when: the PR is still open or under review.
argument-hint: "[issue number (optional, inferred from branch if omitted)]"
---

# Land

Clean up after a merged PR. What "clean up" means depends on the workflow mode (see `modules/core/rules/workflow.md`):

- **`main` mode**: no-op for git state (already on main). Just confirm the issue is closed.
- **`branch` mode**: switch back to main, pull, delete the local feature branch.
- **`worktrees` mode**: cleanup the worktree directory via `mise run worktree:cleanup`, sync main.

**Only run this after the user confirms the PR has been merged.** In `main` mode there is no PR; `/ship` already closed the issue and `/land` is rarely needed.

## Inputs

- `$ARGUMENTS` — issue number. If omitted, infer from the current branch name (e.g. `feature/#123.foo` -> `123`).

## Step 0: Read the workflow mode

```bash
mode=$(cat .milky-kit-mode 2>/dev/null || echo "branch")
```

The mode determines which steps below run.

## Step 1: Determine context

1. Get the current branch: `git branch --show-current`
2. Infer the issue number from the branch if not provided
3. Check if this is a sub-issue (branch matches `feature/#<epic>/#<sub>.*`)

## Step 2: Close the issue (all modes)

```bash
glb close <num>
```

If the merged PR's body included `closes #<num>` GitHub already closed the issue; `glb close` is idempotent.

## Step 3: Mode-specific cleanup

### `main` mode

No cleanup needed. Skip to Step 5.

### `branch` mode

Switch back to main, pull, delete the local feature branch:

```bash
git checkout main
git pull
git branch -d <feature-branch>
```

Use `-d` (safe delete — fails if the branch isn't merged) rather than `-D`. If the remote PR was merged, the local branch is also merged via the merge commit pulled in `git pull`, so `-d` succeeds.

### `worktrees` mode

Run the project's worktree cleanup task:

```bash
cd ~/Code/Projects/{{project_name}}
mise run worktree:cleanup <num>
```

Then sync main in the project root:

```bash
git checkout main
git pull
```

## Step 4: Epic check (branch and worktrees modes)

If this was a sub-issue, check whether all sub-issues of the parent epic are now closed:

```bash
glb sub list <epic-num>
```

If all sub-issues are done, tell the user the epic is ready to be finalized. (Sub-issue / epic workflow does not apply in `main` mode.)

## Step 5: Report

Tell the user:
- Issue #<num> closed
- (branch mode) Local feature branch deleted, main synced
- (worktrees mode) Worktree removed, main synced
- (main mode) Already on main; no git cleanup needed
- If epic: whether the epic is ready to finalize
