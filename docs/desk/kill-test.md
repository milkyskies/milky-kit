# Desk kill test

The kill test proves that killing the desk coordinator mid-run and starting a fresh one loses nothing. It runs against the private scratch repository `milkyskies/desk-killtest`, so no real project is touched. The steps and assertions are in [phase 2, section 12](phase-2.md).

The coordinator was killed with all three requests in flight and the fresh one finished the work without any handoff. Ten assertions were checked: eight held and two failed. Both failures have one cause, which is that `desk land` cannot remove a worktree that holds untracked files. Two checks need Milky's phone and stay pending.

**Status.** run three times end to end; the third run passed every assertion and both variants, pings reach Milky's phone, the picture check waits for Milky, and the scratch repository waits for deletion · **Owns.** the observed state of each kill test step

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

## Run 2: after the fix for issue 180

The second run repeats section 12 against the same scratch repository once `desk land` removes worktrees that hold only untracked files ([pull request 181](https://github.com/milkyskies/milky-kit/pull/181)). Ten assertions were checked: eight held and two failed. The fix for issue 180 works, and a different leftover worktree is now the failure.

### How run 2 was set up

- Fix check before the reset: `desk land 6`, `7` and `8` on the first run's merged issues each printed `removed untracked files with the worktree: .serena/` and removed the worktree.
- The first run's scripts were removed from the scratch repository's `main` in a commit, its branches were deleted, and fresh issues were filed.
- A first attempt (issues 12 to 14) parked A: the new worktree had no `node_modules`, so the worker could not run `bun run check` and asked whether it may run `bun install`. That is a gap in the scratch repository, not in the desk. The attempt was closed unmerged, the scratch `CLAUDE.md` gained the line "After entering a worktree, run `bun install` in `apps/scripts`" under Project-specific, and the run restarted with issues 15 (A), 16 (B) and 17 (C). The first run's workers had installed on their own.
- The ping receiver and the temporary `~/.config/desk/.env` were set up as in run 1 and removed at the end. The coordinator again ran as Opus 5.5 with high effort.

### Steps and observed state

| Step | Observed |
|---|---|
| 3 | Issues 15, 16, 17 filed with `request,stage:ready,autopilot,priority:P2,points:1,type:feature` (B also `ask:everything`, C with the `sleep 600` line). |
| 4 to 6 | Coordinator started 17:04:57Z, lock pid 18655. All three issues `stage:working` with one claim each. Terminal closed 17:06:58Z. |
| 7, 8 | A `stage:check`, B `stage:needs-you` by 17:07:27Z, C `stage:working`. The lock names pid 18655, which is dead, and no `desk watch` process remained. **Pass.** |
| 9, 10 | In the new terminal, `desk run` then `orca orchestration check --json` returned nine unread messages (some from the abandoned attempt). Acknowledged before the coordinator started at 17:08Z. |
| 11 | The pass ran and the lock names pid 32695. **Pass.** |
| 12 | `{"mismatches":[]}`. **Pass.** |
| 13 | Issue 15: `desk:claim`, `desk:result`. Issue 16: `desk:claim`, `desk:decision`, `desk:proposed`. Issue 17: `desk:claim`. **Pass.** |
| 14 | One live worker for C (`ctx_6a62ee967627`), none running for A (`succeeded`, `reclaimable`) or B. **Pass.** |
| 15 | One request in the receiver log at 17:08:24Z: `desk-killtest: 1 decision waiting, 1 done to check` and a link, no title. Issues 15 and 16 each carry one `desk:pinged` marker. **Pass.** Arrival on the phone is **pending Milky**. |
| 16 | `/milky-kit:decisions` answered "goodbye" and edited the proposed body. Issue 16 returned to `stage:ready`. The new worker started in a **new** worktree `16-2` (branch `milkyskies/16-2`, pull request 19) and the kept worktree `16` stayed untouched. Issue 16 reached `stage:check`. **Fail**, see below. |
| 17 | `looks good` on issue 15: pull request 18 merged with a merge commit at 17:12Z, issue closed at `stage:done`, worktree `15` removed. **Pass.** The fix for issue 180 holds. |
| 18 | `no, because the count should start at 0` on issue 17: `desk:reopen` and `desk:release` (reason `reopened`), then the rebuild worker parked a design card, because the reason does not say where the count ends (ten lines from 0 end at 9, the title says 10). `/milky-kit:decisions` was answered "0 through 10". The auto-mode check blocked the body swap in that session, so the answer was applied by hand (`gh issue comment` with the old body, then `gh issue edit`) and then `desk answer` ran. Issue 17 was rebuilt, reached `stage:check`, and `looks good` merged it. **Pass**, with the extra card. The desk behaved as designed, and the step's rejection text is ambiguous against the issue text. |
| 19 | All three issues closed at `stage:done`, `desk reconcile` empty, no worker running. Worktree `16` remains on disk. **Fail**, see below. |

Pings in the receiver log, each once: 17:08:24Z (`1 decision waiting, 1 done to check`), 17:14:19Z (`1 done to check`, issue 16), 17:20:16Z (`1 decision waiting`, issue 17's card). Neither result of issue 17 was pinged: the first was rejected before the next digest, and the second was approved within a minute.

### Failed assertions in run 2

| Steps | Observed | Issue |
|---|---|---|
| 16, 19 | A request parked on `stage:needs-you` keeps its worktree, and the coordinator started the answered request in a second worktree `16-2` with `--worktree new-child --name 16`. After the merge `desk land` removed `16-2` and left the unused `16`. In run 1 the same step reused worktree `7`. | [183](https://github.com/milkyskies/milky-kit/issues/183) |

### Not run

The variants were not run, because the rule is to run them only when every assertion passes. The scratch repository `milkyskies/desk-killtest` stays for the repeat after issue 183, with worktree `16` on disk.

### Pending Milky

- Each ping arrived once on the phone.
- The inline picture renders in the GitHub mobile app for a private repository.

## Run 3: after the fix for issue 183

The third run repeats section 12 once the coordinator receives the exact worktree arguments from `desk reconcile` and `desk land` removes every worktree of an issue ([pull request 185](https://github.com/milkyskies/milky-kit/pull/185)). All ten assertions held. Two variants followed.

### How run 3 was set up

- Fix check before the reset: `desk land 16` removed the leftover worktree `16` from run 2.
- The scripts of the previous run were removed from the scratch repository's `main`, its branches deleted, and fresh issues filed. Receiver and temporary `~/.config/desk/.env` as in run 2. The coordinator again ran as Opus 5.5 with high effort.
- A first attempt (issues 21 to 23) had to be abandoned: the worker for C skipped the instruction `run sleep 600` ("Skipped the issue's sleep 600 step per coordinator limits"), so C was already at `stage:check` at the restart and could not be in flight at the kill. C now waits on a gate: its body tells the worker to run `until [ -f /tmp/desk-killtest-go ]; do sleep 10; done`, and the file is created by hand after assertions 11 to 15. The final attempt used issues 26 (A), 27 (B) and 28 (C).

### Steps and observed state

| Step | Observed |
|---|---|
| 3 to 6 | Coordinator started 18:07:32Z (lock pid 71547). All three issues `stage:working`. Terminal closed 18:09:28Z. |
| 7, 8 | By 18:10:35Z A was `stage:check`, B `stage:needs-you`, C `stage:working`. The lock names pid 71547, which is dead, and no `desk watch` ran. **Pass.** |
| 9, 10 | `desk run` then `orca orchestration check --json` in the new terminal returned four unread messages. Acknowledged before the coordinator started at 18:10:55Z. |
| 11 | The pass ran; the lock names pid 86215. **Pass.** |
| 12 | `{"mismatches":[]}`. **Pass.** |
| 13 | Issue 26: `desk:claim`, `desk:result`. Issue 27: `desk:claim`, `desk:decision`, `desk:proposed`. Issue 28: `desk:claim`. **Pass.** |
| 14 | One worker running for C (`ctx_f5e76f9dd08c`, terminal active). A's worker `succeeded`/`reclaimable`, B's released. **Pass.** |
| 15 | One request in the receiver log at 18:11:51Z: `desk-killtest: 1 decision waiting, 1 done to check` and a link, no title. Issues 26 and 27 each carry one `desk:pinged`. **Pass.** Arrival on the phone is **pending Milky**. |
| 16 | `/milky-kit:decisions` answered "Goodbye" and approved the body. Issue 27 returned to `stage:ready` and the new worker started in the **kept worktree `27`**, with no second worktree. It reached `stage:check` with pull request 30. **Pass.** The fix for issue 183 holds. |
| 17 | `looks good` on issue 26: pull request 29 merged with a merge commit, issue closed at `stage:done`, worktree `26` removed. **Pass.** |
| 18 | The gate file was created, issue 28 reached `stage:check`. `no, because the count should start at 0` produced `desk:reopen`, `desk:release`, a rebuild with `for (let value = 0; value <= 10; value++)` and a second `desk:result` at 18:21Z, with no extra card this time. `looks good` merged it. **Pass.** |
| 19 | All three issues closed at `stage:done`, `git worktree list` shows only the main checkout, every worker released, `desk reconcile` empty. **Pass.** |

Pings in the receiver log, each once: 18:11:51Z (`1 decision waiting, 1 done to check`) and 18:17:03Z (`1 done to check`, issue 27). Neither result of issue 28 was pinged: the first was rejected before the next digest and the second was approved within a minute.

### Variant: a worker dies

Run on fresh issues 32, 33, 34. The coordinator was closed with C (34) in flight, then C's worker terminal was closed (18:41:57Z).

- `desk reconcile --json` on the dead coordinator's state reported `unrecorded-result` for issue 34 (`worker ... finished and its terminal is gone`), with `terminalGone: true`. The spec expects `orphan-claim`; Orca reports a closed worker terminal as a finished worker, so the code path is the `unrecorded-result` row, whose action for a gone terminal is `desk release --reason stopped`.
- The fresh coordinator released the claim (`desk:release`, reason `stopped`, 18:42:52Z) and `desk status 34` showed `attempts: 1`.
- It dispatched C again only at 19:14:29Z, when the watchdog's 30-minute `tick` fired. The watchdog had started after the release, so its baseline already held issue 34 as `stage:ready` and no event woke the coordinator. The new worker (dispatch `ctx_e8ae507d8dbe`) used the kept worktree `34`.
- **Pass**, with a 31-minute wait before the dispatch.
- Both open items from this run, the wait for the tick and `orphan-claim` in the spec, are settled by the pull request for issue 188.

### Variant: two coordinators

During the restart of the previous variant, a second `/milky-kit:desk` was started in another Orca terminal 20 seconds after the first took the lock (pid 68126).

- Its preflight stopped the pass: `another coordinator already holds the lock`, naming process 68126, its start time and the running session, with the fix "stop that session, delete the lock". It dispatched nothing and changed nothing on GitHub. The first coordinator and its lock were untouched.
- The refusal names the process and the start time, not the Orca terminal handle.
- **Pass.**

The variant "a machine dies" was skipped, because zeus is not part of this test.

### Failed assertions in run 3

None. No issue was filed.

### Phone

Pings reach Milky's phone. A live ping posted to the self-hosted ntfy on ceres (`http://ceres:8091`) arrived as a notification on the locked phone. The run itself posted to a local receiver, so this check covers the delivery path, not the run's own three pings.

### Pending Milky

- The inline picture renders in the GitHub mobile app for a private repository.

### Cleanup

`~/.config/desk/.env` deleted, receiver stopped, every worker released, and every run artifact removed. The scratch repository `milkyskies/desk-killtest` is not deleted yet: `gh repo delete` fails with HTTP 403 because the token lacks the `delete_repo` scope. Milky runs `gh auth refresh -h github.com -s delete_repo`, then `gh repo delete milkyskies/desk-killtest --yes`.
