---
name: mode
description: Show or switch the project's milky-kit workflow mode. Three modes — `main` (direct on main, no branches, no PRs), `branch` (feature branch in root checkout, PR to main, no worktree), `worktrees` (lead develops on a feature branch in root and delegates parallel tasks to isolated worktrees; PR to main; a worktree task never switches the root branch). Writes `.milky-kit-mode` at project root.
argument-hint: "[main | branch | worktrees | (no argument shows current mode)]"
---

# Show or switch milky-kit workflow mode

Use this skill to flip a project between the three workflow modes. Both the modes themselves and the task workflows they imply are defined in `modules/core/rules/workflow.md`.

| Mode | Branch | Worktree | Ship via |
|---|---|---|---|
| `main` | no | no | push to `main` directly |
| `branch` | yes — in root checkout | no | PR to `main` |
| `worktrees` | yes — lead on a branch in root | yes — delegated tasks in `../<worktree-dir>/<num>/` | PR to `main` |

## When to invoke

User says any of: "switch to <mode> mode", "set mode to ...", "/milky-kit:mode <value>", "what mode am I in?", "/milky-kit:mode".

## Argument forms

- `/milky-kit:mode` — print the current mode (read `.milky-kit-mode`). If missing, say so and recommend setting it explicitly.
- `/milky-kit:mode main` — switch to main.
- `/milky-kit:mode branch` — switch to branch.
- `/milky-kit:mode worktrees` — switch to worktrees.

Anything else → reject with the valid values and stop.

## Flow

### When showing the current mode

1. Read `.milky-kit-mode`:
   ```bash
   cat .milky-kit-mode 2>/dev/null
   ```
2. Print one line: `Current mode: <mode>` or `No .milky-kit-mode file — defaulting to branch. Run /milky-kit:mode <value> to make it explicit.`

### When switching mode

1. **Read current mode** (if any).

2. **If current mode == requested mode**, say "Already in <mode> mode" and stop — no file write.

3. **Confirm before writing** if it changes. Use `AskUserQuestion` Yes / No (Recommended: Yes) showing:

   ```
   Switch from <current-or-none> → <requested>?

   <requested> mode means:
   - main:      commit directly on main, push to main, no PRs
   - branch:    feature branch in the root checkout, ship via PR
   - worktrees: lead on a feature branch in root + delegated tasks in isolated worktrees (a worktree task never switches the root branch), ship via PR
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

7. **If switching TO `main` while not on `main`**, tell the user:
   ```
   You're currently on branch <X>. In main mode all work happens on main. Switch when you've shipped <X>:
     git checkout main && git pull
   ```

8. **If switching TO `branch` or `main` while inside a worktree**, tell the user:
   ```
   You're currently inside ../<worktree-dir>/<num>/. The mode switch applies to the NEXT task. Finish the current task here first.
   ```

## Guardrails

- **Reject unknown modes.** Only `main`, `branch`, and `worktrees` are valid.
- **Never commit the mode file.** Surface the file change; the user commits.
- **Never delete worktrees** as part of a mode switch. Switching out of `worktrees` doesn't mean clean up existing worktrees — those are user-owned. Tell the user about `git worktree list` and `mise run worktree:cleanup <num>` if they want to clean up manually.
- **Never modify `workflow.md`, `worktrees.md`, or `CLAUDE.md`.** Mode is data, not code — only the `.milky-kit-mode` file changes.

## Conventions to honor

- **No PRs in this skill.** Even in `branch` or `worktrees` mode, this skill writes one file at the project root — not a task that needs a PR.
- **Stay in the user's current directory.** The skill writes to whichever project root it's invoked from. If invoked from inside a worktree, write to that worktree's checkout (the file lives in the shared tree via git's worktree mechanism). If unsure, ask.
