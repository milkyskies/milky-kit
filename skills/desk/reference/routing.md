# Routing

Read this before every `worker-start`, and when escalating. The coordinator chooses the model and the effort. The program never decides routing.

## The routing table

| Work | Model | Effort |
|---|---|---|
| Frontman, plans, design talk, explorations | Opus | high |
| Taste work: how a screen looks, dialogue, 3D | Opus | medium (3D: high) |
| A hard area from the project's list | Sonnet | medium |
| Merging, conflicts, build fixes | Sonnet | low |
| Easy and mechanical, with a check command | Haiku | none |
| Easy but no check command | Sonnet | low |
| Easy, but the worker must read a long log or hold 20 or more files in view | Sonnet | low |
| The ship phase of any worker (commit, merge main, push) | (same model) | low |
| Web research | the researcher agent (Sonnet) | |
| Finding code | the scout agent (Haiku) | |

The project's `### Routing` rows in its `## desk` section are read first and win over this table. `### Hard areas` names the globs where the "hard area" row applies.

- **Opus when the job needs taste or design judgment that a brief cannot spell out. Sonnet when the brief already says what done looks like.**
- A request that mixes kinds of work takes the higher row.
- Effort is the cheapest lever after the model. Keep `high` for the rows that carry it.
- Never use a Fast variant of any model.
- Every `worker-start` passes `--agent claude --model <model> --effort <effort>`. The Haiku rows have effort "none" and pass no `--effort`.

## Research and lookups

All research goes to the researcher agent (`subagent_type: "researcher"`, pinned to Sonnet): web lookups, how other products do something, real-world facts, and facts in the code such as what a constant is or where something is defined. The coordinator never researches on its own model. It hands the question over and checks the answer before acting on it. Finding code goes to the scout agent, an in-session Haiku subagent, never an Orca worker.

Neither agent writes code or judges correctness. Every brief carries the same instruction, so workers route their research the same way (`reference/tokens.md`).

## Why the area decides

Two decisions take the same input: which model implements an issue, and whether its diff earns a review pass. The input is what part of the codebase the issue touches.

Where a similar implementation already exists, the work is pattern-matching. A cheap model does that well. Where the worker must design (domain rules, a schema change, a money path), that is judgement, which is what the expensive model is for.

The number of layers a change spans does not make it hard. A new field carried through the database, the endpoint and the form is easy when each layer already has a pattern to copy. A change inside one file is hard when a wrong answer looks plausible.

The kit owns the shape. The contents are the project's: "drizzle migrations" is meaningless in a project with no database, and "auth sessions" is meaningless in a command-line tool. Each project declares its own `### Hard areas`. An issue's `## Area` section is the only record of where the change lands, because the coordinator routes before the diff exists.

A project that declares no hard areas routes everything to Sonnet.

### Areas a project usually lists

A project copies the rows that apply into its `### Hard areas`, with paths:

| Area | Why a wrong answer hides |
|---|---|
| Core domain rules | The algorithms the product is built on, where a wrong answer looks plausible |
| Async and background work | Queues, retries, scheduled jobs, event handlers |
| Concurrency and locking | Shared state, single-flight, anything racing |
| Date and time logic | Periods, time zones, boundaries |
| Auth and sessions | Tokens, login flows, permissions |
| Data migrations | Migrations that alter existing rows or constraints |
| Frontend state machines | Multi-step wizards, flows with undo or resume |

## Routing order

1. **`needs:opus` label.** The human who filed it knows.
2. **P0.**
3. **Area matches the project's routing rows or hard areas.** Use that tier.
4. **No match.** Sonnet.
5. **Failed or parked.** Escalate one tier and retry.

Step 5 is a backstop, not the plan. Starting everything cheap and escalating sounds efficient and is not: some work should never get a cheap first attempt, because the cost of a wrong one is not a wasted run but a human interrupted.

A request whose spec is unclear is never dispatched. It is a card, and the human decides before any worker starts.

## Escalation

`desk reconcile` reports the attempt count. Attempts are the `desk:release` and `desk:failed` comments after the newest human comment, so a human answer resets the count.

