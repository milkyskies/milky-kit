---
name: ship
description: >
  Run quality gates, create or update a PR, poll CI, then mark ready. Pass --review to also run /simplify and /rulify first; without it neither runs.
  TRIGGER when: (1) the user says "ship it", "ship", or asks to create or open a PR, OR (2) you have finished implementing a task and are ready to submit it -- invoke this automatically as part of the workflow.
  DO NOT TRIGGER when: the user just wants to run tests or quality gates without creating a PR.
argument-hint: "[issue number (optional, inferred from branch)] [--review]"
---

# Ship

Full pipeline. Shape depends on the project's workflow mode (see `modules/core/rules/workflow.md`):

- **`main` mode**: quality gates → push to main → `glb done`. No PR.
- **`branch` or `worktrees` mode**: quality gates → PR → CI loop → mark ready. Full flow below.

**`/simplify` and `/rulify` do not run unless you pass `--review`.** They rewrite code, and whether a diff is worth that is the author's call, not this skill's.

On **re-runs** (PR already exists), skip PR creation — just run quality gates, push, and resume the CI + merge loop. `--review` behaves the same on a re-run as on a first run.

## Inputs

- `$ARGUMENTS` — issue number. If omitted, infer from the current branch name (e.g. `feature/#123.foo` -> `123`).
- `--review` — also run the review passes (`/simplify`, `/rulify`) before opening the PR. Off by default.

## Step 0: Read the workflow mode

```bash
mode=$(cat .milky-kit-mode 2>/dev/null || echo "branch")
```

- `main` → follow the **main-mode shortcut** at the bottom of this skill. Skip the PR pipeline.
- `branch` / `worktrees` → continue with the full pipeline below.

## Step 1: Determine scope

1. Get the current branch name: `git branch --show-current`
2. Infer the issue number from the branch if not provided via `$ARGUMENTS`
3. Determine which packages/apps were changed:
   - `git diff --name-only $(git merge-base HEAD origin/main)...HEAD` (or the epic branch if this is a sub-issue)
   - Map changed paths to packages and frontend apps
4. Check if this is a sub-issue (branch matches `feature/#<epic>/#<sub>.*`) — if so, the PR base is the epic branch, not main
5. Check if a PR already exists for this branch: `gh pr view --json number,state 2>/dev/null`

## Step 2: Verify against issue

**MANDATORY — produce the checklist below as visible output.** Run `glb show <num>` and list every requirement, acceptance criterion, and sub-task from the issue body. Mark each:

