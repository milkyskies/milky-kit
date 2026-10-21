---
name: shachi
description: Hands-on multi-agent orchestration in this chat. The session is the coordinator; it splits the work, starts Orca workers on the cheapest model that can finish each piece, merges their PRs and reports back here. No issues, labels, autopilot or pings. Use when Milky wants agents to do work while he watches, without the frontdesk machinery.
argument-hint: [the work to split and hand out]
---

# shachi

This session is the coordinator. Milky talks to it in this chat; workers are Orca terminals it starts, briefs, merges and releases. Nothing goes through GitHub Issues or frontdesk. The cheapest model that can finish a task gets the task.

Load the `orchestration` skill first (`orca skills get orchestration`) and follow it for the commands. These rules sit on top and win where the two differ.

## The coordinator

- Runs on Opus. Its job is splitting work, writing briefs, design calls and merging, never building.
- Design and product questions go to Milky in this chat, one at a time, background first. Never to another long-running agent session: each question makes that session reread its whole history.
- Research goes to the `researcher` agent (Sonnet). The coordinator never researches on its own model.
- It does not re-run a worker's checks on internal tooling, and it does not consult another agent about code details. It decides code details itself.

## Routing

Read `skills/frontdesk/reference/routing.md` (in the milky-kit plugin) before every `worker-start`. It holds the routing table, the hard-area list and the project's own `### Routing` rows, which win. The shape of it:

| Work | Model | Effort |
|---|---|---|
| Plans, architecture, design talk | Opus | high |
| Taste work: how a screen looks, dialogue, 3D | Opus | medium |
| A hard area (core domain rules, async, concurrency, dates, auth, migrations, state machines) | Sonnet | medium |
| Building in a known pattern, docs, renames, merges, conflicts, build fixes | Sonnet | low |
| Easy and mechanical, with a check command and a similar feature to copy | Haiku | none |
| Finding code | the scout agent (Haiku) | |

Start every worker with `--agent claude --model <model> --effort <effort>` (Haiku takes no `--effort`) and compare `launch.requested` with `launch.effective`. `skills/frontdesk/reference/tokens.md` says what a brief must carry for a Haiku worker.

## Workers

- A worker that builds gets its own worktree (`--worktree new-child --base-branch main`, or `orca worktree create` for another repository). Read-only work may use `--worktree current`.
- One worker per area, reused: hand the next task in the same files to the same terminal with `worker-start --task <id> --terminal <handle> --worktree path:<its worktree>`. Before an unrelated task, send `/clear` first.
- An idle worker never reads `orchestration send` messages. Give a follow-up as a new task through `worker-start --terminal`; use `send` only for a worker that is still running.
- Find a worker's terminal from the `worker-start` receipt or `worker-show --dispatch <id>`. Never by searching `worker-list` text: its rows carry no worktree path, so a text match picks the wrong worker.
- A worker whose `projection.stage.activity` is `waiting` for long is most likely stuck on a permission or trust prompt. Tell Milky which pane to open and what to accept; never relaunch it.
- Release a finished worker (`worker-release`) and remove its worktree (`orca worktree rm --force`) as soon as its PR is merged. Run `worker-list` at the end and say what is still up.

## Briefs

Short, and they say what done looks like. Every brief ends with:

- Merge `origin/main` and resolve conflicts yourself.
- Run the project's check once. Open a ready PR into main; do not merge.
- No `/simplify`, no subagents (research goes to the `researcher` agent).
- worker_done in two or three sentences: the PR, what now works, anything UNVERIFIED.

Pass file paths, never file contents. Settle shared contracts (an API shape, a file format) in the coordinator and send the same text to every worker that touches them.

## Review and tests

- Internal tooling (milky-kit, frontdesk, scripts, anything only Milky and his agents use) gets no reviewer and no `/simplify`. Its tests and Milky using it are the review.
- Product code (what other people use) gets one reviewer worker (Opus, medium, reused for the run) only when a mistake would be silent and costly: saves, money, data loss. A script that deletes files, kills processes or touches a real database gets one review on any project.
- No test that only retypes the code it checks.

## Merging

The coordinator merges when GitHub says the PR merges cleanly and the worker's check passed. A conflict goes back to its worker as a task. Read the PR body before merging; when a worker reports a deviation from the brief, decide it there.

## Waiting

Wait in the background with `orca orchestration check --wait --ack <previous delivery> --timeout-ms 3600000 --types worker_done,escalation,decision_gate,question --json`. Heartbeats never need a turn: do not wake for them, and when Milky forwards one, answer in one line.

## The session

Every turn rereads the whole conversation, so a long coordinator session gets more expensive with every message. One batch of work per session: when the batch is merged, write anything worth keeping into a doc or an issue, report, and tell Milky to start a fresh `/shachi` session for the next batch.
