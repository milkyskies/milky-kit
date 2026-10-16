# Desk worker contract

This file binds every worker the desk coordinator dispatches. A worker takes one issue from `stage:ready` to a pull request, and records every outcome on the issue before it sends `worker_done`. The issue is the only record. Orca's mailbox is a doorbell.

The state commands live in one program. Its full path is `~/.claude/kit/modules/desk/bin/desk`, written below as `desk`. Every command that changes state reads the issue back afterwards and exits non-zero when the second read disagrees. A non-zero exit means the write did not happen as intended: read the stderr line, which names the fix, and never report success past it.

The issue labels, stages and body template are in `issues.md`. The card format is in `cards.md`.

## The sequence

1. **Preflight.** Run `desk preflight --role worker --ping`. On failure, claim nothing: send `escalation` with the output, then `worker_done --outcome failed`.
2. **Claim.** Run `desk claim <n> --machine <machine> --task <task id> --dispatch <dispatch id>`. The brief names the machine. The task and dispatch ids are in your preamble. On exit 1 another worker owns the issue: stop, and send `worker_done --outcome failed` saying the claim was refused.
3. **Read the issue and its comments.** Run `gh issue view <n> --comments`. The latest comment wins, and older instructions are superseded, not merged. A human answer after a `desk:decision` comment is the answer to follow. A `desk:reopen` comment quotes the reason the last attempt was sent back, and the brief names it.
4. **Work.** Find a similar existing implementation in each layer you touch and follow its patterns. Pass file paths between agents and in briefs, never file contents.
5. **Record small calls and side topics as they happen.**
   - A call you decided yourself goes in at once: `desk note <n> --dispatch <dispatch id> "Auto-decided: X over Y because Z"`.
   - A side topic you found is never fixed on the side. File it: `desk propose --from <n> --title "<title>" --type <type> --body <file>`.
6. **Check the claim before every push.** Run `desk status <n>` right before `git push`. If the newest claim is no longer yours, stop. The coordinator handed the issue to another worker while you were cut off, and a push would overwrite that worker's branch.
7. **Check yourself before done.**
   - Merge `origin/main` and fix the conflicts.
   - Confirm nothing you used was removed upstream.
   - Confirm nothing contradicts the issue's `## Decisions`.
   - For visual work, render or screenshot the result, look at it, and upload it with `desk picture <n> <file>`.
8. **End the attempt with exactly one of three commands**, then send `worker_done`:

   | Outcome | Command |
   |---|---|
   | Built, pull request ready | `desk done <n> --dispatch <dispatch id> --pr <number> --summary "<one sentence>" (--picture <url>… \| --no-picture "<why>") [--see "<how to see it>"]` |
   | Needs a decision | `desk park <n> --dispatch <dispatch id> --card <file> [--card <file>…] [--proposed-body <file>]` |
   | Could not finish | `desk fail <n> --dispatch <dispatch id> --reason <file>` |

   The pull request must be open, not a draft, with `closes #<n>` as the first line of its body. Mark it ready yourself. `desk done` refuses otherwise.

   The `worker_done` body names the issue and the stage it moved to, for example `#12 → stage:check`. The coordinator reads the issue, not the body.

Visual work always has a picture. `--no-picture` is for work with nothing to see.

## What the setting allows

The issue's `ask:*` label, or the project default in `CLAUDE.md`, decides what you ask.

| Setting | Behaviour |
|---|---|
| `ask:everything` | Every unclear point becomes a card. |
| `ask:choices` | Code details (naming, refactor shape) are yours, logged with `desk note`. Design and product become cards. |
| `ask:own-feel` | Everything is yours, logged with `desk note`. |

Whatever the setting, these are never yours to decide: merges, deletes, force pushes, repository settings, and work outside the issue's scope.

## When to stop and ask

Stop only for these. Everything else is yours to decide, and a worker that asks about ordinary design choices is useless.

1. The issue's requirements contradict each other or are too vague to implement.
2. A breaking change to an API or database schema the issue never mentioned.
3. The work turns out to be far outside the issue's stated scope.
4. A security or data-integrity decision the issue did not anticipate.

Stopping means `desk park`. A fifth reason exists, and it is mechanical: three failed attempts at one thing. Stop with `desk fail`, listing what was tried and why each try failed, rather than burning a night's tokens on one impossible issue.

## The decision comment

A card is one decision. Two decisions on one issue are two card files. Write each card as a file with this shape, markers included, and pass it to `desk park`. The program validates the shape before it posts anything and names the missing part.

```markdown
<!-- desk:decision -->
## Decision needed

**Kind:** <code-detail | design>

<background: the facts the reader needs, so no other page has to be opened>

**Already checked:** <one line: what you searched or read, so the reader does not repeat it>

**Question:** <the one decision, in one or two sentences>

**Options:**
1. 提案 <option written out in full> - <consequence>
2. 提案 <option written out in full> - <consequence>

**Recommendation:** <the recommended option, written out in full>

_Stopped at: <what you were doing>. Reply in a comment and I will pick it up._

<!-- desk:agent -->
```

The **Kind** line is mandatory, and it decides the recommendation.

- **code-detail** (a name, a retry count, which library function): keep the **Recommendation** line, with one recommended option.
- **design** (a design, product or pitch call): drop the **Recommendation** line. Put the pick in a collapsed block instead, so GitHub hides it until tapped:

  ```markdown
  <details><summary>What would I pick?</summary>

  <the picked option, written out, and the reason>

  </details>
  ```

  A pick shown up front anchors the human, and a design call is theirs to make unanchored. You still write a pick on every design card.

Options are numbered, each one is marked 提案 so no proposal reads as a settled call, and each is written out in full. Nobody refers to an option by its number or a letter. If you genuinely cannot enumerate options, say so in one line instead of padding the list.

### Propose the issue you needed

When you park because the issue was underspecified (stop reason 1 only), also pass `--proposed-body <file>` with the body you would have needed:

```markdown
<!-- desk:proposed-body -->
## Proposed issue body

<the full replacement body>

<!-- desk:agent -->
```

- Carry `## Problem` through unchanged, byte for byte. Intent is the human's; only the mechanics are yours to draft.
- Fill in `## Acceptance criteria` and `## Tests` concretely enough that the next attempt can finish without asking again.
- Resolve the ambiguity into explicit numbered options.
- Post none for the other three stop reasons. A security decision needs an answer, not a rewritten spec.

## Marking comments

Every comment that carries a state transition is written by the program and ends with `<!-- desk:agent -->`. Any comment you write by hand with `gh` ends with the same line. The coordinator tells a worker's comment from a human's by that marker alone, because workers post under the human's own `gh` login. A hand-written comment without the marker reads as a human answer and requeues the issue.

## The human moves the stage

A worker never requeues its own parked issue. `desk answer` does that, run by `/decisions` or the human. Merging is the one gate and it is the human's: a change reaches `main` only because a person said `looks good`.
