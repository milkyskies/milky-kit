# Issues and labels

This rule file is the canonical agent instructions for tracking work. Projects reference this file from their `CLAUDE.md` instead of inlining the instructions; updates land here once and propagate to every project on next load.

All state lives on GitHub Issues as labels and comments. There is no wrapper CLI, no Projects board, and no local database. Every command is plain `gh`.

Run `.github/scripts/setup-labels.sh` once per repository to create every label below. The script is idempotent, so rerun it after the kit adds a label.

## Labels

| Group | Labels | Rule |
|---|---|---|
| Kind | `request`, `exploration`, `proposed` | one per issue |
| Stage | `stage:backlog`, `stage:intake`, `stage:ready`, `stage:working`, `stage:needs-you`, `stage:check`, `stage:done` | exactly one per open issue |
| Ask | `ask:everything`, `ask:choices`, `ask:own-feel` | one per request; project default in `CLAUDE.md` |
| Priority | `priority:P0` to `priority:P4` | default `priority:P2` |
| Points | `points:1`, `points:2`, `points:3`, `points:5`, `points:8`, `points:13` | one per request |
| Type | `type:feature`, `type:change`, `type:fix`, `type:chore`, `type:docs`, `type:refactor` | exactly one per issue |
| Consent | `autopilot` | opt-in per issue |

## Stages

| Stage | Meaning |
|---|---|
| `stage:backlog` | Parked for later, kept off the active lists. |
| `stage:intake` | Filed, still being clarified before work can start. |
| `stage:ready` | Fully decided, waiting for a worker. |
| `stage:working` | A worker has claimed it. |
| `stage:needs-you` | Waiting on a human decision: a decision comment, or an undecided idea filed as a question. |
| `stage:check` | A PR is open, waiting for the human to check and merge. |
| `stage:done` | Finished. The issue is also closed. |

`stage:needs-you` is distinct from a blocking dependency. A dependency waits on another **issue**; `stage:needs-you` waits on **you**.

Only `stage:ready` issues are claimable. Claimability is an allowlist: a stage added later is never claimable by default.

## Workflow

1. **Find work:** `gh issue list --label stage:ready`
2. **Claim work:** `gh issue edit <n> --add-label stage:working --remove-label stage:ready --add-assignee @me`
3. **Do the work:** Implement the issue.
4. **Park on a question:** post the decision comment, then `gh issue edit <n> --add-label stage:needs-you --remove-label stage:working`
5. **Open the PR:** `gh issue edit <n> --add-label stage:check --remove-label stage:working`
6. **Finish:** `gh issue edit <n> --add-label stage:done --remove-label stage:check`, then `gh issue close <n> --comment "<summary>"`

## Commands

| Command | What it does |
|---|---|
| `gh issue list --label stage:ready` | Issues ready to work |
| `gh issue list --label stage:needs-you` | Issues waiting on a human |
| `gh issue list --label <label>` | Filter by any label; repeat `--label` to combine |
| `gh issue view <n> --comments` | Issue details with its comments |
| `gh issue create --title "..." --body "..." --label request,stage:ready,priority:P2,points:3,type:change` | Create an issue (ALWAYS include `--body`) |
| `gh issue edit <n> --add-label <label> --remove-label <label>` | Change labels, including every stage move |
| `gh issue close <n> --comment "..."` | Close with a summary |
| `gh issue reopen <n>` | Reopen a closed issue |
| `gh issue list --search "query"` | Search issues by text |

## Sub-issues and blocking dependencies

GitHub tracks both natively. Use `gh api` against the issue relations endpoints.

Both relations take the numeric issue **id** in the request body, not the issue number. Look the id up first. Pass it with `-F` so `gh` sends a JSON number.

```bash
CHILD_ID=$(gh api repos/{owner}/{repo}/issues/<child-number> --jq .id)

# Sub-issues of a parent
gh api repos/{owner}/{repo}/issues/<parent>/sub_issues
gh api -X POST repos/{owner}/{repo}/issues/<parent>/sub_issues -F sub_issue_id=$CHILD_ID
gh api -X DELETE repos/{owner}/{repo}/issues/<parent>/sub_issue -F sub_issue_id=$CHILD_ID

# Blocking dependencies: <blocked> cannot start until the blocker is done
BLOCKER_ID=$(gh api repos/{owner}/{repo}/issues/<blocker-number> --jq .id)
gh api repos/{owner}/{repo}/issues/<blocked>/dependencies/blocked_by
gh api -X POST repos/{owner}/{repo}/issues/<blocked>/dependencies/blocked_by -F issue_id=$BLOCKER_ID
gh api -X DELETE repos/{owner}/{repo}/issues/<blocked>/dependencies/blocked_by/$BLOCKER_ID
```

