---
name: here
description: >
  Work on the current task in the root checkout instead of an isolated worktree.
  The escape hatch for `worktrees` mode, where a worktree is the default.
  TRIGGER when: the user says "/here", "do it here", "in root", "in the root checkout",
  or the task is too small to be worth worktree setup cost.
  DO NOT TRIGGER when: `.milky-kit-mode` is `main` or `branch` (there is no worktree to opt out of),
  or when the user asked for parallel work across several issues.
argument-hint: "[issue number (optional, inferred from the task if omitted)]"
---

# Here

Do this task in the **root checkout** rather than a worktree.

In `worktrees` mode every task gets its own worktree by default. That default is right for anything long-running or parallel, but it costs real time: `worktree:setup` does branch creation, database provisioning, environment copying, and a dependency install. For a two-file documentation edit that is minutes of setup for seconds of work.

`/here` is how you skip it. It is a deliberate instruction from the user, not something an agent decides for itself.

## When this is the right call

- Small, self-contained edits — a typo, a config line, one rule file.
- Read-only work — answering questions, reading code, `git log`. This does not even need `/here`; reading in root is always fine.
- Anything where you want the worktree directory left clean.

## When it is not

- **Parallel work.** If several issues are being worked at once, they need isolation. Say so and use worktrees.
- **Anything long-running.** The longer you hold the root branch, the longer nobody else can use it.
- **`main` or `branch` mode.** There is no worktree default to escape, so `/here` is a no-op. Say so and follow `workflow.md` for that mode.

## Steps

### 1. Confirm the mode

```bash
cat .milky-kit-mode
```

If it is not `worktrees`, tell the user `/here` does nothing in this mode and continue with the normal workflow.

### 2. Confirm you are actually in the root

```bash
pwd   # must be the main repository, not ../<worktree-dir>/<num>
```

If you are in a worktree, `ExitWorktree(action: "keep")` first. Do not `cd`.

### 3. Check the root is free

```bash
git branch --show-current
git status --short
```

If the root is on someone else's feature branch or has uncommitted changes you did not make, **stop and ask**. `/here` grants permission to use the root; it does not grant permission to disturb work already there.

### 4. Work as in `branch` mode

Follow the `branch` mode section of `workflow.md` verbatim:

```bash
git checkout main && git pull
git checkout -b <prefix>/#<num>.<summary>
glb update <num> --claim
```

Then work, `/ship`, and `/land` as normal.

## Rules

- **`/here` is the user's call, never yours.** An agent that decides on its own to work in root is the exact bug this skill exists to prevent.
- **It applies to one task, not the session.** The next task defaults back to a worktree.
- **It does not lift the iron rule.** Even in root, never switch, reset, or rebase a branch that is not yours.
