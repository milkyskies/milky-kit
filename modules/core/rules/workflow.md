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
| `worktrees` | yes — in the worktree | yes — **every task by default**, in `../<worktree-dir>/<num>/`; root only via `/here` | PR to `main` |

- **`main`** — direct on main. No branches, no worktrees, no PRs. Best for solo solo work, the kit itself, small personal projects where you trust yourself.
- **`branch`** — feature branch in the root checkout. Ship via PR. No worktree directory. Best for typical solo work where you still want PR review.
- **`worktrees`** — **every task gets its own worktree by default.** Working in the root checkout is the exception and requires an explicit `/here`. A worktree task must never switch the root's checked-out branch. Best for parallel multi-agent work, or any time you want the root left free while work happens.

**Do not try to determine your own role.** "Am I the lead?" is not answerable from inside one agent's context, and guessing it is how an agent ends up checking out its branch in a root checkout someone else is using. Whoever spawns an agent creates the worktree first and launches the agent inside it. If you are already in a worktree, that is your answer.

If `.milky-kit-mode` is missing, default to `branch` and tell the user — they should set it explicitly with `/milky-kit:mode <value>`.

To switch modes between tasks, run `/milky-kit:mode main | branch | worktrees`. The flip applies to the next task — finish whatever you're doing in the current mode first.

## Issue Tracking (all modes)

Use GitHub Issues with labels for ALL task tracking, through plain `gh`. Do NOT use TodoWrite, TaskCreate, or markdown TODOs.

**`issues.md` is canonical for everything about the tracker** — labels, stages, commands, points, priorities, type labels, epics, and the issue body template. Read that file rather than this one for any of them.

Start every session with `gh issue list --label stage:ready`, claim the issue with `gh issue edit <num> --add-label stage:working --remove-label stage:ready --add-assignee @me` before touching code, and move it to `stage:done` and close it when finished.

Two rules stay here, because both are about branching rather than tracking:

- **Sub-issues branch off `main` and PR into `main`, just like any other issue.** The parent/child relationship is organizational only. The epic-branch workflow (sub-PRs into an epic branch) applies only in `branch` or `worktrees` mode, and only when the user explicitly asks for it.
- **No em dashes in PR titles.** Issue titles avoid them too (see `issues.md`); nothing checks a PR title, so it falls to you.

## Session Start — MANDATORY (all modes)

Update remote refs before doing anything:

```bash
git fetch origin
```

In `main` and `branch` modes, also bring the root checkout onto a fresh `main`:

```bash
git checkout main && git pull
```

In `worktrees` mode, **do not switch the root's branch.** The root may hold someone else's in-progress feature branch — `git fetch origin` is enough; only `git pull` if the root happens to be on `main`.

## Read the Docs (all modes)

Before touching code in a feature or area you don't already know, check whether the project ships a doc for it.

1. If `docs/README.md` exists, open it; it indexes the project's product and architecture docs.
2. Find the relevant doc (feature, plugin, architecture topic) and read it before starting.

Most projects in this kit do not maintain a `docs/` directory; that is fine. The rule is "read the doc if there is one," not "every project must have docs."

## Your mode's steps

The task workflow of each mode is its own rule, linked by `mise run rules:link` only in that mode: `workflow-main.md`, `workflow-branch.md` (also the root checkout in `worktrees` mode, with the PR format) and `workflow-worktrees.md` with `worktrees.md`. If yours is not in `.claude/rules/`, read it from `~/.claude/kit/modules/core/rules/` and run `/milky-kit:upgrade`.

---

## Session Completion (all modes)

- **NEVER stop before pushing** — that leaves work stranded locally. YOU must push; never say "ready to push when you are."
- **File issues** for any remaining work — `gh issue create`
- If push fails, resolve and retry until it succeeds
