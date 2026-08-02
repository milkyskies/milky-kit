# Task tracking with glb (ghlobes)

This rule file is the canonical agent instructions for `glb` (ghlobes). Projects that use ghlobes reference this file from their `CLAUDE.md` instead of inlining the instructions; updates to the workflow land here once and propagate to every project on next load.

ghlobes is a Rust CLI that wraps `gh` + GitHub GraphQL for beads-like workflow on top of GitHub Issues + Projects. All state lives in GitHub — no local database.

## Workflow

1. **Find work:** `glb next` for scored recommendations (or `glb ready` for the raw list).
2. **Claim work:** `glb update <number> --claim` to mark In Progress.
3. **Do the work:** Implement the issue.
4. **Finish:** `glb done <number> --comment "..."` — closes it and shows what newly unblocked + suggests next picks.

## Commands

| Command | What it does |
|---|---|
| `glb ready` | Show issues ready to work (unblocked, not in progress) |
| `glb list` | List all open issues. Filters: `--status`, `--priority`, `--assignee` |
| `glb show <num>` | Show issue details, deps, status, priority, points, sub-issues |
| `glb create --title "..." --body "..." --priority P1 --status Backlog --points 3` | Create an issue (ALWAYS include `--body`) |
| `glb update <num> --claim` | Claim issue (sets status to In Progress) |
| `glb update <num> --status <s> --priority <p> --points <n>` | Update fields |
| `glb close <num>` | Close an issue |
| `glb done <num>` | Close + show what newly unblocked + suggest next picks |
| `glb reopen <num>` | Reopen a closed issue |
| `glb dep add <issue> <blocked_by>` | Add a blocking dependency |
| `glb dep list <issue>` | Show dependencies |
| `glb sub add <parent> <child>` | Add a sub-issue to a parent (epic) |
| `glb sub remove <parent> <child>` | Remove a sub-issue from a parent |
| `glb sub list <parent>` | List sub-issues with progress |
| `glb blocked` | Show all blocked issues |
| `glb stuck` | Top blockers + per-epic stuck counts (bottleneck dashboard) |
| `glb tree <num>` | Recursive sub-issue tree with status icons + blockers |
| `glb deps <num>` | Bidirectional transitive dep tree. `--upstream`, `--downstream` |
| `glb closed --since 7d` | List recently closed issues. `--in-epic <num>`, `--limit N` |
| `glb path` | Critical path + high-leverage issues. `--by-count`, `--top N`, `--epic <num>`, `--explain` |
| `glb next` | Recommend next batch. `--agents N` (3), `--epic <num>`, `--track <name>`, `--diverse`, `--reason`, `--exclude <num>` |
| `glb search "query"` | Search issues by text |
| `glb stats` | Show open/closed/blocked/ready counts |

## Statuses

- **Backlog** — acknowledged, not yet prioritized for active work
- **Todo** — ready to be picked up
- **In Progress** — someone is actively working on it
- **Needs Decision** — work stopped, parked on a human answer; the question is a comment on the issue
- **In Review** — a draft PR is open, waiting on human promotion and merge
- **Done** — completed

`glb ready` shows only **Todo** issues that are unblocked, not an epic with open sub-issues, and unassigned. Claimability is an allowlist: any status other than `Todo` is excluded, so a status added to the board later is never claimable by default.

`Needs Decision` is distinct from `glb blocked`. Blocked means waiting on another **issue**; Needs Decision means waiting on **you**.

## Points (Fibonacci)

Use Fibonacci numbers for `--points`: `1, 2, 3, 5, 8, 13`. This represents effort/complexity. Pick the closest.

- `1` — trivial (under 1 hour)
- `2` — small (a few hours)
- `3` — medium (half a day)
- `5` — large (full day)
- `8` — very large (2–3 days)
- `13` — epic (break it down into sub-issues if possible)

## Epics (sub-issues)

Use `glb sub` to organize work into parent/child hierarchies. GitHub renders these natively with a progress bar on the parent issue.

```bash
glb create --title "Auth system"          # becomes #10 (epic)
glb create --title "Design auth flow"     # becomes #11
glb create --title "Implement auth"       # becomes #12
glb sub add 10 11
glb sub add 10 12

# Optional: make tasks sequential with a blocking dep
glb dep add 12 11   # #12 blocked by #11
```

## Writing issue bodies

`glb create` takes freeform Markdown via `--body` and imposes no structure — this is the house template that makes an issue self-contained. An agent who wasn't part of the discussion should be able to pick it up cold.

**Title:** one concise clause naming the capability or outcome. No em or en dashes (`glb create` rejects them) — use `-` or `:`.

**Body sections — use the ones that apply, in this order:**

- `## Problem` (or `## Goal`) — what's missing today and why it matters. Lead with the problem, not the solution. A concrete scenario often beats an abstract description.
- **Key insight / rejected approach** (optional but valued) — the non-obvious framing, or why the naive approach is wrong. If the issue reframes an earlier idea, say so. This is the reasoning, not the spec.
- `## What this issue does` (or `## What to do` / `## What to test`) — the concrete mechanics, broken into **named sub-behaviors**. Use code or data snippets (pseudocode, schema, example rows) to pin down intent.
- `## Acceptance criteria` — bulleted, checkable outcomes: what must be true when this is done.
- `## Tests` — the tests that verify the work. **Required**, except: bug reports that already reference a failing test, or chores with no behavior change (deps, CI, docs).
- `## Dependencies` (optional) — prose note on blockers for a human reader. The `glb dep` graph is authoritative.

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

## Acceptance criteria
- <checkable outcome>
- <checkable outcome>

## Tests
- <test that verifies X>
- <test that verifies Y>
```

Keep the floor even for small issues: at minimum a one-paragraph problem statement and a `## Tests` list. Bare-title or one-line issues are not acceptable.

## Rules

- **Always run `glb next` at the start of a session** to get scored recommendations.
- **Always `--claim` before starting work** so other agents don't pick the same issue.
- **Never work on issues with status `In Progress`** — another agent is on it.
- **Create issues for new work** instead of just doing it. Keeps the project organized.
- **Every issue must be self-contained — ALWAYS pass a description (`-b`/`--body`) when creating one.** Cover what it is, why, the relevant design doc/ADR, and the code files to touch, so an agent who wasn't part of the discussion can pick it up cold. Never create bare-title issues.
- **Add dependencies** when an issue can't be done until another is finished.
- **Use `glb done <num>`** when finishing — it shows what newly unblocked.
- **No em or en dashes in titles.** Use a hyphen `-` or colon `:`. `glb create` enforces this.
- **Reference issue numbers in commits** as `(#N)` or `closes #N` so GitHub auto-links.

## One-time project setup

```bash
glb init
```

writes `.ghlobes.toml` against the detected GitHub project, creating the GitHub Project (Beta) and its `Status`, `Priority`, and `Points` fields if they do not exist.

Run against an existing project, `glb init` repairs the `Status` field by appending any missing options. It is idempotent and preserves existing option IDs, so issues keep their current status; custom statuses you added yourself are left alone. Re-run it after upgrading the kit to pick up new statuses.
