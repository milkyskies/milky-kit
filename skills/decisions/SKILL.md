---
name: decisions
description: >
  Answer every decision parked on `stage:needs-you`, one card at a time.
  Collects the queue with gh, shows each question as a card (background, then the
  question, then proposals), posts your answer as an issue comment, and moves the
  issue to `stage:ready`.
  TRIGGER when: the user says "/decisions", "what's waiting on me", "answer the
  decisions", or asks what the frontdesk is blocked on.
  DO NOT TRIGGER when: the user wants a list of open issues generally (use `gh issue list`),
  or wants to answer one specific issue they named (just comment on it).
argument-hint: "[issue number (optional, answers just that one)]"
---

# Decisions

Clear the decision queue.

`stage:needs-you` fills when an agent hits something it must not guess at, posts the question as an issue comment, and parks. Parked issues pile up silently, because a parked issue looks like nothing is happening. This skill gathers them, shows you each question as a card, and moves what you answer back to `stage:ready`. Ideas you filed undecided sit on `stage:backlog` with the `undecided` label and are not part of this queue.

**The inbox is a query, not a table.** Nothing is stored here. The queue is `gh issue list --label stage:needs-you`, the message body is the agent's comment, and your answer is a reply. Because the transport is GitHub, you can answer from the GitHub mobile app instead, and the next worker picks the issue up identically.

## Steps

### 1. Build the queue

```bash
gh issue list --label stage:needs-you --state open --json number,title
```

If `$ARGUMENTS` names an issue number, restrict to that one.

Empty queue: say "Nothing waiting on you" and stop. Do not prompt.

### 2. Read each question

```bash
gh issue view <num> --comments
```

Find the **last** comment containing `<!-- frontdesk:decision -->` and parse out the kind, the question, the numbered options, the recommendation or the hidden pick, and what the agent already checked. The protocol is in `.claude/rules/frontdesk.md`.

Three things to watch:

- **Latest wins.** An issue may have parked more than once. Only the newest decision block is live.
- **Malformed or missing marker.** Do not skip the issue. Fall back to presenting the last comment verbatim as free text and take a written answer.
- **No agent comment at all.** The user filed this one themselves. Read `## Open questions` from the body and present those as the questions. Numbered items become the proposals where they read as alternatives, free text otherwise. A self-filed issue has no recommendation or pick, and inventing one would answer it on the user's behalf.

An issue with several open questions yields several cards, one decision each.

### 3. Show one card, then ask

Present ONE card at a time, built the way `.claude/rules/cards.md` says: background, what the agent already checked, the question, then the proposals. Wait for the answer before showing the next.

For a code-detail card, put the agent's recommendation first among the proposals, marked `(Recommended)`.

For a design, product or pitch card, show no recommendation. Add one more option, "What would you pick?". When the user chooses it, show the agent's pick and its reason from the `<details>` block, then ask the same card again without that option.

Ask with `AskUserQuestion`: the proposals are the options, and the user can always choose "Other" to write a free-text answer. Where the agent gave no usable proposals, ask for free text instead. Keep the agent's own wording, since this skill relays the question and does not re-author it.

After the answer, say it back in one line ("Retry limit = 3. The other queues follow it") and move to the next card. For a proposal the user picked, the line is the `→` text the agent wrote after that option. For "Other", write it from the user's words.

### 4. Offer proposed bodies

If the issue also carries a `<!-- frontdesk:proposed-body -->` block, the agent parked because the spec was too thin and has drafted a replacement. Present it as **approve / edit / reject**:

- **Approve** — preserve the original first, then replace:
  ```bash
  gh issue comment <num> --body "Original body before the proposed rewrite:

  <original>"
  gh issue edit <num> --body-file <proposed>
  ```
  The issue keeps whatever labels it already had. Approving a body does not grant consent it did not have: if the issue has no `autopilot` label, add it only when the user says so, with `gh issue edit <num> --add-label autopilot`.
- **Edit** — take the user's changes, then approve as above.
- **Reject** — leave body and stage untouched.

Never replace a body without preserving the original in a comment first. Never alter `## Problem`; if the proposal changed it, that is a bug in the worker and the proposal should be rejected.

### 5. Record the answer

For each answered card:

```bash
~/.claude/kit/modules/frontdesk/bin/frontdesk answer <num> --card <card id> --body <file> --decision "<one line>"
```

The card id is the `card=` attribute on the card's `<!-- frontdesk:decision -->` marker. A card from before card ids has none, and then `--card` is left out.

`frontdesk answer` posts the answer with no agent marker, appends `- <date>: <decision>` to the body's `## Decisions` section, and reads the issue back to confirm. While another card of the same park is open, the issue stays on `stage:needs-you`. After the last card it moves the stage to `stage:ready` (`stage:intake` when a frontman parked it) and releases the parked claim with `frontdesk:release reason=answered`. It writes the comment first, so a failed stage move leaves the answer on the issue; a non-zero exit means the state is not what was meant, so report the stderr line and stop. The one-line decision is the user's answer said back, in their words.

A **self-filed** issue answered this way reaches `stage:ready` still carrying only `## Problem` and the answered question: no acceptance criteria, no tests, and no `autopilot` label, so no agent claims it. Say so, and offer `/todo` to write the spec now that the fork is resolved.

Skipped issues are left untouched: still `stage:needs-you`, no comment.

### 6. Report

Say what was answered and what remains. If anything moved to `stage:ready`, say the next worker will pick it up.

## Rules

- **Never answer on the user's behalf.** If a decision looks obvious, it is still theirs. The agent parked precisely because it was not the agent's call.
- **One card at a time.** The card rules are in `.claude/rules/cards.md`.
- **Never edit the issue body here** except through the approved proposed-body flow in step 4. `frontdesk answer` appends to `## Decisions` and edits nothing else.
- **A human moves the stage.** Never let an agent requeue itself; it would consume a half-written reply.
- **Skipping is free.** An unanswered decision stays parked.
