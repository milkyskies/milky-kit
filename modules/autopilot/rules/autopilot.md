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

An agent may only claim an issue that carries the `autopilot` label. That label is the whole gate. See `glb.md`. Forgetting it means an agent leaves the issue alone.

The label answers one question - may this run unattended - and it is the only question a tracker can answer without reading. **Whether the issue says enough to finish is the agent's call, made while reading it**, and the answer goes in a decision comment rather than a filter. An issue too thin to implement is claimed, read, and parked on `Needs Decision` with the question and a proposed body. A human then gets a draft spec back instead of an issue that silently never ran.

An ineligible issue is skipped, never parked. It was never claimed, so its status is not the agent's to change.

## The area table

Two decisions — which model implements an issue, and whether its diff earns a review pass — take the same input: **what part of the codebase it touches.**

Where a similar implementation already exists, the work is pattern-matching. A cheap model does that well, and a simplify pass finds nothing in it. Where the agent must design — domain rules, a schema change, a money path — that is judgement, which is what the expensive model and the review pass are both for.

The kit owns the shape; **the contents are the project's**. "Netcode" is meaningless in a Flutter API and "drizzle migrations" is meaningless in a Godot game. Each project declares its own in `CLAUDE.md`:

```markdown
## Implementation tiers

Opus:
- apps/api/drizzle/migrations/**    irreversible
- apps/api/src/domain/**            business rules; nothing to copy
- apps/api/src/**/auth/**           expensive when wrong

Sonnet:
- apps/mobile/lib/features/**/ui/**  widget layout; heavily patterned
- packages/*/lib/src/**              pure functions with existing tests

Haiku:
- docs/**, locale/**, config, version bumps

## Correctness-critical paths

Always get the review pass, whatever the diff size.

- apps/api/drizzle/migrations/**
- apps/api/src/**/auth/**
```

A project that declares neither routes everything to Sonnet with no review pass, and still works.

### Routing order

1. **`needs:opus` label** — the human who filed it knows
2. **P0**
3. **Area matches the table** — use that tier
4. **No match** — Sonnet
5. **Failed *or parked*** — escalate one tier and retry

Step 5 is a backstop, not the plan. Starting everything cheap and escalating sounds efficient and is not: some work should never get a cheap first attempt, because the cost of a wrong one is not a wasted run but a human interrupted.

**Escalate on parking, not only on failure.** A weaker model mostly does not write bad code — it parks more, hitting ambiguity a stronger model would have decided. Every false park costs human attention, which is the scarce resource here. So a park on the first attempt earns one retry a tier up before anyone is notified. If the stronger model parks too, the question is real and worth your time.

### The review pass, from the same table

- **Correctness-critical path** → always run `/simplify` and `/rulify`, whatever the size.
- **Otherwise** → only above roughly **50 changed lines** of non-generated code.
- **Never** → values, constants, config, input maps, text, docs, renames, generated artifacts. At any size.

**Say which and why, every time** — `no review pass: 15 lines, not correctness-critical`. A silent skip reads as "this was checked". That is the failure a merge gate exists to prevent, and it is worse than skipping loudly.

### Roles get fixed tiers

Only the worker is routed. These are stable:

| Role | Tier |
|---|---|
| Dispatcher — read board, decide | Haiku |
| CI-fix agent — read log, apply fix | Sonnet |
| Review pass | Opus |
| Decision comment | Opus |

The decision comment is Opus because deciding *what to ask a human* is the highest-leverage sentence an agent writes all run.

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

**Parking must reach the human, not just the board.** A comment nobody is looking at is the same as no comment: the run stalls silently and the board looks busy. The dispatcher sends a push notification naming the issue and the question the moment it sees a worker park - see the autopilot skill. The worker's job is to make that notification worth reading, which is what the numbered options below are for.

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
- Fill in `## Acceptance criteria` and `## Tests` concretely enough that the next attempt can finish without asking again.
- Resolve the ambiguity into explicit numbered options rather than prose.
- Do not post one for the other three stop reasons. A security decision needs an answer, not a rewritten spec.

**This section carries the weight the eligibility gate used to.** Nothing now stops a thin issue from being claimed, so the check happens here instead: an agent reads it, finds it underspecified, and hands back the spec it needed. A human approves a draft rather than authoring one cold. Issue quality improves as a side effect of running the system rather than as separate discipline.

## Answering

Either run `/decisions`, or reply directly on GitHub. Both routes end the same way: a comment on the issue and the status back to `Todo`.

If the project installs the bookkeeping workflow (`modules/autopilot/scaffold/.github/workflows/`), replying on GitHub is enough — the workflow flips the status server-side, so an answer written on a phone is queued before you next open the laptop. Without it, flip the status yourself.

**A human flips the status, never the agent.** If the agent re-checked on its own it would consume a half-written reply and burn an attempt.

## Two gates stay human, always

- **Draft to ready-for-review.** That is the review.
- **Merge.**

`/land` after merge is automatic. Nothing else about the PR is.
