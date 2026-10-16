# Desk kill test

The kill test proves that killing the desk coordinator mid-run and starting a fresh one loses nothing. It runs against the private scratch repository `milkyskies/desk-killtest`, so no real project is touched. The steps and assertions are in [phase 2, section 12](phase-2.md).

The coordinator was killed with all three requests in flight and the fresh one finished the work without any handoff. Ten assertions were checked: eight held and two failed. Both failures have one cause, which is that `desk land` cannot remove a worktree that holds untracked files. Two checks need Milky's phone and stay pending.

**Status.** run once end to end, two assertions failed (issue 180), so the run must be repeated after the fix · **Owns.** the observed state of each kill test step

## How the run was set up

- The coordinator ran in its own Orca terminal in the scratch repository's root checkout, started with plain `/milky-kit:desk`. The reinstalled plugin lists the skill, so `--plugin-dir` was not needed.
- The session ran as Opus 5.5 with high effort, because the terminal used the account default. The skill text asks for Sonnet at medium effort. Nothing in the run depended on the model.
- ntfy was not set up. A receiver in the scratch repository (`tools/ping-receiver.ts`) listened on `127.0.0.1:8090`, answered 200 to every POST and logged each request. `~/.config/desk/.env` pointed `DESK_NTFY_URL` at it, with the topic `eb70f7736d8705228db0a47d` that the coordinator supplied. The file was deleted and the receiver stopped when the run ended. Without these two settings `desk preflight` fails on `ping configured` and no pass runs. [Issue 179](https://github.com/milkyskies/milky-kit/issues/179) asks whether that should stay a hard failure.
- Issue C carries a body line that tells the worker to run `sleep 600` once before committing. Without it the first attempt finished all three issues in two minutes, before the coordinator could be killed, and the scratch issues 1 to 3 were closed unmerged to restart. The final run used issues 6 (A), 7 (B) and 8 (C).
- A `desk preflight` run from the author's own session writes the lock with that session's pid. The lock was deleted before the real coordinator started.

## Setup and kill

| Step | Command | Observed |
|---|---|---|
| 1 | `gh repo create milkyskies/desk-killtest --private`, `setup-labels.sh` | Repository created from the `bun-scripts` scaffold with `issues`, `desk` and `bun`. Preflight sees 14 rules linked and 31 labels. |
| 2 | `## desk` section | `machine: Minerva`, `ask: ask:choices`, `check: bun test`, `Minerva: workers 3`. No zeus line, because zeus is not connected. |
| 3 | `gh issue create` three times | A is issue 6, B is issue 7 (`ask:everything`, farewell word left open), C is issue 8. Each has `request,stage:ready,autopilot,priority:P2,points:1,type:feature`. |
| 4 | `claude "/milky-kit:desk"` in an Orca terminal | Lock taken by pid 99843 at 16:20:59Z. |
| 5 | poll `stage:working` every 2 seconds | All three issues were `stage:working`, each with one claim, at 16:22Z. |
| 6 | `orca terminal close` on the coordinator terminal | Closed at 16:22:34Z. The watchdog died with it (no `desk watch` process left). |
| 7 | poll stage labels | B reached `stage:needs-you` at once. A reached `stage:check` at 16:25:53Z. C stayed `stage:working` (it was inside `sleep 600`). |
| 8 | read `coordinator.lock` | Names pid 99843, which `ps` reports dead. **Pass.** |

## Restart and first pass

| Step | Command | Observed |
|---|---|---|
| 9 | new Orca terminal, `claude "/milky-kit:desk"` | Started 16:26:44Z. Lock now names pid 19585. |
| 10 | in the new terminal's shell: `desk run`, `orca orchestration check --json`, then `--ack` | Seven unread messages (six `worker_done` and one heartbeat, some from the abandoned first attempt), none acted on. Acknowledged before the coordinator started. The mailbox is addressed to the Run, and `orca orchestration check` refuses another terminal's handle with `consumer_fenced`, so the drain had to run from the new terminal. |

| Step | Assertion | Observed |
|---|---|---|
| 11 | preflight passed, stale lock taken over | The pass ran. The lock file names pid 19585. **Pass.** |
| 12 | `desk reconcile --json` lists no mismatch | `{"mismatches":[]}`. **Pass.** |
| 13 | A `stage:check` with one `desk:result`; B `stage:needs-you` with one `desk:decision`; C `stage:working` with one claim | Issue 6: `desk:claim`, `desk:result`. Issue 7: `desk:claim`, `desk:decision`, `desk:proposed`. Issue 8: `desk:claim`. **Pass.** |
| 14 | one live worker for C, none for A or B | The worker of C was the one started before the kill (dispatch `ctx_f02341b17ad3`, `ready`, terminal active). B's worker was `released`. A's worker was `succeeded`, `reclaimable`, release not requested: no running agent, but not released yet. **Pass**, with that note. |
| 15 | one digest ping, text as specified, both comments marked pinged | One request in the receiver log at 16:27:26Z. Body: `desk-killtest: 1 decision waiting, 1 done to check` and a link to the issue list. No title. Issues 6 and 7 carry `desk:pinged at=2026-10-16T16:27:24Z`. **Pass.** Arrival on the phone is **pending Milky**. |

## Finish

| Step | Command | Observed |
|---|---|---|
| 16 | `/milky-kit:decisions` in its own terminal, option "Goodbye" for the word, then "Approve" for the proposed body | Issue 7 returned to `stage:ready` and was dispatched again in worktree `7`. It reached `stage:check` with pull request 11. **Pass.** |
| 17 | `gh issue comment 6 --body "looks good"` | Pull request 9 merged with a merge commit at 16:32:37Z. Issue 6 is `stage:done` and closed. Worktree `6` was **not** removed. **Fail**, see below. |
| 18 | `gh issue comment 8 --body "no, because the count should start at 0"` | Issue 8 got a `desk:reopen` and a `desk:release` (reason `reopened`), returned to `stage:ready`, was rebuilt with `for (let n = 0; n <= 10; n++)` and reached `stage:check`. `looks good` then merged pull request 10. **Pass.** |
| 19 | final state | All three issues closed at `stage:done`, no live worker (every worker `released`), `desk reconcile` empty, three pings received once each. Worktrees `6`, `7` and `8` remain on disk. **Fail**, see below. |

Pings in the receiver log, in order, each once:

| Time (UTC) | Body first line |
|---|---|
| 16:27:26 | `desk-killtest: 1 decision waiting, 1 done to check` |
| 16:33:40 | `desk-killtest: 1 done to check` (issue 7 after the answer) |
| 16:39:46 | `desk-killtest: 1 done to check` (issue 8 after the rebuild) |

## Failed assertions

| Steps | Observed | Issue |
|---|---|---|
| 17, 19 | `desk land` marks the issue done and closed, then fails to remove the worktree because it holds an untracked `.serena/` folder (written by the Serena MCP in every worker session). `orca worktree rm` refuses, and every later pass fails the same way. | [180](https://github.com/milkyskies/milky-kit/issues/180) |

## Not run

- The variants (a worker dies, a machine dies, two coordinators) were not run.
- The scratch repository stays for the repeat after issue 180 is fixed. Its three worktrees are still on disk for debugging.

## Pending Milky

- Each ping arrived once on the phone. The receiver log shows the three posts, not what a phone displayed.
- The inline picture renders in the GitHub mobile app for a private repository. No result carried a picture in this run.

## Open

- **Preflight without ping settings** ([issue 179](https://github.com/milkyskies/milky-kit/issues/179)). A project cannot run the desk without ntfy settings today.
