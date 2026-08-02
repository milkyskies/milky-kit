# Autopilot

Rules for autonomous agents that pick work off the board and drive it to a draft PR, and for the humans answering them. Applies only in projects that have opted into autopilot; if no issue carries the `autopilot` label, none of this fires.

## State lives in glb, nowhere else

The board is the state machine. There is no runs database, no local state file, no separate inbox.

```
Todo ──claim──> In Progress ──draft PR──> In Review ──merged──> Done
  ▲                  │                        │
  │                  └────────┬───────────────┘
  │                           ▼
  └──── you answer ──── Needs Decision
```

**Only store a state in glb if it is not derivable from GitHub.** `Needs Decision` is not derivable, so it lives in glb. "CI is red", "has unaddressed review comments", "merge conflict" all come from `gh pr view` and must never become statuses.

The payoff for keeping the transport on GitHub is that the mobile app is a free second client: a decision can be answered from a phone, and the dispatcher picks it up unchanged.

## Eligibility is opt-in

An agent may only claim an issue that carries the `autopilot` label **and** has non-empty `## Acceptance criteria` and `## Tests` sections. See `glb.md`. Forgetting the label means an agent leaves the issue alone.

An ineligible issue is skipped, never parked. It was never claimed, so its status is not the agent's to change.

## Read the comments before the body

Design decisions, spec changes, and human answers arrive as **comments**, not body edits. Before implementing:

1. `gh issue view <num> --repo <owner>/<repo> --comments`
2. **The latest comment wins.** Older instructions are superseded, not merged.
3. If the issue was previously `Needs Decision`, the human's answer is in the comments. Follow it.

## When to stop and ask

Stop only for these. Everything else is yours to decide, and an agent that asks about ordinary design choices is useless.

1. The issue's requirements contradict each other or are too vague to implement.
2. A breaking change to an API or database schema the issue never mentioned.
3. The work turns out to be far outside the issue's stated scope.
4. A security or data-integrity decision the issue did not anticipate.

Plus one mechanical stop: **three failed attempts.** Park with a comment listing what was tried and why each failed, rather than burning a night's tokens on one impossible issue.

## Mark every comment you post

Every comment an agent writes ends with:

```markdown
<!-- autopilot:agent -->
```

The bookkeeping workflow uses this to tell an agent's comment from a human's. Recognising the agent by comment author would break the moment the token changes — a PAT, `GITHUB_TOKEN`, and a GitHub App all report different identities, and a configuration detail must not be able to break the resume loop.

Miss the marker and the workflow treats the agent's own question as a human answer, requeueing the issue immediately and burning an attempt.

## The decision comment protocol

When stopping, post a comment in exactly this shape. The marker is what `/decisions` parses.

```markdown
<!-- autopilot:decision -->
## Decision needed

<the question, in one or two sentences>

**Options:**
1. <option> - <consequence>
2. <option> - <consequence>

**Recommendation:** <n>

_Stopped at: <what you were doing>. Reply in a comment and I will pick it up._

<!-- autopilot:agent -->
```

Then `glb update <num> --status "Needs Decision"` and exit. Leave the worktree in place; the next attempt resumes in it.

**Always offer numbered options.** A question with concrete options is answered with one keypress; a question in prose costs a paragraph. If you genuinely cannot enumerate options, say so explicitly rather than padding the list with filler.

## Propose the issue you needed

When you park because the issue was **underspecified** — stop reason 1, not the other three — also post the body you would have needed. By the time you decided to stop you already know which acceptance criteria were missing and which behaviours were ambiguous; making a human reconstruct that is waste.

```markdown
<!-- autopilot:proposed-body -->
## Proposed issue body

<the full replacement body>

<!-- autopilot:agent -->
```

Rules for the proposal:

- **Carry `## Problem` through unchanged, byte for byte.** Intent is the human's; only the mechanics are yours to draft.
- Fill in `## Acceptance criteria` and `## Tests` concretely enough to satisfy the eligibility gate.
- Resolve the ambiguity into explicit numbered options rather than prose.
- Do not post one for the other three stop reasons. A security decision needs an answer, not a rewritten spec.

This is the fastest route from a human-only issue to an autopilot-eligible one: the agent drafts the spec, a human approves it. Issue quality improves as a side effect of running the system rather than as separate discipline.

## Answering

Either run `/decisions`, or reply directly on GitHub. Both routes end the same way: a comment on the issue and the status back to `Todo`.

If the project installs the bookkeeping workflow (`modules/autopilot/scaffold/.github/workflows/`), replying on GitHub is enough — the workflow flips the status server-side, so an answer written on a phone is queued before you next open the laptop. Without it, flip the status yourself.

**A human flips the status, never the agent.** If the agent re-checked on its own it would consume a half-written reply and burn an attempt.

## Two gates stay human, always

- **Draft to ready-for-review.** That is the review.
- **Merge.**

`/land` after merge is automatic. Nothing else about the PR is.
