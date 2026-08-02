---
name: decisions
description: >
  Answer every autopilot decision parked on `Needs Decision` in one sitting.
  Collects the queue from glb, presents each agent's question with its own proposed
  options, posts your answer as an issue comment, and requeues the issue to Todo.
  TRIGGER when: the user says "/decisions", "what's waiting on me", "answer the
  decisions", or asks what autopilot is blocked on.
  DO NOT TRIGGER when: the user wants a list of open issues generally (use `glb list`),
  or wants to answer one specific issue they named (just comment on it).
argument-hint: "[issue number (optional, answers just that one)]"
---

# Decisions

Clear the autopilot decision queue.

When an agent hits something it must not guess at, it posts a question as an issue comment and parks the issue on `Needs Decision`. Those pile up silently — a parked issue looks like nothing is happening. This gathers them, asks you each question with the options the agent proposed, and requeues what you answer.

**The inbox is a query, not a table.** Nothing is stored here. The queue is `glb list --status "Needs Decision"`, the message body is the agent's comment, and your answer is a reply. That is deliberate: because the transport is GitHub, you can answer these from the GitHub mobile app instead, and the dispatcher picks them up identically.

## Steps

### 1. Build the queue

```bash
glb list --status "Needs Decision"
```

If `$ARGUMENTS` names an issue number, restrict to that one.

Empty queue: say "Nothing waiting on you" and stop. Do not prompt.

### 2. Read each agent's question

```bash
gh issue view <num> --comments
```

Find the **last** comment containing `<!-- autopilot:decision -->` and parse out the question, the numbered options, and the recommendation. The protocol is in `.claude/rules/autopilot.md`.

Two things to watch:

- **Latest wins.** An issue may have parked more than once. Only the newest decision block is live.
- **Malformed or missing marker.** Do not skip the issue. Fall back to presenting the last comment verbatim as free text and take a written answer.

### 3. Ask

Batch into `AskUserQuestion`, **four questions per call**, chunking until the queue is exhausted. Never silently drop the remainder.

For each: the agent's question is the question, its numbered options are the options, and its recommendation goes first with `(Recommended)` appended. Keep the agent's own wording — you are relaying, not re-authoring.

Where the agent gave no usable options, ask for free text instead.

### 4. Record the answer

For each answered issue:

```bash
gh issue comment <num> --body "<the answer>"
glb update <num> --status Todo
```

Comment first, then flip. If the flip fails, the answer is still on the issue and the next run finds it; the reverse would requeue an issue whose answer was lost.

Skipped issues are left untouched — still `Needs Decision`, no comment.

### 5. Report

Say what was answered and what remains. If anything was requeued, name the next dispatcher wake as when it will be picked up.

## Notification

When running inside herdr (`HERDR_ENV=1`), ping when the queue is non-empty:

```bash
herdr notification show "3 decisions waiting" --sound request
```

Guard on `HERDR_ENV`; outside herdr the command is not available.

## Rules

- **Never answer on the user's behalf.** If a decision looks obvious, it is still theirs. The agent parked precisely because it was not the agent's call.
- **Never edit the issue body here.** Rewriting an underspecified issue is a separate flow with its own approval step.
- **A human flips the status.** Never let an agent requeue itself; it would consume a half-written reply.
- **Skipping is free.** An unanswered decision stays parked and costs nothing.
