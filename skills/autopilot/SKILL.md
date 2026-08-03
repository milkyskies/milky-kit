---
name: autopilot
description: >
  Drive eligible issues from Todo to draft PR without human keystrokes. One wake
  evaluates the board, does the highest-value thing available, and blocks on the
  next event rather than a timer.
  TRIGGER when: the user says "/autopilot", "run autopilot", "work the board", or
  asks to start autonomous work on the backlog.
  DO NOT TRIGGER when: the user named a specific issue to work on (just do it),
  or `.milky-kit-mode` is `main`.
argument-hint: "[--dry-run] [--explain] [--max N]"
---

# Autopilot

Work the board autonomously. Read `.claude/rules/autopilot.md` first — it carries the state machine, the stop criteria, and the comment protocol this skill assumes.

## Refuse to run when

- **`.milky-kit-mode` is `main`.** Parallel agents in one checkout will trample each other. Say so and stop.
- **No issue is autopilot-eligible.** `glb ready --autopilot` is empty and there is nothing merged or answered to process. Report and stop; this is a normal outcome, not an error.

## The wake

Not a timer. Do the **first** thing that applies, then re-evaluate:

### 1. Land merged PRs

Cheapest, and it frees dependents this same wake — which is why it runs before anything else.

```bash
gh pr list --state merged --limit 20 --json number,body,mergedAt
```

For each merged PR whose linked issue is still open: `/land`, then `glb done <num>`.

Skip if the bookkeeping workflow is installed — it already did this server-side.

### 2. Requeue answered decisions

```bash
glb list --status "Needs Decision"
```

For each, check whether the newest comment is a human's (no `<!-- autopilot:agent -->` marker) and postdates the agent's question. If so, `glb update <num> --status Todo`.

Skip if the bookkeeping workflow is installed.

### 3. Fix PRs in trouble

For issues in `In Review`, check the PR:

```bash
gh pr checks <num>
gh pr view <num> --json reviews,comments
```

CI red or unaddressed review comments → spawn a fix agent **in the existing worktree**. Do not create a new one; the branch and its state are already there.

### 4. Start new work

```bash
glb ready --autopilot
```

Up to the concurrency cap. For each: create a worktree, spawn a worker (below).

### 5. Nothing to do

Block on the next event. Do not poll.

## Choosing the tier

Read `## Implementation tiers` and `## Correctness-critical paths` from the project's `CLAUDE.md`. The full reasoning is in `.claude/rules/autopilot.md`; the order is:

1. `needs:opus` label → Opus
2. `P0` → Opus
3. The issue's `## Area` matches a glob in the table → that tier
4. No match → Sonnet
5. Previous attempt failed **or parked** → one tier up

No table declared → Sonnet for everything.

The issue's `## Area` section is what you match against — `/todo` writes it while drafting, from an actual look at the code. If it is absent, match the paths named anywhere in the body; if the body names none, use Sonnet and say so, because guessing a tier from prose is worse than starting cheap with an escalation ladder behind it.

**Log the tier and attempt number with the spawn.** Without that the table can never be checked against reality.

## Spawning a worker

Create the worktree **before** launching the agent, and launch the agent inside it. The agent must never decide where it belongs — see `workflow.md`.

```bash
git fetch origin
git worktree add ../<worktree-dir>/<num> -b feature/#<num>.<summary> origin/main
```

### herdr backend (`HERDR_ENV=1`)

Visible and interruptible — you can watch a run and take it over. Prefer this while the prompts are still being tuned.

**One tab per issue, inside the project's existing workspace. Never a workspace per issue.** A workspace is a *project* context; minting one per issue puts `#141` as a peer of `adoba` in the sidebar, and four concurrent issues double the project list. Tabs are what herdr provides for subcontexts within a project.

Discover your own workspace from the focused pane — `workspace list` does not carry a cwd, so there is nothing to match a path against:

```bash
WS=$(herdr pane list | python3 -c 'import sys,json; print(next(p["workspace_id"] for p in json.load(sys.stdin)["result"]["panes"] if p.get("focused")))')

PANE=$(herdr tab create --workspace "$WS" --cwd "../<worktree-dir>/<num>" \
  --label "#<num> <slug>" --no-focus \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')

herdr pane run "$PANE" "claude"
herdr wait output "$PANE" --match ">" --timeout 15000
herdr pane run "$PANE" "<worker prompt>"
herdr wait agent-status "$PANE" --status done --timeout 3600000
herdr pane read "$PANE" --source recent --lines 200
```

`--cwd` on `tab create` starts the tab's root pane in the worktree, so no `cd` is needed.

`herdr wait agent-status` is a real waiter — the wake resumes the instant an agent finishes, with no polling.

**Never parse or construct ids by format.** They are `w3:pC` / `w3:tC` in practice, not the `1-1` shape herdr's own docs show, and they compact when tabs close. Always read them back from the response you just got.

Close the tab when the issue reaches `In Review` or parks. `herdr tab close <tab_id>` — the tab is a view, and leaving finished ones open buries the running agents.

### Headless backend

No herdr running. `claude -p "<worker prompt>"` as a subprocess and wait on exit — process exit is the same signal without the visibility.

Either way the glb state transitions are identical. The backend is an implementation detail.

## The worker's job

