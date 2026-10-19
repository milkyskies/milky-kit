---
name: frontdesk
description: >
  Run the frontdesk coordinator for this project: one reconciling pass over GitHub Issues and Orca's
  running workers, then a background watchdog that wakes the next pass. Starting a coordinator and
  restarting one after a crash are the same command.
  TRIGGER when: the user says "/frontdesk", "start the frontdesk", "run the coordinator", "work the board",
  or asks to start autonomous work on the backlog.
  DO NOT TRIGGER when: the user named a specific issue to work on (just do it), or
  `.milky-kit-mode` is `main`.
---

# Frontdesk coordinator

The coordinator remembers nothing between passes. GitHub holds the truth: claims, attempts, results, cards, answers and pinged markers are Issue comments. Orca holds the running workers. Each pass reads both, computes the difference, and fixes it. A fresh coordinator after a crash runs the same pass and needs no handoff.

The state program is `~/.claude/kit/modules/frontdesk/bin/frontdesk`, written below as `frontdesk`. The worker contract is `.claude/rules/frontdesk.md`. The project's settings are the `## frontdesk` section of `CLAUDE.md`: `### Coordinator` (machine, default ask setting, check command, default landing), `### Machines` (worker limits), `### Hard areas`, `### Review paths`, `### Routing` and `### Preflight`. `### Review paths` is program-parsed too, because `frontdesk merge` reads it. Read the other subsections as prose.

This session is Sonnet at medium effort. The human never talks to the coordinator. Everything the human needs to decide arrives as a card on an Issue and a ping.

## One pass

1. **Preflight.** Run `frontdesk preflight --role coordinator --ping`. A failure stops the pass and nothing is dispatched. The ping already carries every fix, so end the turn after starting the watchdog (step 6) and let it retry.
2. **Run.** On the first pass of a session, run `frontdesk run`. It binds this terminal to the Orca Run named `frontdesk <owner>/<repo>`, so a fresh coordinator gets the same Run and the mail it never read stays harmless.
3. **Reconcile.** Run `frontdesk reconcile --json`. It reads GitHub and Orca, never the mailbox, and prints one mismatch per line with a code.
4. **Act, one action per mismatch**, from the table below.
5. **Digest.** Run `frontdesk digest --send`. It sends one ping for every card and result not yet pinged, for every `bad-labels` issue, and a `N merged by agents` count for every auto-landed request not yet counted.
6. **Watch.** Start `frontdesk watch` in the background (Bash `run_in_background`) and end the turn. The coordinator spends no tokens while the watchdog waits.
7. **Wake.** The watchdog exits with one JSON line naming the event: `worker-stopped`, `worker-idle`, `worker-hung`, `worker-gone`, `machine-silent`, `human-comment`, `ready`, `merged`, `mail` or `tick`. The event is only a doorbell. Start the next pass at step 1 whatever it says, and never act on the event alone.

## The mismatch table

| Code | Action |
|---|---|
| `dispatch` | Read `reference/routing.md`, choose model and effort, then start a worker. Only while live workers are under the machine's limit in `### Machines` (default: this machine, 3). |
| `intake` | A filed request is waiting to be written up, or an answer to a frontman's card has come back. Start a frontman worker (Opus, high effort) with the frontman's brief below. Only while live workers are under the machine's limit, the same as `dispatch`. |
| `intake-stuck` | Change nothing. The frontman failed or stopped twice. The digest reports it. |
| `answered-not-requeued` | Change nothing. Every card is answered but the request never moved. The digest reports it, and a human reruns `frontdesk answer` for the last card. |
| `escalate` | Dispatch one tier up: Haiku to Sonnet. A Sonnet request at 2 attempts is parked by the coordinator itself with a card listing what was tried. |
| `orphan-claim` | `frontdesk release <n> --claim <id> --reason no-worker`. It becomes `dispatch` or `escalate` on the next pass. |
| `unclaimed-worker` | The worker never claimed. Read the tail with `orca orchestration worker-read --dispatch <D>`, then `orca orchestration worker-stop --dispatch <D>`. The next pass dispatches again. |
| `unrecorded-result` | Send to the worker's terminal: "Record your result on #n with frontdesk done, frontdesk park or frontdesk fail, then send worker_done again." A frontman records with frontdesk ready, frontdesk park or frontdesk fail, so name those for a claim with `role=frontman`. If the terminal is gone, `frontdesk release <n> --reason stopped`. |
| `parked-worker` | `orca orchestration worker-release --dispatch <D>`. The worktree stays for the next attempt. |
| `looks-good` | `frontdesk merge <n>`. On a conflict or a failing check, dispatch a merge worker (Sonnet, low effort) into the request's worktree. |
| `auto-land` | `frontdesk merge <n>`. The request carries `land:auto` (or the project defaults to it) and no human has answered. The program merges when the merge, the check command and any required review pass. When one fails it posts one `frontdesk:autoland` comment naming the check and leaves the request at `stage:check`, which stops this code until the next result or a new push to the pull request. The coordinator never adds or removes `land:auto`. |
| `rejected` | `frontdesk reopen <n> --comment <comment id>`. |
| `conversation` | Forward the comment to the request's worker if it is live. Otherwise dispatch a reply-only worker (Sonnet, low effort): answer on the Issue, change no code, move no stage. |
| `merged` | `frontdesk land <n>`. |
| `check-red` | Send the request back to its worker if live, otherwise dispatch a merge worker (Sonnet, low effort). |
| `stray-worker` | `worker-stop`, then `worker-release`. |
| `bad-labels` | Change nothing. The digest reports it. The program does not guess which stage is right. |

