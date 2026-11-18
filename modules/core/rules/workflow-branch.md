---
modes: [branch, worktrees]
---

# Task Workflow — `branch` mode

When `.milky-kit-mode` is `branch`, follow these steps (`workflow.md` holds what every mode shares). In `worktrees` mode they are the steps for the root checkout (`/here`), and this file loads there too.

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
gh issue edit <num> --add-label stage:working --remove-label stage:ready --add-assignee @me
```

**Before writing new code, find a similar existing implementation in each layer you're about to touch and follow its patterns.**

Commit semi-frequently — don't save everything for one giant commit. Stage specific files, never `git add -A`.

### 4. Ship via PR

**When implementation is done, run `/ship`.** It handles quality gates, code review, draft PR, CI loop, and mark-ready.

After the user merges, say "merged" to trigger `/land`. `/land` switches back to `main`, pulls, and deletes the local branch.

PR title format: `[#<num>] <issue title>`. Body starts with `closes #<num>`.

## Pull Request format (`branch` and `worktrees` modes)

Every PR must link back to the issue it closes. This applies whether you open the PR via `/ship` or `gh pr create` directly.

- **Title:** `[#<num>] <issue title>` — e.g. `[#22] Retire Cloudflare Pages branch previews`. Use the issue title from `gh issue view <num>`, not a conventional-commit summary.
- **Sub-issue title** (epic-branch workflow only): `[#<epic-num>/#<num>] <issue title>`.
- **Body:** must start with `closes #<num>` on the first line so GitHub auto-closes the issue on merge.

Do NOT use conventional-commit titles for PRs — those belong on commits, not PRs. The `[#<num>]` prefix is what links the PR to the tracker.