1. `glb update <num> --claim`
2. Read the issue body **and every comment**; latest comment wins
3. Implement in the worktree
4. `/ship` — add `--review` only when the diff earns it (below), then `/write-pr`, draft PR, CI poll
5. `glb update <num> --status "In Review"`

### When to pass `--review`

- **The diff touches a correctness-critical path** → always, whatever its size
- **Otherwise** → only above roughly **50 changed lines** of non-generated code
- **Never** for values, constants, config, input maps, text, docs, renames or generated artifacts, at any size

Unlike the tier, this is decided **after** implementing, when the diff exists and can be measured — so measure it rather than guessing from the issue.

**Report which and why, always**: `no review pass: 15 lines, not correctness-critical`. A silent skip reads as "this was checked", which is worse than skipping loudly.

Or, on hitting one of the four stop criteria: post the decision comment, `glb update <num> --status "Needs Decision"`, exit. Leave the worktree; the next attempt resumes in it.

## Ping when a worker parks

A parked issue is the one autopilot outcome that cannot make progress on its own. Everything else resolves on the next wake; this waits on a person, and a person who does not know is a run that stalls until morning for no reason.

So whenever a wake observes a worker move an issue to `Needs Decision`, send a **PushNotification** naming the issue and its question in one line:

```
#141 parked: should a report notify a channel or land in an admin query? 2 options in the comment.
```

Rules:

- **One push per park, not per wake.** Re-notifying an issue that was already `Needs Decision` when this wake began trains the user to ignore them. Only push for issues that transitioned during *this* wake.
- **Carry the question, not the status.** "Autopilot needs a decision" tells the user nothing they cannot see on the board. The question is what lets them answer from a phone without opening the laptop.
- **Do not push for the other outcomes.** A draft PR opened, an issue landed, a wake with nothing to do — all of those are readable the next time they look. Only parks interrupt.
- Log the park to `.autopilot/log.jsonl` as usual. The push is the interrupt; the log is the record.

Answering is unchanged: a human comments, the bookkeeping workflow flips the status back to `Todo`, and the next wake resumes in the worktree that is still there.

## Safety

- **Concurrency cap.** Default 5, override with `--max N`. More agents than cores makes everything slower and the output unreadable.
- **Three attempts per issue.** Track attempts in issue comments. Each attempt escalates one tier. On the third failure, park on `Needs Decision` with what was tried, at which tier, and why each failed. Without this, one impossible issue eats a night of tokens.
- **A first-attempt park earns one retry a tier up**, before the human is notified. A weaker model parks more than it fails, and a false park costs attention rather than tokens. If the stronger tier parks too, notify — the question is real.
- **Never promote a draft PR to ready.** Never merge. Both are human gates, always.

## `--dry-run` and `--explain`

`--dry-run` evaluates a full wake and prints the action list without executing any of it: no `glb update`, no worktree creation, no spawns, no comments.

`--explain` accounts for every open issue — selected, or the reason it was not:

```
#141  spawn        eligible, unblocked, slot 2/5
#69   skip         no `autopilot` label
#137  skip         blocked by #136
#140  skip         status is Needs Decision
#138  skip         concurrency cap reached (5/5)
```

Reasons come from `glb ready --autopilot --explain`, not a reimplementation — a second copy of the rules drifts from the one that actually decides.

`--dry-run` must be genuinely side-effect free. No issue comments, no label writes, no `gh pr` mutations. If you cannot compute something without writing, report that you could not rather than writing.

**Run `--dry-run` before leaving this unattended.** What makes an autonomous system safe to walk away from is being able to see what it decided, not more approval gates.

## The decision log

Every real wake appends one line per action to `.autopilot/log.jsonl`, git-ignored. This is the artifact you read the morning after, so it must be reconstructable without the transcript.

```jsonl
{"at":"2026-08-02T09:14:22Z","issue":141,"action":"spawn","reason":"eligible, unblocked, slot 1/5","tier":"sonnet","attempt":1,"review":false,"backend":"herdr","from":"Todo","to":"In Progress"}
{"at":"2026-08-02T09:41:07Z","issue":141,"action":"park","reason":"attempt 3 of 3 failed","backend":"herdr","from":"In Progress","to":"Needs Decision"}
{"at":"2026-08-02T09:41:09Z","issue":137,"action":"skip","reason":"blocked by #136","backend":null,"from":"Todo","to":"Todo"}
```

`action` is one of `spawn`, `land`, `requeue`, `fix`, `park`, `skip`. A `skip` records `from` equal to `to`, because eligibility is a filter and never transitions anything.

`tier`, `attempt` and `review` are what make the area table checkable. After ~20 issues, the share of attempts that escalated answers whether the table is right — under roughly a fifth and more work belongs on the cheaper tier; over half and the floors are too low. Without those fields the table is believed rather than tested.

Add `.autopilot/` to `.gitignore` on first run. The log is local telemetry, not shared state — everything another machine needs is already on the board.

**Log skips too.** A wake that only logs what it did reads as "covered everything" when it silently passed over nine issues.

## Rules

- **Never spawn on an issue you cannot see in `glb ready --autopilot`.** That command is the gate; do not reimplement its filter.
- **Never work in the root checkout.** Every worker gets a worktree.
- **Log every action.** One line per action per wake: issue, action, reason, backend, resulting transition. This is what you read the morning after.
- **Report what you skipped.** A silent cap reads as "covered everything" when it did not.
