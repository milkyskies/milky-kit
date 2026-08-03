---
name: todo
description: >
  File an autopilot-ready issue from one rough sentence. Drafts the house body format,
  asks only what cannot be inferred, shows it for approval, then creates it with the
  `autopilot` label.
  TRIGGER when: the user says "/todo", "make an issue for...", "file a task", "add a todo",
  or describes work they want tracked rather than done now.
  DO NOT TRIGGER when: the user wants the work done immediately (just do it), or is asking
  what is already on the board (`glb list`, `glb ready`).
argument-hint: "<rough description> [--no-autopilot]"
---

# Todo

Turn a sentence into a filed issue an agent can pick up cold.

The point is the **shape**, not the saved typing. An issue in the house format can be claimed by a worker who was not part of this conversation; one that just restates the sentence gets claimed, read, and parked on `Needs Decision` — which works, but costs a whole agent spawn to discover the spec was thin.

## Steps

### 1. Infer before asking

Read the code for whatever area the sentence names. Look at how similar things are already built, what tests exist near them, what would have to change.

Draft all four sections from that. Most of what a questionnaire would ask is answerable by looking:

- **`## Problem`** — what is missing today and why it matters. A concrete scenario beats an abstract description.
- **`## What this issue does`** — the mechanics, broken into named sub-behaviours.
- **`## Acceptance criteria`** — checkable outcomes.
- **`## Tests`** — the tests that verify it, named against the tiers in `testing.md`.
- **`## Area`** — the path globs this issue will touch, one per line.

`## Area` exists because autopilot picks an implementation tier **before** the work exists, so it cannot inspect a diff. You are reading the code right now, which makes this the only honest moment to record it. Match the granularity of the project's `## Implementation tiers` table in `CLAUDE.md` so the two line up:

```markdown
## Area
- apps/api/src/domain/balloon/**
- packages/adoba_core/lib/src/balloon/**
```

If the project declares no tier table, still write it — it tells a human where to look, and the table may arrive later.

### 2. Ask only about genuine forks

A question is worth asking when two plausible designs exist, a scope boundary is unclear, or a behaviour has no obvious correct answer. Batch them into one `AskUserQuestion` with your recommendation first.

**Do not ask what you can read.** Which file it lives in, what the existing pattern is, whether there is a test helper — go look.

**Never invent acceptance criteria.** If the sentence genuinely does not determine what "done" means, ask. A fabricated criterion is worse than a missing one: a worker will implement against it and hand back the wrong thing having satisfied every box.

### 3. Assign points and priority

**Set both. Do not ask.** State the reasoning in one line each so a wrong call is cheap to correct — a number you can argue with beats a question you have to answer.

**Points — you can estimate this, so do.** You just read the code: you know how many files, how many layers, and whether a pattern exists to copy. Fibonacci per `glb.md`:

| | |
|---|---|
| `1` | one function in one file, test already exists beside it |
| `2` | a few files in one layer, pattern to follow |
| `3` | crosses layers, needs new tests |
| `5` | a day; touches several areas or has no pattern to copy |
| `8` | several days |
| `13` | too big — say so and propose the split rather than filing it |

**Priority — you mostly cannot know this, so default it.** Urgency is about what the user needs next week, which is not in the code. Use **P2** unless their sentence actually says otherwise:

- **P0** — they said broken, crashing, losing data, or a security hole
- **P1** — they said it blocks something, or named a deadline
- **P2** — everything else. This is the honest answer most of the time.
- **P3/P4** — they said someday, eventually, or nice to have

Do not infer urgency from how the work sounds. A migration is not P0 because migrations feel serious; it is P0 if something is broken right now.

### 4. Pick the type label

One of these, always exactly one:

| Label | When |
|---|---|
| `type:feature` | new capability; nothing there before |
| `type:change` | an existing feature behaves differently |
| `type:fix` | broken; restore intended behaviour |
| `type:chore` | deps, CI, tooling, config |
| `type:docs` | documentation only |
| `type:refactor` | internals move, behaviour identical |

The line between `feature` and `change` is **"did this exist yesterday?"** — not how big the work is. A new balloon type is `feature`; balloons expiring differently is `change`.

Do not label an epic. An issue is an epic if it has sub-issues, which GitHub already knows and renders — a label would be a second source of truth that can drift from the actual list.

If the project has no `type:*` labels, skip this rather than inventing them.

### 5. Show it, then file

Print the full body and wait. Never file silently — the user is the only one who knows whether the framing is right.

```bash
glb create --autopilot --title "<title>" --body "$(cat /tmp/todo-body.md)" \
  --priority P2 --points 3 --status Todo --label "type:change"
```

`--no-autopilot` in `$ARGUMENTS` drops the flag and files it human-only.

**No em or en dashes in the title** — `glb create` rejects them. Use a hyphen or a colon.

### 6. Confirm it will actually be picked up

```bash
glb ready --autopilot --explain
```

Report the issue number and the line the new issue appears on. If it is in the skipped list, say why — usually a blocker or a status other than `Todo`.

## Rules

- **One sentence in, one issue out.** If the description covers several separable pieces of work, say so and propose splitting it rather than filing one vague issue.
- **Never ask for points or priority.** Assign them and show your reasoning. Asking hands back a decision the user came here to avoid making.
- **Carry the user's framing.** `## Problem` is theirs; the mechanics are yours to draft. Do not rewrite their intent into what you would have asked for.
- **Do not implement anything.** This files an issue. If they wanted the work done, they would have asked for the work.