- ✓ `<requirement>` — implemented in `<file:line>`
- ✗ `<requirement>` — MISSING, implementing now
- ⊘ `<requirement>` — skipped because `<reason>` (only use when the user explicitly agreed or it's clearly out of scope)

If anything is ✗, finish it before proceeding.

## Step 3: Review passes — only with `--review`

**Skip this step entirely unless `$ARGUMENTS` contains `--review`.**

These passes rewrite code. They are expensive, they are subjective, and whether a diff is worth one is a judgement the person who wrote it has already made. Running them uninvited on three files of tuned constants wastes their time to tell them nothing.

Gates are different — cheap, objective, and always worth it. They are Step 4 and always run.

When `--review` is passed, run in order:

1. **`/simplify`** — reuse, quality, efficiency.
2. **`/rulify`** — cross-check `.claude/rules/`.
3. **Clean removals** — no dead branches, commented-out blocks, unused stubs, backcompat shims, `// TODO remove later`. If old code was replaced, it must be fully gone.

Commit any fixes.

**Autopilot is the exception, and it does not rely on this skill for it.** An unattended run has no human between its first draft and the review pile, so its worker invokes the passes in its own step list — see `skills/autopilot/SKILL.md`. Do not add them back here to cover that case.

## Step 4: Quality gates

Run quality gates **scoped to changed packages only**. These always run. They come after Step 3 because `/simplify` may have rewritten code that needs re-formatting and re-linting.

Check `.claude/rules/` for the specific quality gate commands for each technology in this project (e.g., Rust formatting/linting/testing, frontend linting/typechecking/testing).

Common patterns:
- **Rust**: `cargo fmt -p <pkg>`, `cargo clippy -p <pkg> -- -D warnings`, `cargo nextest run -p <pkg>`
- **Frontend**: `cd <app-dir> && pnpm lint:fix`, `cd <app-dir> && pnpm check`

Commit any fixes from this step.

## Step 5: PR

Push the branch:
```bash
git push -u origin $(git branch --show-current)
```

**If a PR already exists**, skip to step 6.

**If no PR exists**, compose the body, then create a draft.

**Invoke `/write-pr`** to compose the body — it owns the format (Overview / Architecture diagrams / Contents / Design decisions / Verification) and calls `/arch-diagrams` for the diagram section. It emits `closes #<num>` as the first line. Save its output to a temp file (e.g. `/tmp/pr-body.md`).

**Standalone issue** (PR targets main):
```bash
gh pr create --draft --title "[#<num>] <issue title>" --body-file /tmp/pr-body.md
```

**Sub-issue** (PR targets epic branch):
```bash
gh pr create --draft --base feature/#<epic-num>.<summary> \
  --title "[#<epic-num>/#<num>] <issue title>" --body-file /tmp/pr-body.md
```

Get the issue title from `glb show <num>`. Do **not** hand-write the body here — `/write-pr` owns it, and guarantees the `closes #<num>` first line.

**On re-runs where the change grew**, re-invoke `/write-pr` and update the body: `gh pr edit <pr-number> --body-file /tmp/pr-body.md`.

## Step 6: Local testing instructions (before CI)

**Immediately after pushing/creating the PR**, tell the user how to test locally so they can verify while CI runs:

1. The exact mise command with worktree number: `mise run dev <worktree-num>`
2. URL(s) to open
3. What to do to trigger the feature
4. What to look for to confirm it works

Do NOT wait for CI to finish before giving these instructions.

## Step 7: CI loop

Each poll iteration, check **both**:
1. CI status: `gh pr checks <pr-number>`
2. Merge conflicts: `gh pr view <pr-number> --json mergeable --jq '.mergeable'`

Keep output minimal — just report pass/fail status, not full logs.

Track consecutive failures. **Cap at 3 — after 3 consecutive failures, stop and ask the user.**

### On CI failure or merge conflict:

1. **Merge conflicts** (`mergeable` is `CONFLICTING`): merge the base branch in and resolve conflicts
2. **CI failures**: read failure logs and fix the issue
3. Re-run quality gates (step 4) on affected packages
4. If `--review` was passed and the fix involved new logic rather than a mechanical correction, re-run the passes over the new work
5. Commit, push, poll again

### On CI pass AND no conflicts:

Proceed to step 8.

## Step 8: Mark ready + report

```bash
gh pr ready <pr-number>
```

Tell the user:

1. **PR URL** — always link the PR.
2. **Whether the review passes ran** — one line. If they did not, say `no review passes (pass --review to run them)` so the option stays visible.
3. Remind them to say "merged" when the PR is merged so `/land` can clean up.

**Never run `gh pr merge`.**

---

## Main-mode shortcut

Invoked when `.milky-kit-mode` is `main`. No branch, no PR, no `/land` follow-up — just verify and push.

### M1: Verify on main

```bash
git branch --show-current   # must be main
```

If not on `main`, stop and tell the user the mode is wrong for this branch.

### M2: Verify against the issue

Same as Step 2 above — produce the ✓/✗/⊘ checklist from `glb show <num>`. Finish any ✗ before proceeding.

### M3: Code review + quality gates

Same as steps 3 + 4 above: the review passes only if `--review` was given, then the gates — formatter, linter, typecheck, test scoped to changed packages. Commit fixes.

### M4: Push to main

```bash
git push origin main
```

If push fails (someone else pushed first), `git pull --rebase` and retry. **No `--force` push, ever.**

### M5: Close the issue

```bash
glb done <num> --comment "<short summary>"
```

If the most recent commit's body includes `closes #<num>`, GitHub will also close the issue on push — `glb done` is idempotent and keeps the metadata in sync.

### M6: Report

Tell the user:

1. Issue #N closed.
2. Commit SHA pushed.
3. **Whether the review passes ran** — one line, naming `--review` if they did not.

No `/land` follow-up needed in main mode; nothing to clean up.