Add and remove calls can hit secondary rate limits when sent in quick succession, so pause briefly between them.

## Autopilot eligibility

An autonomous agent may only claim an issue that is **opted in explicitly**. The issue must be `stage:ready`, unblocked, and carry the `autopilot` label: `gh issue list --label stage:ready --label autopilot`. Adding the label is a deliberate human act - consent per issue.

**Opt-in, never opt-out.** Forgetting the label means an agent leaves the issue alone. A `no-autopilot` label would mean forgetting it lets an agent run unattended on work nobody vetted, which is the wrong way round.

**The label is the whole gate.** Consent and specification are different questions and only the first is the tracker's to enforce. Whether an issue says enough to finish is a judgement the agent makes **while reading it**, and it already has somewhere to put that answer: the decision-comment protocol in `autopilot.md` parks an underspecified issue on `stage:needs-you`, states the question with numbered options, and proposes the issue body it needed. That is strictly more useful than being filtered out before anyone looked - you get a draft spec instead of silence.

The house template below still asks for both `## Acceptance criteria` and `## Tests`, and issues are still better with them. That is a writing convention, not a gate.

Eligibility is a filter, not a transition: an ineligible issue is skipped and its stage is never changed.

## Type labels

Every issue carries exactly one `type:*` label:

| Label | When |
|---|---|
| `type:feature` | new capability; nothing there before |
| `type:change` | an existing feature behaves differently |
| `type:fix` | broken; restore intended behaviour |
| `type:chore` | deps, CI, tooling, config |
| `type:docs` | documentation only |
| `type:refactor` | internals move, behaviour identical |

`feature` versus `change` is **"did this exist yesterday?"**, not how large the work is.

The distinction is worth drawing because new capability has no existing pattern to copy while modifying one does — the same property the autopilot tier table measures. See `autopilot.md`.

**No epic label.** An issue is an epic if it has sub-issues, which GitHub knows natively and renders with a progress bar. A label would be a second source of truth free to disagree with the real one. Never claim an issue that has open sub-issues; claim the sub-issues.

## Points (Fibonacci)

Use Fibonacci numbers for the `points:*` label: `1, 2, 3, 5, 8, 13`. Points measure effort and complexity. Pick the closest.

| | Time | Shape |
|---|---|---|
| `1` | under an hour | one function in one file, a test already sits beside it |
| `2` | a few hours | a few files in one layer, an existing pattern to follow |
| `3` | half a day | crosses layers, needs new tests |
| `5` | a full day | touches several areas, or has no pattern to copy |
| `8` | two to three days | several areas, and design work with nothing to copy |
| `13` | too big | propose the split instead of filing it |

**Estimate; do not ask.** Reading the code tells you how many files, how many layers, and whether a pattern exists to copy — that is the estimate. State the reasoning in one line so a wrong call is cheap to argue with.

## Priorities

`priority:P0` through `priority:P4`. Default `priority:P2`.

| | When |
|---|---|
| `P0` | broken, crashing, losing data, or a security hole |
| `P1` | blocks other work, or carries a named deadline |
| `P2` | everything else. The honest answer most of the time. |
| `P3` | someday |
| `P4` | backlog, nice to have |

Urgency lives in what the filer needs next week, and the code does not record that. Default to `priority:P2` unless they said otherwise. Never infer urgency from how serious the work sounds: a migration is `P0` when something is broken right now, not because migrations feel weighty.

## Writing issue bodies

`gh issue create` takes freeform Markdown via `--body` and imposes no structure — this is the house template that makes an issue self-contained. An agent who wasn't part of the discussion should be able to pick it up cold.

**Title:** one concise clause naming the capability or outcome. No em or en dashes — use `-` or `:`.

**Body sections — use the ones that apply, in this order:**