- **Haiku, 2 attempts:** dispatch Sonnet.
- **Sonnet, 2 attempts:** the coordinator parks the request itself, with a card listing what was tried.
- **Parking escalates too.** A weaker model mostly does not write bad code. It parks more, hitting ambiguity a stronger model would have decided, and every false park costs human attention. A park on the first attempt earns one retry a tier up before anyone is pinged. If the stronger model parks too, the question is real.
- **The reviewer never gets a write task.**

## Roles with fixed tiers

Only the worker is routed. These are stable:

| Role | Tier |
|---|---|
| Coordinator | Sonnet, medium |
| Merge worker, reply-only worker, CI-fix worker | Sonnet, low |
| Standing reviewer | Opus, medium |
| Decision comment written by the coordinator | Opus |

The decision comment is Opus because deciding what to ask a human is the highest-leverage sentence an agent writes all run.

## Where a worker goes

A worker that builds anything gets its own child worktree, nested under the coordinator's:

```bash
orca orchestration worker-start \
  --spec "<brief>" --task-title "#<n> <issue title>" \
  --agent claude --model <model> --effort <effort> \
  --worktree new-child --name <n> --base-branch main --json
```

- **Never `--worktree current` for a worker that builds.** Two workers building in one folder overwrite each other's build. `--worktree current` is for a worker that only reads, such as the standing reviewer.
- **Always `--base-branch main`.** Which branch a child worktree starts from is a separate choice from where it sits. Every pull request goes into `main`: the desk has no feature or integration branches. A sub-issue branches off `main` like any other issue.
- A new worktree runs the project's setup hooks by default. `--setup` stays unset.

After the start, compare `launch.requested` with `launch.effective` in the receipt. Never report a model or an effort from the flags alone.

## Reusing a worker

A worker is reused for the same request only. A rejected result, review fixes, a conflict, a human comment on the Issue: each returns to the worker that wrote the code while its terminal is open, with its context kept, because that context is the value. `reconcile` already routes `conversation` and `check-red` this way.

Every new request gets a fresh worker in a fresh child worktree. Three reasons:

- After a `/clear`, a reused terminal carries no context, so reusing it across requests saves almost nothing.
- Orca refuses `--model` and `--effort` together with `--terminal`, so a reused terminal keeps the model it launched with, and the next request may need a different row of the table.
- `desk land` releases the worker and removes the worktree after the merge. A worker that moved on to another request inside that worktree would lose it.

To send a follow-up to a worker:

```bash
orca orchestration worker-show --dispatch <dispatch id> --json
orca orchestration worker-start --spec "<follow-up>" --task-title "#<n> <issue title>" \
  --terminal <its handle> --worktree path:<the worker's worktree> --json
```

- Resolve the handle from `worker-show`, or record it from the `worker-start` receipt. Never find a worker by matching a worktree name in `worker-list` output: the rows carry no worktree path, and a text match silently picks the wrong worker.
- Leave out `--model` and `--effort`. `--worktree current` would mean the coordinator's worktree, so pass the worker's own path.
- A worker that has sent `worker_done` sits idle and does not act on a plain `orchestration send`. Give the follow-up as a new task with `worker-start --terminal`.

### The per-project override

A project whose fresh worktree is expensive to set up (a heavy engine import, a long warmup) may opt in to reuse across requests. It writes this line under `### Routing` in its `## desk` section:

```
- reuse landed workers: yes
```

With the line present, the coordinator may give a new request to the terminal of a worker whose earlier request has landed. Three conditions hold:

1. `desk land` has run for the earlier request, so the old worktree is gone.
2. The coordinator sends `/clear` to the terminal first: `orca terminal send --terminal <its handle> --enter --text "/clear"`. A worker's whole history is sent again on every turn, so carrying it into an unrelated request is pure cost.
3. The new request lands in a fresh worktree, and the row of the table for the new request matches the model the terminal launched with. Otherwise the coordinator starts a fresh worker.

The coordinator reads `### Routing` as prose, so the line needs no parser change. UNVERIFIED: whether Orca accepts `--terminal` together with a new child worktree. Test it on the first project that opts in, and fall back to a fresh worker if Orca refuses.

## A stuck worker

A worker whose `projection.stage.activity` is `waiting` is most likely stopped on a permission or trust prompt. Ping with the pane to open and what to accept. Never relaunch it.
