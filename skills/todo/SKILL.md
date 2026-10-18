---
name: todo
description: >
  File an issue from one rough sentence. Drafts the house body format, asks only what
  cannot be inferred, shows it for approval, then creates it with the `autopilot` label.
  Something the user has not decided yet gets filed as `stage:backlog` plus `undecided`
  with the open question instead of a fake spec. Running it on an `undecided` issue
  graduates it.
  TRIGGER when: the user says "/todo", "make an issue for...", "file a task", "add a todo",
  or describes work they want tracked rather than done now.
  DO NOT TRIGGER when: the user wants the work done immediately (just do it), or is asking
  what is already open (`gh issue list --label stage:ready`).
argument-hint: "<rough description> [--no-autopilot]"
---

# Todo

Turn a sentence into a filed issue an agent can pick up cold.

The point is the **shape**, not the saved typing. An issue in the house format can be claimed by a worker who was not part of this conversation; one that just restates the sentence gets claimed, read, and parked on `stage:needs-you` — which works, but costs a whole agent spawn to discover the spec was thin.

`issues.md` owns the formats, the labels, the points scale, the priority scale, and the type labels. This skill owns the procedure. Where the two ever disagree, `issues.md` wins.

## Steps

### 1. Decide which of the two things this is

**An existing `undecided` issue** — `$ARGUMENTS` names one, or the user points at one. Graduate it: read the issue and the answers so far, draft the task sections from `issues.md` (steps 2 to 4), show the body, then on approval edit the body and run `gh issue edit <n> --remove-label undecided,stage:backlog --add-label stage:ready,autopilot,points:<k>,type:<t>`. If an open question is still unresolved, say so and leave it undecided.

**A task** — the user knows what they want built, even roughly. Goes to step 2.

**An undecided thing** — an idea, an unresolved fork, a half-thought. Goes to the "Filing something you have not decided" skeleton in `issues.md`: `## Problem` plus `## Open questions`, filed with the `stage:backlog` and `undecided` labels, no points, no `autopilot` label, no acceptance criteria.

The tell is whether you can write a binary acceptance criterion without inventing the decision behind it. If every criterion you draft depends on a fork the user has not resolved, it is undecided — file it as one, and say so in a line. Do not resolve the fork on their behalf and file a task.

Filing an undecided thing costs nothing later: running `/todo` on the issue after the question is answered graduates it into a normal issue.

### 2. Infer before asking

Read the code for whatever area the sentence names. Look at how similar things are already built, what tests exist near them, what would have to change.

Draft the sections from `issues.md` off that reading. Most of what a questionnaire would ask is answerable by looking. Three of them can only be written well right now, while the code is in front of you:

- **`## Area`** — the path globs this will touch. The frontdesk coordinator routes before the work exists, so it cannot inspect a diff. Match the granularity of the project's `### Hard areas` and `### Review paths` in the `## frontdesk` section of `CLAUDE.md`.
- **`## Out of scope`** — the neighbouring code an executor would plausibly wander into. You just saw what sits next to the change; name it here.
- **`## Reference points`** — the analogous implementations you read to draft this, each with one line on what to take. You already opened these files. Writing the paths down costs nothing and does more for idiomatic output than a paragraph of description.

### 3. Ask only about genuine forks

A question is worth asking when two plausible designs exist, a scope boundary is unclear, or a behaviour has no obvious correct answer. Batch them into one `AskUserQuestion` with your recommendation first.

**Do not ask what you can read.** Which file it lives in, what the existing pattern is, whether there is a test helper — go look.

**Never invent acceptance criteria.** If the sentence genuinely does not determine what "done" means, that is step 1's answer, not a gap to paper over. A fabricated criterion is worse than a missing one: a worker will implement against it and hand back the wrong thing having satisfied every box.

### 4. Assign points, priority, and a type label

**Set all three. Do not ask.** The scales live in `issues.md` — points, priorities, and the `type:*` table. State your reasoning in one line each so a wrong call is cheap to correct: a number you can argue with beats a question you have to answer.

You just read the code, so the points estimate is yours to make. Priority is not in the code, so default to `priority:P2` unless the user's sentence says otherwise.

If the project has no `type:*` labels yet, run `.github/scripts/setup-labels.sh` or skip the label rather than inventing names.

### 5. Show it, then file

Print the full body and wait. Never file silently — the user is the only one who knows whether the framing is right.

```bash
# A task
gh issue create --title "<title>" --body-file /tmp/todo-body.md \
  --label request,stage:ready,priority:P2,points:3,type:change,autopilot

# An undecided thing
gh issue create --title "<title>" --body-file /tmp/todo-body.md \
  --label request,stage:backlog,undecided,priority:P2
```

Every issue carries exactly one label from each group: kind, stage, priority, and type. A task also carries points. Add an `ask:*` label only when the user named one.

`--no-autopilot` in `$ARGUMENTS` drops the `autopilot` label and files the task human-only.

**No em or en dashes in the title.** Use a hyphen or a colon.

### 6. Confirm it will actually be picked up

Tasks only. An undecided issue is meant to sit out of the queue, so skip this for one.

```bash
gh issue list --label stage:ready --label autopilot
```

Report the issue number and whether it appears in the list. If it is missing, say why — usually a missing label.

## Rules

- **One issue per separable piece of work.** Several pieces in one description means several issues — not one vague issue, and not one issue with the rest withheld. An epic filed with one child understates its own plan and cannot be sequenced.
- **Never ask for points or priority.** Assign them and show your reasoning. Asking hands back a decision the user came here to avoid making.
- **Carry the user's framing.** `## Problem` is theirs; the mechanics are yours to draft. Do not rewrite their intent into what you would have asked for.
- **An unresolved fork is filed, not guessed.** Step 1 exists so a half-decided thought gets recorded as a question rather than laundered into a spec.
- **Do not implement anything.** This files an issue. If they wanted the work done, they would have asked for the work.