- `## Problem` (or `## Goal`) — what's missing today and why it matters. Lead with the problem, not the solution. A concrete scenario often beats an abstract description.
- **Key insight / rejected approach** (optional but valued) — the non-obvious framing, or why the naive approach is wrong. If the issue reframes an earlier idea, say so. This is the reasoning, not the spec.
- `## What this issue does` (or `## What to do` / `## What to test`) — the concrete mechanics, broken into **named sub-behaviors**. Use code or data snippets (pseudocode, schema, example rows) to pin down intent.
- `## Area` — the path globs this issue touches, one per line. Autopilot picks an implementation tier **before** the work exists, so it cannot inspect a diff; this section is the only record of where the change lands. Match the granularity of the project's `## Implementation tiers` table in `CLAUDE.md`. Write it even when the project declares no tier table — it tells a human where to look.
- `## Out of scope` (optional) — what an executor might reasonably touch and must not. Unbounded scope is where an agent drifts, and one line here costs less than a review that unpicks it.
- `## Reference points` (optional, high value) — paths to existing code that already does something analogous, each with one line on what to take from it. A pointer to a similar implementation keeps the output idiomatic better than a paragraph of description does.
- `## Acceptance criteria` — bulleted, checkable outcomes: what must be true when this is done. Each one binary: "the endpoint returns 409 when the slug exists" beats "handles conflicts correctly".
- `## Tests` — the tests that verify the work. **Required**, except: bug reports that already reference a failing test, or chores with no behavior change (deps, CI, docs).
- `## Dependencies` (optional) — prose note on blockers for a human reader. The native blocking relations are authoritative.

Skeleton:

```markdown
## Problem
<what's missing, why it matters — a concrete scenario if useful>

<optional: the key insight, or the approach you're deliberately NOT taking, and why>

## What this issue does
### <Sub-behavior A>
- <mechanic>  `(example, Data, Snippet)`
### <Sub-behavior B>
- <mechanic>

## Area
- <path/glob/**>

## Out of scope
- <what not to touch, and where it belongs instead>

## Reference points
- <path/to/analogous.ts> - <what to take from it>

## Acceptance criteria
- <binary, checkable outcome>
- <binary, checkable outcome>

## Tests
- <test that verifies X>
- <test that verifies Y>
```

Keep the floor even for small issues: at minimum a one-paragraph problem statement and a `## Tests` list. Bare-title or one-line issues are not acceptable.

The floor is per issue, and never a reason to file fewer of them. An issue you can specify is an issue you file: withholding five specified stages to avoid writing a thin one leaves the plan off the board, where it cannot be sequenced, blocked, or counted.

## Filing something you have not decided

Not every issue is a task. An idea, an unresolved fork, a half-thought you want out of your head — file it with `stage:needs-you` and the open question in the body.

```bash
gh issue create --title "..." --body "$(cat body.md)" --label request,stage:needs-you,priority:P2
```

Skeleton:

```markdown
## Problem
<what bugs you, and the concrete moment it bit>

## Open questions
1. <the fork you have not resolved>
2. <the fork you have not resolved>

## Sketch
<optional: the half-thought, explicitly flagged as not a decision>
```

**No `## Acceptance criteria`, no `## Tests`, no `## Area`.** Deciding those is the work. Writing them anyway fakes a decision you have not made, and a worker implements against the fake one and hands back the wrong thing having satisfied every box.

**No `autopilot` label and no `points:*` label.** Both describe work whose shape is known. Add them when you answer the question and move the stage to `stage:ready`.

**No `[Idea]` title prefix and no `idea` label.** `stage:needs-you` already means "waiting on you" and the claim query already excludes it. A title prefix is state you would have to hand-edit off when the issue graduates, and state belongs in labels.

## Rules

- **Always list `stage:ready` issues at the start of a session** to pick work.
- **Always claim before starting work** so other agents don't pick the same issue.
- **Never work on issues with `stage:working`** — another agent is on it.
- **Keep exactly one `stage:*` label on an open issue.** Every stage move adds the new label and removes the old one in the same `gh issue edit`.
- **Create issues for new work** instead of just doing it. Keeps the tracker organized.
- **Every issue must be self-contained — ALWAYS pass a body (`--body`) when creating one.** Cover what it is, why, the relevant design doc/ADR, and the code files to touch, so an agent who wasn't part of the discussion can pick it up cold. Never create bare-title issues.
- **Add blocking dependencies** when an issue can't be done until another is finished.
- **Close finished issues with a summary comment** via `gh issue close <n> --comment "..."`.
- **No em or en dashes in titles.** Use a hyphen `-` or colon `:`.
- **Reference issue numbers in commits** as `(#N)` or `closes #N` so GitHub auto-links.
