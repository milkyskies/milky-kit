---
name: mode
description: Show or switch the project's milky-kit workflow mode. `root` mode = work directly in the project root checkout, push to main, no PRs. `worktrees` mode = each task in its own ../<worktree-dir>/<num>/ branch, ship via PR. Writes `.milky-kit-mode` at project root.
argument-hint: "[root | worktrees | (no argument shows current mode)]"
---

# Show or switch milky-kit workflow mode

Use this skill to flip a project between `root` mode (work directly in the root checkout, push to main) and `worktrees` mode (isolated worktree per task, ship via PR). Both modes are documented in full inside `modules/core/rules/workflow.md`.

## When to invoke

- User says any of: "switch to root mode", "switch to worktrees", "set mode to ...", "/milky-kit:mode <root|worktrees>", "what mode am I in?", "/milky-kit:mode".

## Argument forms

- `/milky-kit:mode` — no argument. Print the current mode (read `.milky-kit-mode`). If missing, say so and recommend setting it explicitly.
- `/milky-kit:mode root` — switch to root.
- `/milky-kit:mode worktrees` — switch to worktrees.

Anything else (e.g. `/milky-kit:mode foo`) → reject with the valid values and stop.

## Flow

### When showing the current mode

1. Read `.milky-kit-mode`:
   ```bash
   cat .milky-kit-mode 2>/dev/null
   ```
2. Print one line: `Current mode: <mode>` or `No .milky-kit-mode file — defaulting to root. Run /milky-kit:mode root to make it explicit.`

### When switching mode

1. **Read current mode** (if any).

2. **If current mode == requested mode**, say "Already in <mode> mode" and stop — no file write.

3. **Confirm before writing** if it changes. Use `AskUserQuestion` Yes / No (Recommended: Yes) showing:

   ```
   Switch from <current-or-none> → <requested>?

   <requested> mode means:
   - root: work in this checkout, push to main, no PRs
   - worktrees: each task in ../<worktree-dir>/<num>/, ship via PR
   ```

4. **Write the file:**
   ```bash
   echo "<requested>" > .milky-kit-mode
   ```

5. **Do NOT commit the change.** The user commits when they commit other work. Tell the user:

   ```
   Switched to <requested> mode (.milky-kit-mode updated).

   Not committed — stage and commit when you're ready:
     git add .milky-kit-mode && git commit -m "chore: switch to <requested> workflow"
   ```

6. **If switching TO `worktrees`**, also check whether the project's worktree mise tasks exist:
   ```bash
   ls .mise/tasks/worktree/ 2>/dev/null
   ```
   If they're missing, point the user at `/milky-kit:retrofit` to add the worktree module's scaffold.

7. **If switching TO `root` while a worktree is currently checked out**, tell the user:
   ```
   You're currently inside ../<worktree-dir>/<num>/. The mode switch takes effect for the NEXT task. Finish the current task here first.
   ```

## Guardrails

- **Reject unknown modes.** Only `root` and `worktrees` are valid.
- **Never commit the mode file.** Surface the file change; the user commits.
- **Never delete worktrees** as part of a mode switch. Switching to `root` doesn't mean clean up existing worktrees — those are user-owned. Tell the user about `git worktree list` and `mise run worktree:cleanup <num>` if they want to clean up manually.
- **Never modify `workflow.md`, `worktrees.md`, or `CLAUDE.md`.** Mode is data, not code — only the `.milky-kit-mode` file changes.

## Conventions to honor

- **No PRs in this skill.** Even in worktrees mode, this skill writes one file at the project root — not a task that needs a PR.
- **Stay in the user's current directory.** The skill writes to whichever project root it's invoked from. If invoked from inside a worktree, write to the worktree's project root (the worktree shares the same project root via git's worktree mechanism, so the file lands in the shared tree). If unsure, ask.
