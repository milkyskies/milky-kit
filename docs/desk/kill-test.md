# Desk kill test

The kill test proves that killing the desk coordinator mid-run and starting a fresh one loses nothing. It runs against the private scratch repository `milkyskies/desk-killtest`, so no real project is touched. The steps and assertions are in [phase 2, section 12](phase-2.md).

The run is blocked at step 4. The coordinator's preflight fails on `ping configured`, because `DESK_NTFY_URL` and `DESK_NTFY_TOPIC` are not set in `~/.config/desk/.env`, and a failed preflight stops every pass. Milky has not chosen the ntfy setup yet, and the run does not invent a topic.

**Status.** blocked at step 4, waiting on Milky's ntfy setup · **Owns.** the observed state of each kill test step

## Setup

| Step | Command | Observed |
|---|---|---|
| 1 | `gh repo create milkyskies/desk-killtest --private --source . --push`, then `bash .github/scripts/setup-labels.sh` | Repository created from the `bun-scripts` scaffold with the `issues`, `desk` and `bun` modules, 14 rules linked. Labels created. Preflight counts 31 labels as existing. |
| 2 | `## desk` section in `CLAUDE.md` | `machine: Minerva`, `ask: ask:choices`, `check: bun test`, `Minerva: workers 3`. No zeus line, because zeus is not connected. Preflight reports the section parses. |
| 3 | `gh issue create` three times | Issue 1 (A, greet), issue 2 (B, farewell, `ask:everything`, farewell word left open), issue 3 (C, count). Each carries `request,stage:ready,autopilot,priority:P2,points:1,type:feature`. |
| 4 | `desk preflight --role coordinator` | Eleven checks passed. One failed: `ping configured`. The coordinator was not started. |

Preflight output at step 4:

```
ok    bun 1.3.14
ok    kit present
ok    kit is up to date
ok    Orca is running
ok    gh logged in
ok    milkyskies/desk-killtest writable (ADMIN)
ok    14 rules linked
ok    mise tools installed
ok    ## desk section parses
ok    31 labels exist
ok    this is Minerva, the pinned machine
ok    lock taken by pid 11463
FAIL  DESK_NTFY_URL and DESK_NTFY_TOPIC not set
```

The scratch repository is registered in Orca at `~/orca/workspaces/desk-killtest-scratch`. The installed `milky-kit` plugin cache is older than the desk skill, so the coordinator session must start with `claude --plugin-dir ~/.claude/kit` for `/milky-kit:desk` to exist.

## Steps 5 to 19

Not run. Every step waits on the coordinator, which waits on the ntfy settings.

| Steps | Assertion | State |
|---|---|---|
| 5 to 8 | A, B, C reach `stage:working`; coordinator killed; lock names the dead pid | not run |
| 9 to 10 | Fresh coordinator starts; mailbox drained unread | not run |
| 11 to 14 | Stale lock taken over; no mismatch; A, B, C states; one live worker for C | not run |
| 15 | One digest ping, both comments marked pinged | not run, pending Milky's ntfy setup |
| 16 to 19 | `/decisions`, `looks good` merge, rejection of C, final state | not run |

The inline picture check on the phone is pending Milky.

## Failed assertions

None filed. Missing ping settings are a pending setup step, not a failed assertion. No issue was filed in `milkyskies/milky-kit`.

## Open

- **Milky's ntfy setup** unblocks the run. With `DESK_NTFY_URL` and `DESK_NTFY_TOPIC` set, resume at step 4.
- **Preflight and missing ping settings.** The brief for this run says to run everything else when the settings are missing. Preflight refuses to pass without them, so that is impossible today. Whether preflight should downgrade `ping configured` to a warning is Milky's call. Proposal (提案), not decided.
- **Scratch repository** `milkyskies/desk-killtest` stays for the resumed run.
