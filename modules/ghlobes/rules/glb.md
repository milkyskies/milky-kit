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
| `glb create --title "..." --priority P1 --status Backlog --points 3` | Create an issue |
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
- **Done** — completed

`glb ready` shows only **Todo** issues that are unblocked and unassigned.

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

## Rules

- **Always run `glb next` at the start of a session** to get scored recommendations.
- **Always `--claim` before starting work** so other agents don't pick the same issue.
- **Never work on issues with status `In Progress`** — another agent is on it.
- **Create issues for new work** instead of just doing it. Keeps the project organized.
- **Add dependencies** when an issue can't be done until another is finished.
- **Use `glb done <num>`** when finishing — it shows what newly unblocked.
- **No em or en dashes in titles.** Use a hyphen `-` or colon `:`. `glb create` enforces this.
- **Reference issue numbers in commits** as `(#N)` or `closes #N` so GitHub auto-links.

## One-time project setup

```bash
glb init
```

writes `.ghlobes.toml` against the detected GitHub project. The project must have a GitHub Project (Beta) with single-select fields `Status` and `Priority` configured — `glb init` shows what's needed if missing.
