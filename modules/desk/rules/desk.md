# Desk worker contract

A worker takes one issue to a pull request and records every outcome on the issue before sending `worker_done`. The issue is the only record. The program is `~/.claude/kit/modules/desk/bin/desk`, written below as `desk`. A non-zero exit means the write failed: read the stderr line.

## The sequence

1. `desk preflight --role worker --ping`. On failure claim nothing: send `escalation` with the output, then `worker_done --outcome failed`.
2. `desk claim <n> --machine <machine> --task <task id> --dispatch <dispatch id>`. On exit 1 another worker owns the issue: stop and send `worker_done --outcome failed`.
3. `gh issue view <n> --comments`. The latest comment wins. A human answer after a decision card is the answer to follow.
4. Work. Pass file paths, never file contents.
5. Record as you go. `desk note <n> --dispatch <dispatch id> "Auto-decided: X over Y because Z"` for a call you made. `desk propose --from <n> --title "<title>" --type <type> --body <file>` for a side topic, which is never fixed on the side.
6. Run `desk status <n>` before every push. If the newest claim is no longer yours, stop.
7. Merge `origin/main` and fix conflicts. Visual work gets a screenshot you look at, uploaded with `desk picture <n> <file>`.
8. End with exactly one command, then send `worker_done` with a body like `#12 → stage:check`:
   - `desk done <n> --dispatch <dispatch id> --pr <number> --summary "<one sentence>" --checked "<text>" (--picture <url>… | --no-picture "<why>") [--see "<how to see it>"]`
   - `desk park <n> --dispatch <dispatch id> --card <file> [--card <file>…] [--proposed-body <file>]`
   - `desk fail <n> --dispatch <dispatch id> --reason <file>`

`--checked` is your statement that nothing you used was removed upstream and nothing contradicts `## Decisions`. The pull request must be open, not a draft, with `closes #<n>` as its first line.

Before running `desk park`, read `~/.claude/kit/modules/desk/reference/parking.md`.

## The ask setting

The issue's `ask:*` label, or the project default, decides what you ask. `ask:everything`: every unclear point becomes a card. `ask:choices`: code details are yours, design and product become cards. `ask:own-feel`: everything is yours. Log every call you make with `desk note`.

Never yours, whatever the setting: merges, deletes, force pushes, repository settings, work outside the issue's scope.

## When to stop and ask

Park only when:

1. The requirements contradict each other or are too vague to implement.
2. A breaking API or schema change was never mentioned.
3. The work is far outside the issue's scope.
4. A security or data-integrity decision was not anticipated.

Three failed attempts at one thing: `desk fail`, listing what was tried.

## Marking comments

A comment you write by hand with `gh` ends with `<!-- desk:agent -->`. Without it the comment reads as a human answer and requeues the issue.

## The human moves the stage

A worker never requeues its own parked issue. `desk answer` does, run by `/decisions` or the human. Merging is the human's gate.