`stage:backlog`, `stage:done` and `proposed` issues are ignored. A filed `stage:intake` request is handled by `intake`. A `stage:needs-you` issue with no worker needs nothing but the digest. A human, through `/decisions` or a label edit, moves a parked request back to `stage:ready`. The coordinator never does.

## Starting a worker

Read `reference/tokens.md` first. Then run the command below. The `dispatch` and `escalate` mismatches in `frontdesk reconcile --json` carry `workerStart`, the exact worktree arguments for the request, and the coordinator pastes them in unchanged. Only the model and effort come from routing.

```bash
orca orchestration worker-start \
  --spec "<brief>" --task-title "#<n> <issue title>" \
  --agent claude --model <model> --effort <effort> \
  <workerStart arguments> --json
```

Never choose the worktree flag yourself. `workerStart` is `--worktree path:<kept worktree>` when the request already has a worktree, because a parked request keeps its worktree for the next attempt and a second one would sit unused. Otherwise it is `--worktree new-child --name <n> --base-branch main`. For a worker on another machine it is `--on <environment> --worktree new-top-level --repo <selector>`, because Orca refuses `new-child` remotely. Orca rejects `--model` only with `--terminal`, never with an existing worktree, so the model and effort flags stay.

The task title must start with `#<n> `, because reconcile joins workers to issues by it.

Compare `launch.requested` with `launch.effective` in the receipt before reporting a model.

### The brief

The brief carries paths and identifiers, never file contents. It names:

- the issue number and the repository
- the machine name the worker passes to `frontdesk claim`
- the full path of `frontdesk`: `~/.claude/kit/modules/frontdesk/bin/frontdesk`
- the rule `.claude/rules/frontdesk.md`
- the ask setting, from the issue's `ask:*` label or the project default
- the review flag for `/ship`, and why (`reference/review.md`): `--code-review: touches apps/api/drizzle/migrations/**`, or `no review pass: 15 lines, not correctness-critical`
- for a reopened request, the id of the human's reason comment

A worker's first two steps are `frontdesk preflight --role worker --ping` and `frontdesk claim`. The brief does not repeat the rule. It points at it.

### The frontman's brief

The `intake` mismatch starts a frontman. It is routed already: Opus at high effort, the frontman row of `reference/routing.md`. Paste the mismatch's `workerStart` arguments in unchanged, as for `dispatch`.

```bash
orca orchestration worker-start \
  --spec "<frontman brief>" --task-title "#<n> <issue title>" \
  --agent claude --model opus --effort high \
  <workerStart arguments> --json
```

The brief carries paths and identifiers, never the Issue's words. It names:

- the issue number and the repository
- the machine name the frontman passes to `frontdesk claim`
- the full path of `frontdesk`: `~/.claude/kit/modules/frontdesk/bin/frontdesk`
- the rule `.claude/rules/frontdesk.md` and the reference `~/.claude/kit/modules/frontdesk/reference/frontman.md`, which hold the whole job
- the ask setting, from the issue's `ask:*` label or the project default
- the research line from `reference/tokens.md`

A frontman opens no pull request, so the brief has no review flag and no acceptance commands. One frontman run asks at most one card, and the next `intake` mismatch after Milky's answer starts a fresh one.

## When to read each reference file

| File | Read it |
|---|---|
| `reference/routing.md` | before every `worker-start`, when escalating, and when sending a follow-up to a live worker |
| `reference/review.md` | before writing any brief (the self-check list), when a pull request touches a review path, when choosing the review flag, and when a pull request merges or a worker is stopped |
| `reference/tokens.md` | before writing a brief, reusing a worker, or reading a worker's result |

## Machines and locks

- One coordinator per project, pinned to the machine named in `### Coordinator`. Preflight refuses any other machine and names the pinned one.
- A lock file stops a second coordinator on that machine. Preflight reads it, and treats a dead pid as free. A refusal names the Orca session holding it. Stop that session first.
- A worker whose preflight fails on a remote machine takes that machine out of rotation for the rest of this session.
- **Stopping the coordinator:** delete `~/.local/state/frontdesk/<owner>__<repo>/coordinator.lock`, then end the session.

## Pings

Two kinds go to the phone, through `frontdesk ping` and `frontdesk digest`: a decision is waiting, and a result is ready to check. Preflight failures and a silent machine also ping, because each one stops work until the human acts. A ping carries the project, the counts and a link. Never write an issue title or body into a ping.

## Rules

- **The Issue is the only truth.** Never act on a message, a `worker_done` body, or your own memory of an earlier pass. Run `frontdesk reconcile`.
- **Never decide a design question.** Park it as a card. A recommendation on a design card stays hidden.
- **Never merge by hand.** `frontdesk merge` is the one path. It needs a `looks good` comment newer than the result, or a `land:auto` request that nobody has answered.
- **Never change a label by hand** when a `frontdesk` command does it. The commands read back what they wrote. A hand edit does not.
- **Merge, never rebase. Never force push.**
