---
name: issues
description: Reference for the issue tracker - every gh command, the sub-issue and blocking-dependency API calls, and the house issue body templates (task and undecided). TRIGGER when filing, editing, closing, relabeling or linking a GitHub issue, or writing an issue body. The rules (labels, stages, points, priorities, eligibility) are in the issues.md rule; this is the how.
---

# Issues: commands and templates

The rules are in `.claude/rules/issues.md`. This is the reference it points to.

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

## Writing issue bodies

**Body sections — use the ones that apply, in this order:**

- `## Problem` (or `## Goal`) — what's missing today and why it matters. Lead with the problem, not the solution. A concrete scenario often beats an abstract description.
- **Key insight / rejected approach** (optional but valued) — the non-obvious framing, or why the naive approach is wrong. If the issue reframes an earlier idea, say so. This is the reasoning, not the spec.
- `## What this issue does` (or `## What to do` / `## What to test`) — the concrete mechanics, broken into **named sub-behaviors**. Use code or data snippets (pseudocode, schema, example rows) to pin down intent.
- `## Area` — the path globs this issue touches, one per line. The frontdesk coordinator picks a model **before** the work exists, so it cannot inspect a diff; this section is the only record of where the change lands. Match the granularity of the project's `### Hard areas` and `### Review paths` in the `## frontdesk` section of `CLAUDE.md`. Write it even when the project declares neither — it tells a human where to look.
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

## Filing something undecided

```bash
gh issue create --title "..." --body "$(cat body.md)" --label request,stage:backlog,undecided,priority:P2
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

