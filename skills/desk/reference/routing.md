# Routing

Read this before every `worker-start`. The coordinator chooses the model and the effort. The program never decides routing.

## The routing table

| Work | Model | Effort |
|---|---|---|
| Frontman, plans, design talk, explorations | Opus | high |
| Taste work: how a screen looks, dialogue, 3D | Opus | medium (3D: high) |
| A hard area from the project's list | Sonnet | medium |
| Merging, conflicts, build fixes | Sonnet | low |
| Easy and mechanical, with a check command | Haiku | none |
| Easy but no check command | Sonnet | low |
| The ship phase of any worker (commit, merge main, push) | (same model) | low |
| Web research | the researcher agent (Sonnet) | |
| Finding code | the scout agent (Haiku) | |

The project's `### Routing` rows in its `## desk` section are read first and win over this table. `### Hard areas` names the globs where the "hard area" row applies.

## Why the area decides

Two decisions take the same input: which model implements an issue, and whether its diff earns a review pass. The input is what part of the codebase the issue touches.

Where a similar implementation already exists, the work is pattern-matching. A cheap model does that well. Where the worker must design (domain rules, a schema change, a money path), that is judgement, which is what the expensive model is for.

The kit owns the shape. The contents are the project's: "netcode" is meaningless in a Flutter API, and "drizzle migrations" is meaningless in a Godot game. Each project declares its own `### Hard areas`. An issue's `## Area` section is the only record of where the change lands, because the coordinator routes before the diff exists.

A project that declares no hard areas routes everything to Sonnet.

## Routing order

1. **`needs:opus` label.** The human who filed it knows.
2. **P0.**
3. **Area matches the project's routing rows or hard areas.** Use that tier.
4. **No match.** Sonnet.
5. **Failed or parked.** Escalate one tier and retry.

Step 5 is a backstop, not the plan. Starting everything cheap and escalating sounds efficient and is not: some work should never get a cheap first attempt, because the cost of a wrong one is not a wasted run but a human interrupted.

## Escalation

`desk reconcile` reports the attempt count. Attempts are the `desk:release` and `desk:failed` comments after the newest human comment, so a human answer resets the count.

- **Haiku, 2 attempts:** dispatch Sonnet.
- **Sonnet, 2 attempts:** the coordinator parks the request itself, with a card listing what was tried.
- **Parking escalates too.** A weaker model mostly does not write bad code. It parks more, hitting ambiguity a stronger model would have decided, and every false park costs human attention. A park on the first attempt earns one retry a tier up before anyone is pinged. If the stronger model parks too, the question is real.

## Roles with fixed tiers

Only the worker is routed. These are stable:

| Role | Tier |
|---|---|
| Coordinator | Sonnet, medium |
| Merge worker, reply-only worker, CI-fix worker | Sonnet, low |
| Standing reviewer | Opus, medium |
| Decision comment written by the coordinator | Opus |

The decision comment is Opus because deciding what to ask a human is the highest-leverage sentence an agent writes all run.
