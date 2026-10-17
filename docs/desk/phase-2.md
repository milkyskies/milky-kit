# The desk: phase 2 design

The old coordinator kept the truth in Orca's mailbox and in its own conversation, so one lost `worker_done` or one compacted chat put a run out of sync. Phase 2 of [the desk plan](plan.md) moves every piece of state onto GitHub Issues, where a fresh coordinator can read it back. Phase 2 is done when killing the coordinator mid-run and starting a fresh one loses nothing.

The build is one Bun program, `desk`, plus a coordinator skill and a worker rule. Workers record every outcome on their Issue with `desk claim`, `desk park` and `desk done`, which check what they wrote by reading it back. The coordinator remembers nothing: each pass compares open Issues with Orca's running workers and fixes the difference. A watchdog loop wakes the coordinator at no token cost, a preflight check refuses to dispatch on a broken machine, and pings go to the phone through ntfy.

**Status.** Not built; the design is ready for the section 13 build split · **Owns.** the `desk` command interface, the comment markers, the reconcile table, the preflight checks, the watchdog's silence rules, the ping format, and the `## desk` section format

A Sonnet worker should be able to build its task from section 13 without guessing. The calls below come from three places, and each one says which:

- **Plan**: settled with Milky in [the desk plan](plan.md).
- **Relayed**: asked during this design and answered by the plan author. Milky never settled these; each answer is the plan author's proposal, and Milky can overturn any of them.
- **Small call**: decided by this design. Every one is listed in section 14 as `Auto-decided: X over Y because Z`, so a reader can overturn it.

## 1. Module layout

`modules/autopilot` becomes `modules/desk` (relayed). The command is `desk`, the rule is `desk.md`, and every comment marker becomes `<!-- desk:* -->`. A later rename to the final name is one search-and-replace.

```
modules/desk/
├── module.toml                      # ships the rule and the ## desk section template
├── rules/desk.md                    # every-turn worker contract (small)
├── desk-section.md                  # the ## desk template a project copies into CLAUDE.md
├── bin/desk                         # POSIX shell shim: checks bun, then runs the program
└── cli/
    ├── package.json                 # bun, @types/bun, nothing else at runtime
    ├── tsconfig.json
    ├── .env.example                 # DESK_NTFY_* keys, documented
    └── src/
        ├── main.ts                  # parses argv, imports ./commands/<name>.ts dynamically
        ├── commands/<name>.ts       # one file per subcommand
        ├── github/                  # gh wrapper, marker grammar, issue state, body sections
        ├── orca/                    # orca wrapper: worker-list, status, terminal list, inbox
        ├── reconcile/               # the diff
        ├── watch/                   # the watchdog loop
        ├── preflight/               # the checks
        └── project/                 # the ## desk section parser, the coordinator lock
skills/desk/
├── SKILL.md                         # /milky-kit:desk, the coordinator loop
└── reference/
    ├── routing.md                   # loaded when choosing a model (phase 3 grows it)
    ├── review.md                    # loaded when a PR touches a review path
    └── tokens.md                    # loaded when writing a brief or reusing a worker
```

- **The coordinator skill** is `skills/desk/SKILL.md`, invoked as `/milky-kit:desk`. Starting a coordinator, and restarting one after a crash, are the same command.
- **The worker rules** are `modules/desk/rules/desk.md`, symlinked into every project's `.claude/rules/` like every other rule. The rule stays small, because it loads on every turn of every session in the project.
- **The state script, preflight and the watchdog** are one program with subcommands: `desk claim`, `desk preflight`, `desk watch` and the rest. One runtime, one test suite, one marker parser.
- **The program is reached at `~/.claude/kit/modules/desk/bin/desk`** on every machine. Rules and skills write that full path once at the top and call it `desk` afterwards. No per-project copy exists, the same way rules are symlinked rather than copied.

`modules/autopilot/rules/autopilot.md` is split. The worker contract and the decision comment protocol move to `modules/desk/rules/desk.md`. The area table and the review-pass text move to `skills/desk/reference/routing.md` and `skills/desk/reference/review.md`, because only the coordinator reads them. `modules/autopilot` is then deleted.

### Runtime

The program is Bun TypeScript, tested with `bun test` (relayed). The kit's `mise.toml` pins bun, so a normal `mise install` provides it (relayed).

`bin/desk` is a POSIX shell shim, so a machine without bun still gets the exact fix (relayed):

```sh
#!/bin/sh
if ! command -v bun >/dev/null 2>&1; then
	echo "desk: bun is not installed on $(hostname -s). Fix: mise use -g bun" >&2
	exit 127
fi
exec bun "$(dirname "$0")/../cli/src/main.ts" "$@"
```

The program shells out to `gh` and `orca` through `Bun.spawn`. It never holds a GitHub token itself; `gh` carries the login. The only runtime dependency is Bun.

## 2. The state script

### Contract shared by every command

Every command that changes state runs the same five steps:

1. **Read** the issue: labels, assignees, body, and comments, in one GraphQL call.
2. **Check the precondition.** A command refuses unless the issue is in exactly the state the command expects.
3. **Write the comment first, then the labels.** If the label write fails, the comment is still on the issue and the next reconcile pass finds it. The reverse order would move the stage with no record of why.
4. **Read again.**
5. **Compare.** The second read must show the state the command meant to produce. Anything else is a failure.

Step 5 is the fix for glb's failed claim that read like a success. A command never reports success from the write call's exit code alone.

Exit codes:

| Code | Meaning |
|---|---|
| 0 | done, and the second read confirmed it |
| 1 | refused: the precondition did not hold, nothing was written |
| 2 | usage error: a missing flag, an unknown command |
| 3 | a `gh` or `orca` call failed |
| 4 | written, but the second read shows a different state |
| 127 | bun is missing (from the shim) |

Every non-zero exit prints one line to stderr in this shape:

```
desk: claim #12 refused: stage is stage:working (claim c_8f3a2b on zeus, 2026-10-16T14:02Z), expected stage:ready
```

The line names the command, the issue, what the program saw, and what it expected. Where a fix exists, the line ends with ` Fix: <command>`. Success prints one line to stdout, or one JSON object with `--json`.

Global flags: `--repo <owner/name>` (default: the repository of the current directory, from `gh repo view`), `--json`. The repository is resolved lazily, so a command that does not need it (`desk preflight`) runs and reports a logged-out `gh` or a missing repository itself.

### Marker grammar

Every comment the program writes starts with one marker line and ends with `<!-- desk:agent -->`:

```
<!-- desk:<kind> key=value key=value -->
```

Values never contain spaces. Kinds: `claim`, `release`, `failed`, `decision`, `answer`, `proposed-body`, `result`, `reopen`, `merge`, `autoland`, `review`, `proposed-request`. `desk:decision` carries `claim=<id> card=<claim>-<k>`, where `<k>` counts the cards of one park from 1. `desk:answer card=<id>` is the human's answer to that card, and it has no agent marker. `desk:claim` carries `role=frontman` when a frontman holds it. A comment is the **human's** when it lacks `<!-- desk:agent -->`. Author login cannot tell them apart, because workers post with Milky's own `gh` login.

A comment the digest has pinged gets a trailing `<!-- desk:pinged at=<iso> -->` line appended by an edit. Section 7 explains why.

### Derived values

`src/github/` computes these from the comments, so nothing else stores them:

- **Owning claim**: the earliest `desk:claim` comment not followed by a `desk:release` or `desk:failed` naming its id. Every guard, `desk release --claim` and `desk status` use this one definition, and `desk claim` uses it to pick the winner of a race, so a loser whose `lost-race` release failed never owns the issue.
- **Attempts**: the count of `desk:release` and `desk:failed` comments after the newest human comment, not counting releases with reason `lost-race`, `answered`, `reopened` or `ready`. A human answer resets the count, because the next attempt starts from new information.
- **Last human comment**: the newest comment without the agent marker.
- **Open cards**: the `desk:decision` comments of the newest park (the cards that share the claim of the newest card with an id) that no `desk:answer card=<id>` names. A decision with no `card=` attribute predates card ids and gets the id `legacy-<comment id>`, so the desk can answer it with `--card` like any other.

### Commands

`<n>` is an issue number. `--dispatch <d>` is the worker's Orca dispatch id, which every worker has in its preamble. It proves the worker owns the owning claim.

**`desk claim <n> --machine <m> --task <t> --dispatch <d> [--role frontman]`**
- Precondition: open; `stage:ready`; label `autopilot`; no open `blocked_by` issue; no open sub-issue; no owning claim.
- With `--role frontman` the precondition is instead: open; `stage:intake`; label `request`; no `proposed` label; no owning claim. It needs no `autopilot` label, and the claim comment carries `role=frontman` (phase 5, section 6).
- Writes a claim comment, then `--add-label stage:working --remove-label stage:ready --add-assignee @me` (`stage:intake` for a frontman).
- Comment:
  ```
  <!-- desk:claim id=c_8f3a2b machine=zeus task=task_x dispatch=ctx_y at=2026-10-16T14:02:00Z -->
  Claimed by a worker on **zeus** (Orca task `task_x`, dispatch `ctx_y`).
  <!-- desk:agent -->
  ```
- Race: two claims can land between one read and the next. The second read keeps the earliest claim after the newest release. A loser posts `desk:release reason=lost-race` naming its own id and exits 1.
- Prints the claim id.

**`desk park <n> --dispatch <d> --card <file> [--card <file>…] [--proposed-body <file>]`**
- Precondition: `stage:working`; the owning claim's dispatch is `<d>`.
- Validates each card before posting anything. The card shape is the decision comment in `desk.md`, which follows [the cards rule](../../modules/core/rules/cards.md): marker; `**Kind:** code-detail` or `**Kind:** design`; background; an `**Already checked:**` line; one question; at least two numbered options, or a line saying options cannot be enumerated. A code-detail card carries a `**Recommendation:**` line. A design card carries no recommendation line and does carry a `<details><summary>What would I pick?</summary>` block. Every numbered option ends with a say-back line, `→ <the answer said back in one line>`, on the option's own line or the line below it, unless the card says its options cannot be enumerated. A card that fails validation exits 1 and names the missing part.
- Posts each card with `card=<claim>-<k>` on its marker, then the proposed body, then moves `stage:working` to `stage:needs-you`.
- The worktree stays. The next attempt resumes in it.

**`desk done <n> --dispatch <d> --pr <number> --summary "<one sentence>" (--picture <url>… | --no-picture "<why>") --checked "<text>" [--see "<how to see it>"]`**
- Precondition: `stage:working`; the owning claim is `<d>`'s; the pull request is open, not a draft, and its body's first line is `closes #<n>`; GitHub does not report it `CONFLICTING`.
- Composes the result comment (section 3), posts it, then moves `stage:working` to `stage:check`. Exits 2 without `--checked`.

**`desk fail <n> --dispatch <d> --reason <file>`**
- Precondition: `stage:working`; the owning claim is `<d>`'s.
- Posts `<!-- desk:failed claim=<id> attempt=<k> -->` with what was tried and why each try failed, then moves the stage back to `stage:ready` (`stage:intake` for a frontman's claim). The coordinator reads the attempt count and escalates (section 4).

**`desk release <n> --reason <silent-machine|no-worker|stopped|lost-race|answered|reopened> [--claim <id>]`**
- Used by the coordinator and the watchdog, never by a worker on its own claim. `answered` is written only by `desk answer`, and `reopened` only by `desk reopen`.
- Without `--claim`: precondition `stage:working`; releases the owning claim. Releasing the owning claim also releases every later unreleased claim with reason `lost-race`, so a dead race loser never inherits the issue.
- With `--claim <id>`: the claim must be unreleased, at any stage. This is how an orphaned claim is cleared when a worker died between its claim comment and its label write, which leaves `stage:ready` with a live claim.
- Posts `<!-- desk:release claim=<id> reason=<reason> -->`. The stage moves from `stage:working` to `stage:ready` (`stage:intake` for a frontman's claim) only when the issue is `stage:working` and no unreleased claim remains. Releasing a lingering race loser changes no label.
- `desk fail`, `desk answer` and `desk reopen` close every unreleased claim, not only the owning one, so a race loser whose own release failed cannot take the issue over.

**`desk intake --words <file> --ask <ask:everything|ask:choices|ask:own-feel>`**
- Files a new request from the desk (phase 5, section 6): labels `request,stage:intake,priority:P2,<ask>` and no `autopilot`, a title of the first 60 characters of the line, and the body `## Your words`, the line verbatim, then empty `## Decisions` and `## Small calls`. Prints the issue number.

**`desk accept <n>`** and **`desk drop <n>`**
- Precondition for both: open; `stage:intake`; label `proposed`.
- `accept` removes `proposed` and leaves `stage:intake`, so the frontman picks the request up.
- `drop` closes the issue as not planned, then swaps `stage:intake` and `proposed` for `stage:done`. A rerun after the close finishes the labels.

**`desk ready <n> --dispatch <d> --points <1|2|3|5|8|13> --type <feature|change|fix|chore|docs|refactor> --body <file>`**
- The frontman's end. Precondition: `stage:working`; the owning claim is `<d>`'s and has `role=frontman`.
- First writes `--body` as the new issue body, refusing (exit 1, nothing changed) when it changes `## Your words` (or `## Problem` when the issue has no such section) or drops a `## Decisions` or `## Small calls` line, and checking the edit afterwards like `desk answer` does. Then releases the claim with reason `ready` (not an attempt), then adds `autopilot`, `points:<k>`, `type:<type>` and `stage:ready`, and removes `stage:working`, any earlier `points:*` and any other `type:*`. A rerun after the release but before the label edit finishes the label edit. The `autopilot` label is Milky's consent, given when Milky answered the frontman's "Is this what you meant?" or pressed ✓ start.

**`desk note <n> --dispatch <d> "Auto-decided: X over Y because Z"`**
- Precondition: the owning claim is `<d>`'s. The line must start with `Auto-decided:` and contain ` over ` and ` because `.
- Appends `- <date>: <line>` to the body's `## Small calls` section, creating the section if it is missing. The program edits no other part of the body. The body is re-read right before the edit and again after it; if the body's `userContentEdits.totalCount` moved by anything but our own edit (GitHub records 0 at creation, 2 after the first edit because the first edit also stores the original body, then 1 per edit), or an earlier `## Small calls` or `## Decisions` line is gone, the command exits 4 (`desk answer` follows the same rule for `## Decisions`). `desk answer` is idempotent on retry: when the newest human comment after the latest decision card is already the same answer, and `## Decisions` already holds the decision, it skips those two writes and continues with the claim releases and the stage move.

**`desk answer <n> --body <file> --decision "<one line>" [--card <id>]`**
- The human's side, called by `/decisions` and the desk app. `--decision` is the say-back line of the option chosen, or the typed text for an "other…" answer.
- Precondition: `stage:needs-you`.
- `--card <id>` names the card answered and must be a card of the newest park. Without it the only open card is answered; with two or more open cards the command exits 1 and lists their ids. With the newest park fully answered and `--card` absent, the last card is the target, so a rerun after a crash posts nothing twice.
- Posts the answer as `<!-- desk:answer card=<id> -->` plus the text, with no agent marker, and appends `- <date>: <decision>` to the body's `## Decisions` section. A card already answered with different text exits 1.
- While another card of the newest park is still open, it stops there and the request stays on `stage:needs-you` with its claim.
- Once no card is open, posts `<!-- desk:release claim=<id> reason=answered -->` for every unreleased claim, then moves the stage to `stage:ready`, or to `stage:intake` when the claim that parked the newest cards had `role=frontman` (read from the card's `claim=`, so a claim released or a crash in between changes nothing). The release is what lets the next `desk claim` pass its "no owning claim" check. A release with `reason=answered` is not counted as an attempt.

**`desk propose --from <n> --title "<title>" --type <type> --body <file>`**
- Files a side topic as a proposed request. The body must contain `## Problem`.
- Labels: `request,proposed,stage:intake,priority:P2,type:<type>`. No `autopilot` label, no points, so nothing claims it before Milky says yes.
- Posts `<!-- desk:proposed-request issue=<new> -->` on `#<n>`, so the request that found the topic records it.

**`desk picture <n> <file>`**
- Uploads the file through the GitHub contents API to the orphan branch `desk-pictures`, at `<n>/<file-name>`, creating the branch on first use (relayed, as a small call by the coordinator).
- Prints `https://github.com/<owner>/<repo>/blob/desk-pictures/<n>/<file-name>?raw=true`, which the result comment embeds.
- Nothing enters `main`. Deleting the branch prunes every picture.

**`desk reopen <n> --comment <comment-id>`**
- The "no, because…" path. Precondition: `stage:check`.
- Posts `<!-- desk:reopen comment=<id> -->` quoting Milky's reason, posts `<!-- desk:release claim=<id> reason=reopened -->` for the owning claim, then moves the stage to `stage:ready`. The next worker's brief carries the reason.

**`desk merge <n>`**
- Precondition: `stage:check`, and either the newest human comment is newer than the result comment and starts with `looks good` (relayed), or the request lands automatically (`land:auto`, or the project default when no landing label is present) and no human comment is newer than the result.
- Preconditions for both landings: the pull request named by the result is open and is not a draft. An automatic landing also needs that pull request in the issue's closing pull requests. Any failure on an automatic landing that is not a refusal, including a network failure or a head that moved, posts one `desk:autoland blocked=<merge|check|review|ci|error>` comment, exits 0 and hands the request to Milky at `stage:check`. A second automatic attempt for the same result is refused, except one more try after a `desk:review verdict=clean` comment newer than a `blocked=review` attempt. Step 7 also refuses when the result changed during the checks.
- Landing: `land:check` is the human-merge flow above. `land:auto` merges when the checks pass. The label and the `- land:` line under `### Coordinator` are read by `landingOf`: the request label wins, both labels count as `land:check`, and no line means `land:check`.
- Steps:
  1. Create a temporary worktree of the pull request's branch on the coordinator's machine, at `../<worktree-dir>/merge-<n>`.
  2. `git merge origin/main`. A conflict exits 1 with the conflicting files. The coordinator sends the request back to a worker (section 4).
  3. Run the project's check command from `## desk` (default `mise run check`). A failure exits 1 with the first failing line. The command runs in its own process group and the whole group is killed after `--check-timeout` (default 20 minutes), which counts as a failure.
  4. For an automatic landing only: when the diff against `origin/main` touches a `### Review paths` glob, the newest `desk:review pr=<n>` comment newer than the result must say `verdict=clean`.
  5. Push.
  6. Read the pushed commit's checks. No workflow configured: print `no CI configured`. Actions disabled or blocked by billing: print `CI blocked`. Either fact goes into the merge comment, and neither waits, because the local check in step 3 already ran (relayed). With workflows configured and not blocked, poll the pushed commit's check runs every 20 seconds until they finish. A failure exits 1, and so does `--ci-timeout` (default 20 minutes) running out on a run that started. When no check run exists for the commit after 2 minutes (path-filtered workflows), merge reports `no CI ran for this change` with `ci=none` and relies on the local check.
  7. Re-read the issue. Exit 1 unless it is still `stage:check` and the approval still holds (a `looks good` newer than the result, or an automatic landing with no human comment newer than the result), because the local check takes minutes and a `no, because …` may have arrived meanwhile.
  8. `gh pr merge <pr> --merge --match-head-commit <sha>`, where `<sha>` is the commit that passed the check, so a push after the check cannot merge unchecked. Merge commits only; the kit never squashes or rebases.
  9. Post `<!-- desk:merge pr=<pr> ci=<passed|none|blocked> check=<passed> -->`, then run `desk land <n>`.
  10. Remove the temporary worktree.

**`desk land <n>`**
- Precondition: for an open issue, the pull request named by the newest `desk:result` comment is merged, and no `desk:reopen` or `desk:claim` comment is newer than that result, so an old merged pull request on a reopened request never counts. For a closed issue, any merged linked pull request counts, which covers work merged by hand. The Orca Run is resolved before the first GitHub write. Idempotent.
- Moves the stage to `stage:done` and closes the issue with `Merged.` if it is still open.
- Releases the Orca worker named by the owning claim (`orca orchestration worker-release --dispatch <d>`) and removes its worktree (`orca worktree rm`). It also removes every other worktree of the issue in the same repository (matched as above), such as the one a parked request kept, so no worktree for the issue number remains. A worktree with a live terminal in it is skipped. A failed Orca step prints its error and exits 3. The GitHub state is already correct, so the next pass retries only the cleanup.
- Before removing any local worktree, kept or not, land inspects it with `git status --porcelain` and the branch's unpushed commits (against `@{upstream}`, or `origin/main` when there is no upstream). A clean worktree is removed. A worktree holding only untracked files is removed with `--force`; land lists the deleted paths in its output and in a comment on the issue. A worktree with modified tracked files or unpushed commits is kept: land prints `worktree-kept <path>: <reason>` for each one kept, comments each reason on the issue once, and exits 0, because retrying cannot succeed.
- Git cannot run on a remote machine from the coordinator, so a remote worktree is removed without `--force`. If Orca refuses because the worktree is dirty, it is kept with Orca's message as the reason. Any other failure (host offline, timeout) exits 3 and the next pass retries it.
- Pressing Merge in the GitHub app ends here too: the next reconcile pass sees the merged pull request and runs `desk land` (relayed).

**`desk status <n>`**: read-only. Prints the stage, the owning claim, the attempt count, the last human comment, and the linked pull request.

**`desk reconcile`**: read-only. Prints the mismatch list (section 4).

**`desk digest [--send]`**: section 7.

**`desk ping "<message>"`**: section 7.

**`desk preflight --role <coordinator|worker> [--ping]`**: section 5.

**`desk watch [--max-wait 30m]`**: section 6.

**`desk run`**: finds the Orca Run whose objective is `desk <owner>/<repo>`, creating it if none exists, and binds the calling terminal with `orca orchestration run-use`. A fresh coordinator gets the same Run, so unread mail survives a crash. Mail is still never the record.

**`desk migrate`**: moves a consuming project onto this phase. It rewrites `autopilot.md` to `desk.md` in `.claude/rules.manifest`, runs `mise run rules:link`, and edits every open issue's agent comments from `<!-- autopilot:* -->` to `<!-- desk:* -->`. It prints each change. With `--dry-run` it changes nothing.

## 3. Issue-first results

A worker records its outcome on the Issue before it sends `worker_done`. Exactly one of three commands ends every attempt:

| Outcome | Command | Stage after |
|---|---|---|
| Built, pull request ready | `desk done` | `stage:check` |
| Needs a decision | `desk park` | `stage:needs-you` |
| Could not finish | `desk fail` | `stage:ready` |

Two more things land on the Issue during the work, not at the end. Each small call goes to `## Small calls` through `desk note` at the moment it is made. Each side topic becomes a proposed request through `desk propose`.

`worker_done` is a doorbell. Its body names the issue and the stage it moved to (`#12 → stage:check`). The coordinator never reads state from it.

`desk done` writes this comment:

```markdown
<!-- desk:result claim=c_8f3a2b pr=45 -->
## Done, check it

<one plain sentence on what changed>

![after](https://github.com/<owner>/<repo>/blob/desk-pictures/12/after.png?raw=true)

**See it yourself:** `mise run dev`, then open /login
**Pull request:** #45
**Decisions used:** every line of `## Decisions` in the description, copied, or `none`
**Small calls:** 3, listed under `## Small calls` in the description
**Verified by desk:** the pull request is not `CONFLICTING`, and its head contains main at abc1234 (`behind_by` 0).
**Worker says:** nothing used was removed upstream; nothing contradicts `## Decisions`.
**Proposed requests:** #51

Reply `looks good` to merge, or `no, because …` to send it back.

<!-- desk:agent -->
```

`Worker says` is the text of `--checked`, the worker's own statement of the judgment checks. `Verified by desk` holds only what the program proved itself, so the comment never presents a claim as verified that nobody checked. With `--no-picture`, the picture line reads `No picture: <why>`. The worker rule says visual work always has a picture.

The `## Decisions` and `## Small calls` sections in the Issue body are owned by the program. `desk answer` and `desk note` append to them; nothing else edits the body, except the approved proposed-body flow in `/decisions`.

## 4. The reconciling coordinator

The coordinator is a Sonnet session at medium effort (plan), started with `/milky-kit:desk` on the project's pinned machine. It remembers nothing between passes. Every pass reads GitHub and Orca, computes the difference, and fixes it.

### One pass

1. `desk preflight --role coordinator --ping`. A failure stops the pass; the ping carries the fix.
2. `desk run`, on the first pass of a session.
3. `desk reconcile --json`.
4. One action per mismatch, from the table below.
5. `desk digest --send`.
6. Start `desk watch` in the background (Bash `run_in_background`) and end the turn. The coordinator spends no tokens while the watchdog waits. The watchdog's exit re-invokes the coordinator, which starts the next pass at step 1.

### Inputs

- **GitHub**: one GraphQL query for every open issue with its labels, assignees, body, the last 50 comments, and `closedByPullRequestsReferences` with each pull request's state, draft flag and mergeable state. Plus closed issues whose stage is not `stage:done`.
- **Orca**: `orca orchestration worker-list --run <run> --include-remote --json`, every page, always with the `desk <owner>/<repo>` Run (the commands refuse when it does not exist, and when Orca reports the list covered every Run), so another project's worker is never joined to this project's issue. It is joined with `task-list` for task titles. A worker belongs to issue `#n` when its task title starts with `#n ` (the coordinator sets that title at start) or when the owning claim on `#n` names its dispatch id.
- **The `## desk` section** of `CLAUDE.md`, for the machines and the worker limit.

### The diff

| Code | GitHub says | Orca says | Action |
|---|---|---|---|
| `dispatch` | `stage:ready`, `autopilot`, unblocked, no open sub-issue | no live worker for `#n` | Route (`reference/routing.md`), then `worker-start` (below). Only while live workers are under the machine's limit. |
| `escalate` | as `dispatch`, attempts ≥ 2 | no live worker | Dispatch one tier up: Haiku to Sonnet. A Sonnet request at 2 attempts goes to the coordinator itself, which parks it with a card listing what was tried (plan). |
| `orphan-claim` | `stage:working`, owning claim names dispatch D | D is `exited`, released or absent, and the claim is older than 10 minutes. A claim on a remote machine whose worker row is absent becomes `remote-claim-unseen` instead: report only, because a missing remote row may only mean the remote listing is incomplete, and the silent-machine rule releases the claim if the machine goes silent. | `desk release --claim <id> --reason no-worker`. It becomes `dispatch` or `escalate` on the next pass. |
| `intake` | `stage:intake`, label `request`, no `proposed` label, no open card | no worker for `#n` that is not gone | Start a frontman worker (Opus, high effort) that runs `desk claim --role frontman`. Only while live workers are under the machine's limit. A worker for `#n` started more than 10 minutes ago that never claimed becomes `unclaimed-worker`. |
| `intake-stuck` | as `intake`, with 2 or more releases or failures since the newest human comment | no worker for `#n` that is not gone | Change nothing. The digest reports it once. Opus has no tier above it, so a person looks. |
| `answered-not-requeued` | `stage:needs-you`, every card of the newest park has a `desk:answer` | any | Change nothing. The digest reports it once; a person reruns `desk answer` for the last card, which finishes the requeue. |
| `unclaimed-worker` | `stage:ready` or an `intake` request | a live worker titled `#n`, started more than 10 minutes ago | The worker never claimed. Read the tail of its terminal, `worker-stop` it, and let the next pass dispatch again. |
| `unrecorded-result` | `stage:working`, claim names D | D sent `worker_done`, or sits idle at its prompt | Send to D's terminal: "Record your result on #n with desk done, desk park or desk fail (desk ready, desk park or desk fail for a frontman), then send worker_done again." If the terminal is gone, `desk release --reason stopped`. |
| `parked-worker` | `stage:needs-you`, claim names D | D is live | `worker-release --dispatch D`. The worktree stays for the next attempt. |
| `looks-good` | `stage:check`, newest human comment starts `looks good` | any | `desk merge`. On a conflict or failing check, dispatch a merge worker (Sonnet, low effort) into the request's worktree. |
| `rejected` | `stage:check`, newest human comment's first word is `no` | any | `desk reopen`. |
| `conversation` | `stage:check` or `stage:needs-you`, a human comment that is neither | any | Forward the comment to the request's worker if it is live. Otherwise dispatch a reply-only worker (Sonnet, low effort): answer on the Issue, change no code, move no stage. |
| `merged` | the pull request named by the newest result is merged, no reopen or claim is newer, stage not `stage:done` | any | `desk land`. |
| `auto-land` | `stage:check`, landing is `land:auto`, no human comment after the result, no `desk:autoland` comment after the result | any | `desk merge`. |
| `check-red` | `stage:check`, pull request `CONFLICTING` | any | Send the request back to its worker if live, otherwise dispatch a merge worker (Sonnet, low effort). |
| `stray-worker` | issue closed or `stage:done` | a live worker for `#n` | `worker-stop`, then `worker-release`. |
| `human-claimed` | `stage:working` with no `desk:claim` comment | any | Change nothing. Report it in the digest pass. A person or another session claimed it with plain `gh`, and desk does not own work it did not claim: never release, requeue or dispatch it. |
| `remote-claim-unseen` | `stage:working`, owning claim on a remote machine | no row for dispatch D | Change nothing. The digest reports it once. |
| `bad-labels` | an open issue with no `stage:*` label, or more than one | any | Change nothing. Report it in the digest. The program does not guess which stage is right. |

`stage:backlog`, `stage:done` and a `proposed` request at `stage:intake` are ignored. A `desk:answer` comment is not a `conversation`, because it answers a card. A `stage:needs-you` issue with no worker needs nothing but the digest.

`desk reconcile` computes the codes. The coordinator chooses the model and writes the brief. The program never decides routing.

### Starting a worker

`desk reconcile` computes the worktree arguments, because a script moves state and the model executes (robustness rule 3). A `dispatch` or `escalate` mismatch carries `workerStart`:

- A request that already has a worktree gets `--worktree path:<that worktree>`. The worktree is found in `orca worktree ps`, which lists every repository Orca knows, so only rows of the coordinator's own repository on the local host count. A row joins the issue when its directory name and its branch name both are `<n>` or `<n>-<digits>` (the name Orca gives a second copy), with the plain `<n>` preferred. A hand-made `16-experiment` never joins. The main checkout is never chosen. A truncated list stops the pass instead of guessing.
- Any other request on the coordinator's machine gets `--worktree new-child --name <n> --base-branch main`.
- A request on another machine gets `--on <environment> --worktree new-top-level --repo <the repository selector from ## desk>`, because Orca refuses `new-child` remotely. The coordinator cannot list a remote machine's worktrees, so a remote request always starts a new one.

The coordinator runs the command as given and adds only the model and effort from routing:

```
orca orchestration worker-start \
  --spec "<brief>" --task-title "#<n> <issue title>" \
  --agent claude --model <model> --effort <effort> \
  <workerStart arguments> --json
```

Orca refuses `--model` with `--terminal`, not with an existing worktree. Compare `launch.requested` with `launch.effective` in the receipt before reporting a model.

The brief carries paths, never file contents (plan). It names: the issue number and repository; the machine name to pass to `desk claim`; the full path of `desk`; the rule `.claude/rules/desk.md`; the ask setting from the issue's `ask:*` label or the project default; and, for a reopened request, the id of Milky's reason comment.

### A fresh coordinator after a crash

A fresh coordinator runs the same pass. It needs no handoff file and no transcript, for four reasons:

- Claims, attempts, results, cards, answers and pinged markers live in Issue comments.
- Running workers live in Orca's database, and `desk run` rebinds the same Run.
- The coordinator lock (section 8) treats a dead holder as free.
- Mail it never read changes nothing, because mail was never the record.

## 5. Preflight

`desk preflight --role <coordinator|worker>` runs every check, never stopping at the first failure, so one run lists every fix. It prints one line per check:

```
ok    gh logged in
FAIL  serena not connected · fix: claude mcp add serena -- serena start-mcp-server --context=claude-code --project-from-cwd
```

It exits 1 if any check failed. With `--json` it prints `[{check, ok, detail, fix}]`.

| Check | Role | How | Fix printed |
|---|---|---|---|
| bun | both | the shim | `mise use -g bun` |
| kit present | both | `~/.claude/kit/modules/desk/bin/desk` resolves | `git clone https://github.com/milkyskies/milky-kit ~/Code/Projects/milky-kit && ln -s ~/Code/Projects/milky-kit ~/.claude/kit` |
| kit current | both | `git -C ~/.claude/kit fetch -q` then not behind `origin/main` | `git -C ~/.claude/kit pull` |
| Orca running | both | `orca status --json`, `result.runtime.reachable` is true | `orca open` (or start the Orca app) |
| gh logged in | both | `gh auth status` exits 0 | `gh auth login` |
| repository writable | both | `gh repo view --json viewerPermission` is `WRITE`, `MAINTAIN` or `ADMIN` | names the permission seen |
| rules linked | both | every `.claude/rules/*.md` resolves | `mise run rules:link` |
| Serena connected | worker | `claude mcp list` has a `serena:` line containing `Connected` | the `claude mcp add` line for Serena |
| other MCP servers | both | each name under `### Preflight` `mcp:`, same parse | `claude mcp list` and connect `<name>` |
| mise tools | both | `mise ls --missing` prints nothing | `mise install` |
| project needs | both | each command under `### Preflight` exits 0 | the fix written beside it |
| ## desk section | coordinator | parses, with no unknown keys | names the bad line |
| labels | coordinator | every label in `setup-labels.sh` exists | `bash .github/scripts/setup-labels.sh` |
| pinned machine | coordinator | `orca host list` local `machineName` equals the coordinator machine in `## desk` | `start the coordinator on <machine>` |
| coordinator lock | coordinator | section 8 | `stop the coordinator in Orca session <id> first` |
| worker machines | coordinator | `orca status --environment <m> --json` reachable, for each remote machine in `## desk` | `connect <m> in Orca` (the machine is skipped this pass rather than failing it) |
| ping configured | coordinator | `DESK_NTFY_URL` and `DESK_NTFY_TOPIC` set | the setup step in section 7 |

`claude mcp list` starts the stdio servers, so it costs a few seconds. Its exit code is 0 even when a server is down; the check parses the line.

### The single ping

`--ping` sends one ping when anything failed. The ping names the project, the machine, the count, and the fixes, joined by ` · `, cut to 200 characters (`kansai-2 on zeus: 1 fix · mise install`). A fix command is not secret, so it may appear; issue titles never do.

The same set of failed checks on the same machine pings once per 6 hours. The record is a local file, `~/.local/state/desk/<owner>__<repo>/preflight-pinged.json`. Losing the file costs one extra ping, never a lost one.

### Who runs it

- **The coordinator** runs it first in every pass. A failure means nothing is dispatched.
- **Every worker** runs `desk preflight --role worker --ping` as its first step, before `desk claim`. On failure it claims nothing, sends `escalation` with the output, then `worker_done --outcome failed`.
- **The coordinator runs the worker checks locally** before dispatching to its own machine, so a local failure never becomes a dispatch-and-fail loop.
- **A remote worker's preflight failure** takes that machine out of rotation for the rest of the coordinator session. A fresh coordinator tries the machine once more. The loop is bounded at one failed worker per session per machine.

## 6. The watchdog

`desk watch` is `~/.claude/scripts/orca-watchdog.py` ported into the program and extended. It is a loop in a background process. It costs no tokens while it waits. It exits with one JSON line per event, which wakes the coordinator.

### Reused from `orca-watchdog.py`

- A 30-second poll.
- The mailbox read that drops heartbeats and the coordinator's own messages (`from_handle` starting `run:`).
- The seen-ids ledger, so a message the coordinator already handled wakes it once across every run of the watch. The ledger moves to `~/.local/state/desk/<owner>__<repo>/watch-seen.json`. Losing it costs one extra wake.
- A failed mailbox read is skipped, never taken as an empty mailbox.
- The idle rule: a worker seen working that stops at its prompt wakes the coordinator at once. A worker already idle when the watch started wakes it only after 10 minutes, so a worker somebody is talking to does not trigger a wake.
- The agent terminal is the one whose title is not a path.

### Changed from `orca-watchdog.py`

- The watch list comes from the claims on `stage:working` issues, not from an argument.
- Idle comes from `orca worktree ps --json` (`agents[].state` is `done` or `working`) instead of the `✳` title prefix, which nothing documents.
- Remote workers come from `worker-list --include-remote`.

### What silence means

| Silence | Rule | Watchdog does |
|---|---|---|
| A worker stopped | seen working, now idle at its prompt | wakes: `worker-stopped` |
| A worker never started | idle for 10 minutes from the start of the watch | wakes: `worker-idle` |
| A worker hung | working, but no heartbeat for 20 minutes (the preamble sends one every 5) | wakes: `worker-hung` |
| A worker gone | `projection.liveness.verdict` is `exited` | wakes: `worker-gone` |
| A machine gone | `orca status --environment <m>` unreachable on every poll for 15 minutes. A poll counts only when the local `orca status` answered and reachable; a failing local Orca skips the poll and clears the machine's unreachable start, so silence must be confirmed for a full 15 minutes again, because it says nothing about the remote machine. | runs `desk release --claim <id> --reason silent-machine` for each claim on that machine, then wakes: `machine-silent` |

A reachable machine whose worker is merely quiet is the stalled-worker case, never a hand-back (relayed).

### What else wakes it

The watchdog polls GitHub once a minute, which is far under the rate limit:

- A new human comment on a `stage:needs-you` or `stage:check` issue: `human-comment`.
- An issue newly at `stage:ready`, such as a request Milky moved back after answering: `ready`.
- A request that is dispatchable when the watchdog starts, such as one the coordinator just released: `ready`. A request held back because every worker slot is full does not wake it.
- A linked pull request newly merged: `merged`.
- Unseen mail from a worker: `mail`.
- Nothing for `--max-wait` (default 30 minutes): `tick`. The coordinator runs a full pass anyway, so anything the watchdog missed is still found.

## 7. Pings

Two kinds only (plan): needs a decision, and done, check it. Preflight failures and a silent machine also ping, because each one stops work until Milky acts.

### Transport

`desk ping "<message>"` posts to ntfy (relayed). It reads three environment variables from `~/.config/desk/.env`, which the program loads itself, because the ping target belongs to the person, not to one project:

```
# ntfy server: a self-hosted one such as http://ceres:8091, or https://ntfy.sh
DESK_NTFY_URL=
# The topic name. Never a guessable word.
DESK_NTFY_TOPIC=
# optional — an access token, required for a reserved ntfy.sh topic
DESK_NTFY_TOKEN=
```

One more key is optional, read by `desk digest`: `DESK_APP_URL`, the desk's address. When it is set, the digest's link is that address instead of the GitHub search below; a link to one auto-merged request stays a GitHub link.

`modules/desk/cli/.env.example` lists the same keys. PushNotification is not a second path: it reaches the phone only when Remote Control is connected, and it skips itself when it judges the user is at the terminal (relayed: one reliable path beats two half-reliable ones).

The message carries the project, the counts and the kinds, plus a link. Never an issue title or body, because the details sit behind GitHub's login (relayed):

```
kansai-2: 2 decisions waiting, 1 done to check
https://github.com/milkyskies/kansai-2/issues?q=is:open+label:stage:needs-you,stage:check
```

### One digest per pass

`desk digest` collects every `desk:decision` and `desk:result` comment without a pinged marker, plus every `bad-labels`, `human-claimed` and `remote-claim-unseen` issue. With `--send` it sends one ping covering all of them, and only after ntfy accepts the ping does it append `<!-- desk:pinged at=<iso> -->` to each comment. A failed send marks nothing, so the next pass retries. A crash between the send and the marks costs one repeated ping, never a missed one.

The pinged marker sits on GitHub, so a fresh coordinator never re-pings what the old one sent.

**Resurfacing**: a card still on `stage:needs-you` 48 hours after its pinged marker counts again in the next digest, and its marker's time is updated. This is the resurfacing mechanism [the cards rule](../../modules/core/rules/cards.md) defers to a later phase, built here because the digest already holds everything it needs.

### Milky's one-time setup

Install the ntfy app on the phone, then choose one of the two lines below.

- **Self-hosted on ceres** (Milky's choice): ntfy runs in Dokploy under the Home project on port 8091, with `NTFY_BASE_URL=http://ceres:8091`, `NTFY_UPSTREAM_BASE_URL=https://ntfy.sh` and its message cache on a volume. The upstream setting exists because Apple lets only ntfy.sh wake the iPhone app; ceres sends ntfy.sh a message id with no text, and the phone fetches the message from ceres. Port 8090 on ceres belongs to Beszel. On every machine that runs the coordinator, write `DESK_NTFY_URL=http://ceres:8091` and a random topic from `openssl rand -hex 12` into `~/.config/desk/.env`. In the phone app, add that server and subscribe to that topic. The port is open on the home network and Tailscale only, so the phone reaches ceres over Tailscale away from home.
- **ntfy.sh with a token**: reserve a topic and create an access token at https://ntfy.sh/account. Write `DESK_NTFY_URL=https://ntfy.sh`, the topic and the token into `~/.config/desk/.env`. In the phone app, log in and subscribe to the topic.

The coordinator's preflight fails with this section's link until one of the two is done.

## 8. Several machines, several projects

Confirmed by the plan author with four additions and one follow-up (relayed):

- **One coordinator per project, pinned to one machine** in the project's `## desk` section.
- **Workers may run on other machines** through Orca connected servers: `worker-start --on <environment>`, with `--worktree new-top-level --repo <selector>`.
- **The claim names the machine**, plus a claim id, the Orca task id and the dispatch id.
- **`desk park`, `desk done` and `desk fail` refuse unless the owning claim is still the caller's.** The worker rule also runs `desk status <n>` right before `git push` and stops if the claim moved. A worker that was handed back while cut off therefore stops, rather than pushing over the new worker.
- **A silent machine** is one whose `orca status --environment <m>` is unreachable for 15 minutes in a row. The watchdog hands its claims back to `stage:ready`.
- **Preflight refuses a coordinator on any machine but the pinned one**, and names the pinned machine.
- **A lock file stops a second coordinator on the pinned machine.** The file is `~/.local/state/desk/<owner>__<repo>/coordinator.lock`, holding `{pid, orcaSessionId, startedAt}`. The pid is the ancestor `claude` process of the session, and the session id comes from `orca status --json` (`caller.orcaSessionId`). Preflight treats the lock as free when that pid is dead, so the kill test's dead coordinator never blocks the fresh one. The skill's stop step deletes the lock.
- **A worker machine needs the kit and bun.** Worker preflight checks `~/.claude/kit` and bun on that machine.

### Several projects

Each project has its own coordinator, its own Orca Run (`desk <owner>/<repo>`), and its own lock. Two projects may pin their coordinators to the same machine. Pings carry the project name first, so one ntfy topic serves every project. The desk app in phase 5 reads every project's Issues; nothing in phase 2 needs a cross-project view.

## 9. The `## desk` section

Each project's `CLAUDE.md` carries this section. `modules/desk/desk-section.md` is the template. The program parses `### Coordinator`, `### Machines` and `### Preflight`; an unknown key there fails preflight. The coordinator reads the other subsections as prose.

```markdown
## desk

### Coordinator
- machine: Minerva
- ask: ask:choices
- check: mise run check

### Machines
- Minerva: workers 3
- zeus: workers 2, repo `~/Code/Projects/kansai-2`

### Hard areas
- `apps/api/src/domain/**` - business rules; nothing to copy

### Review paths
- `apps/api/drizzle/migrations/**`

### Routing
| Work | Model | Effort |
|---|---|---|
| 3D: models, characters, Blender | Opus | high |

### Preflight
- `pg_isready -h localhost -p 5432` - fix: `docker compose up -d db`
- mcp: serena, blender

### Blocked commands

### Holds
```

| Key | Meaning |
|---|---|
| `machine` | The Orca `machineName` the coordinator is pinned to. Required. |
| `ask` | The default ask setting: `ask:everything`, `ask:choices` or `ask:own-feel`. A request's own `ask:*` label wins. Required. |
| `check` | The local check command `desk merge` runs. Default `mise run check`. |
| `land` | The landing for a request with no landing label: `land:check` or `land:auto`. Default `land:check`. |
| `### Machines` lines | One per machine that runs workers: the worker limit, and for a remote machine the repository selector Orca uses there. With no `### Machines`, workers run only on the coordinator's machine, 3 at a time. |
| `### Hard areas` | Path globs where the routing table's "hard area" row applies. |
| `### Review paths` | Path globs that bring in the standing reviewer. One backticked glob per line. `desk merge` reads them for an automatic landing. |
| `### Routing` | Extra rows, read before the kit's table and winning over it. |
| `### Preflight` | A command and its fix per line; `mcp:` names MCP servers workers need beyond Serena. |
| `### Blocked commands`, `### Holds` | Reserved for the desk guard hook (section 11). Nothing reads them yet. |

`## Implementation tiers` and `## Correctness-critical paths` from the old autopilot rule are replaced by `### Hard areas` and `### Review paths`.

## 10. Where phase 3's files live

Phase 3 merges kansai-2's `shachi` skill and the global `orch-milky` skill into routing, review and token rules loaded on demand. Those files are:

- `skills/desk/reference/routing.md`: the plan's routing table and escalation rule, the area-table text moved from `autopilot.md`, then phase 3 adds orch-milky's worker reuse, `/clear` before an unrelated task, and `launch.requested` against `launch.effective`.
- `skills/desk/reference/review.md`: the plan's review paragraph and the review-pass text moved from `autopilot.md`, then phase 3 adds orch-milky's silent-and-costly standard and the standing reviewer's lifecycle.
- `skills/desk/reference/tokens.md`: the plan's token bullets, then phase 3 adds what shachi and orch-milky carry.

Phase 2 creates all three with the moved text, so phase 3 starts by editing existing files. `SKILL.md` says when to read each one: routing before every `worker-start`, review when a pull request touches a review path, tokens before writing a brief or reusing a worker.

The files live in the skill because only the coordinator reads them. A rule in `.claude/rules/` would load on every turn of every worker. The few token rules a worker needs (pass paths, not contents) sit in `desk.md`.

## 11. The `ebihara-cool.sh` hook

Not in phase 2 (relayed). `ebihara-cool.sh` refuses whole-game commands, and it honours a coordinator hold file that lets one worktree at a time launch the engine. The kill test needs neither.

Phase 2 reserves `### Blocked commands` and `### Holds` in the `## desk` format, so the format is stable. Issue #169 describes the generic `desk guard` hook that would read them. It is filed as `proposed` on `stage:backlog`, so it waits for Milky's yes. ebihara keeps its own hook until then.

## 12. The kill test

The kill test proves the done criterion: killing the coordinator mid-run and starting a fresh one loses nothing. It runs against a scratch repository, so no real project is touched.

### Setup

1. Create the private repository `milkyskies/desk-killtest` from the `bun-scripts` template with the `desk` module, and run `bash .github/scripts/setup-labels.sh`.
2. Add a `## desk` section: `machine: Minerva`, `ask: ask:choices`, `check: bun test`. Add `zeus: workers 1, repo <selector>` under `### Machines` if zeus is connected.
3. File three issues, each `request,stage:ready,autopilot,priority:P2,points:1`:
   - **A** "Add a `greet` script that prints Hello" with a test. Expected to finish.
   - **B** "Add a `farewell` script" with `ask:everything` and a body that leaves the farewell word open. Expected to park a card.
   - **C** "Add a `count` script that prints 1 to 10" with a test. Expected to be mid-work at the kill.
4. Start the coordinator: `/milky-kit:desk` in an Orca terminal in the repository's root checkout.

### Kill

5. Wait until A, B and C are all `stage:working`, each with one claim (`desk status <n>`).
6. Close the coordinator's Orca terminal. Leave the watchdog to die with it.
7. While no coordinator runs, wait until A is `stage:check` and B is `stage:needs-you`. Both workers send `worker_done` into a mailbox nobody reads.
8. Check the lock file still names the dead pid.

### Restart

9. Open a new Orca terminal in the same checkout and start a fresh session with no context. Run `/milky-kit:desk`.
10. Before its first pass, drain the mailbox unread: `orca orchestration check --json`, then `--ack` the delivery. This proves the pass needs no mail.

### Assertions after the first pass

11. Preflight passed; the stale lock was taken over (the lock file names the new pid).
12. `desk reconcile --json` lists no mismatch except ones the pass is still acting on.
13. A is `stage:check` with exactly one `desk:result` comment. B is `stage:needs-you` with exactly one `desk:decision` comment. C is `stage:working` with exactly one claim.
14. `orca orchestration worker-list --include-remote --json` shows exactly one live worker for C, and none for A or B.
15. Exactly one digest ping arrived after the restart, reading `desk-killtest: 1 decision waiting, 1 done to check`, and both comments now carry a pinged marker.

### Finish

16. Answer B with `/decisions`. B returns to `stage:ready`, is dispatched again in its kept worktree, and reaches `stage:check`.
17. Comment `looks good` on A. A is merged with a merge commit, `stage:done`, closed, and its worktree removed.
18. Comment `no, because the count should start at 0` on C once it reaches `stage:check`. C returns to `stage:ready` with the reason, is rebuilt, then `looks good` merges it.
19. Final state: all three issues closed at `stage:done`, no live worker, no worktree left, every ping received once.

### Variants

- **A worker dies**: during step 7, close C's worker terminal. Orca reports a closed worker terminal as a finished worker, so the row is `unrecorded-result` and the action is `desk release --reason stopped`. The fresh coordinator releases C (attempt 1), and the watchdog it starts wakes at once with `ready`, so the coordinator dispatches C again without waiting for the tick.
- **A machine dies** (needs zeus): put C on zeus, then stop Orca on zeus during step 7. After 15 minutes the watchdog releases C with `silent-machine`. Then start Orca on zeus again: the old worker's `desk done` refuses, because the claim moved.
- **Two coordinators**: during step 9, start a second `/milky-kit:desk` on the same machine. Its preflight refuses and names the first session.

## 13. Build split

Five tasks with disjoint files. Models and efforts come from the plan's routing table. The kit itself has no `## desk` section, so review follows the plan's fallback: only where a mistake would be both silent and costly.

| Task | Owns | Model | Effort | Review | Blocked by |
|---|---|---|---|---|---|
| T1 state commands | `modules/desk/bin/`, `modules/desk/cli/package.json`, `tsconfig.json`, `src/main.ts`, `src/github/**`, the commands `claim park done fail release note answer propose picture reopen status` and their tests, the kit `mise.toml` bun pin | Sonnet | medium | standing reviewer | none |
| T2 reconcile, watch, pings, merge | `src/orca/**`, `src/reconcile/**`, `src/watch/**`, the commands `reconcile watch digest ping merge land run` and their tests, `cli/.env.example` | Sonnet | medium | standing reviewer | T1 |
| T3 preflight, project, migrate | `src/preflight/**`, `src/project/**`, the commands `preflight migrate` and their tests, `modules/desk/desk-section.md` | Sonnet | medium | none | T1 |
| T4 rules, skills, rename | `modules/autopilot/**` (deleted), `modules/desk/module.toml`, `modules/desk/rules/desk.md`, `.claude/rules/autopilot.md` → `desk.md`, `skills/desk/**`, `skills/decisions/SKILL.md`, `skills/ship/SKILL.md`, `skills/land/SKILL.md`, `skills/todo/SKILL.md`, `modules/issues/rules/issues.md`, `README.md`, `.claude-plugin/plugin.json` | Sonnet | medium | none | none |
| T5 kill test | `docs/desk/kill-test.md` (the run's record), the scratch repository | Sonnet | medium | none | T1, T2, T3, T4 |

`src/main.ts` loads `./commands/<name>.ts` by name, so T2 and T3 add commands without editing T1's file.

### T1 acceptance

- Every command in its list behaves as section 2 says, against a fake `gh` in tests (a recorded-response stub injected into `src/github/`). No test touches the network.
- A claim whose label write silently fails exits 4 and prints both states. A test proves it.
- Two racing claims: the later one exits 1 and posts a `lost-race` release. A test proves it.
- `desk park` rejects a design card with a `Recommendation:` line, and a code-detail card without one.
- `desk done`, `desk park`, `desk fail` and `desk note` refuse when the owning claim belongs to another dispatch.
- `desk picture` creates `desk-pictures` on first use and returns the link. Milky confirms on the phone that the embedded picture renders in the GitHub app for a private repository. If it does not render there, the result comment shows a plain link to the same file instead (relayed).
- `bin/desk` without bun on `PATH` prints the `mise use -g bun` fix and exits 127.

### T2 acceptance

- `desk reconcile` produces each code in the section 4 table from fixture GitHub and Orca inputs. One test per code.
- `desk reconcile` never reads the Orca mailbox. A test proves it.
- `desk watch` emits each event in section 6 from fixture inputs, and `machine-silent` releases the silent machine's claims first.
- `desk digest --send` marks nothing when the ping fails, and marks every collected comment when it succeeds.
- `desk merge` refuses without a `looks good` comment newer than the result, refuses on a conflict, and reports `no CI configured` or `CI blocked` without waiting.
- `desk land` is idempotent: a second run changes nothing and exits 0.

### T3 acceptance

- Each check in the section 5 table fails with its own fix line, from fixture inputs.
- Every check runs even after an earlier one fails.
- The same failure set pings once in 6 hours.
- A stale lock (dead pid) is taken over; a live one refuses and names the session.
- `desk migrate --dry-run` lists the manifest change and every comment it would edit, and changes nothing.

### T4 acceptance

- No file in the kit names `modules/autopilot`, `autopilot.md` or `<!-- autopilot:`. `grep -rn` proves it. The `autopilot` label stays, because it is the consent gate.
- `desk.md` holds the worker sequence: preflight, claim, read comments (latest wins), work with `desk note` and `desk propose`, check `desk status` before every push, then one of `desk done`, `desk park` or `desk fail` before `worker_done`. It also holds the decision comment with `desk:` markers, an `**Already checked:**` line, and the code-detail and design kinds unchanged from PR #168.
- `skills/desk/SKILL.md` runs the section 4 pass, writes briefs from paths, and says when to read each reference file.
- `skills/desk/reference/` holds the three files with the text moved from `autopilot.md` and the plan.
- `/decisions` parses `desk:` markers and records answers with `desk answer`.
- `/ship` leaves the stage alone when `desk status` shows a claim, so `desk done` moves it. The pointer to the deleted `skills/autopilot/SKILL.md` is gone.
- `/land` calls `desk land`.
- `/todo` points at the new rule path.

### T5 acceptance

- Section 12 runs end to end, every assertion holds, and `docs/desk/kill-test.md` records each step's observed state.
- Each failed assertion is filed as an issue with the observed and expected state, and the run is repeated after the fixes.
- Milky confirms on the phone that each ping arrived once and the picture rendered.

T4 starts at once, alongside T1. T2 and T3 start when T1 merges and run side by side. T5 runs last.

## Open

- **The final names** of the desk, the command and the markers ([the desk plan](plan.md), section 11). A rename is one search-and-replace.

## 14. Small calls made in this design

Each line can be overturned.

- Auto-decided: the worker claims its own issue after preflight, over the coordinator claiming before `worker-start`, because the claim then names a real, running dispatch, and a dispatch that fails to start leaves no claim to clean up.
- Auto-decided: one program with subcommands for state, preflight and the watchdog, over three scripts, because all three share the marker parser and the `gh` and `orca` wrappers.
- Auto-decided: the full path `~/.claude/kit/modules/desk/bin/desk`, over installing `desk` on `PATH`, because the kit symlink already exists on every machine that loads the rules, and a `PATH` install is one more per-machine step.
- Auto-decided: write the comment, then the labels, then re-read, over labels first, because a failed label write then leaves a record the next pass can act on.
- Auto-decided: attempts reset at each human comment, over a lifetime count, because a human answer is new information, and the next attempt deserves the cheap tier again.
- Auto-decided: the pinged marker is an edit to the pinged comment, over a label or a local file, because it survives a coordinator crash and adds no label noise.
- Auto-decided: a reachable machine is never handed back, only a silent one, as relayed; a hung worker on a reachable machine wakes the coordinator instead, over an automatic release, because only the coordinator can read its terminal and judge.
- Auto-decided: a proposed request is `stage:intake`, over `stage:needs-you`, because `stage:needs-you` feeds `/decisions` and the digest's decision count, and a proposal is a yes or no, not a card. The desk guard issue in section 11 is `stage:backlog` because it is deliberately parked, as relayed.
- Auto-decided: `no` counts only as the first word, over a `no` prefix, because "not sure about this" must not reject a request.
- Auto-decided: a conversation comment goes to the request's live worker or to a reply-only Sonnet worker at low effort, over the coordinator answering, because the plan keeps the coordinator invisible to Milky.
- Auto-decided: a human still moves a parked request from `stage:needs-you` to `stage:ready`, through `/decisions` or a label edit, over the watchdog flipping the stage on any human comment, because `autopilot.md` settled that the human flips the stage, and only `stage:check` got explicit phrases.
- Auto-decided: resurfacing after 48 hours in the digest, over waiting for a later phase, because the digest already holds the cards and the pinged times.
- Auto-decided: 10 minutes before an unclaimed claim or an idle worker counts as a problem, and 20 minutes without a heartbeat as hung, over shorter limits, because a worker's preflight with `claude mcp list` and a cold `mise install` can take several minutes.
- Auto-decided: the ping settings live in `~/.config/desk/.env`, over each project's `.env`, because one person's phone serves every project.
- Auto-decided: the reference files live in `skills/desk/reference/`, over `modules/desk/reference/`, because only the coordinator loads them, and a module's files reach projects as rules.
- Auto-decided: the `autopilot` label keeps its name as the consent gate, over renaming it with the module, because renaming a label touches every open issue in every project, and the label's meaning did not change.
- Auto-decided: `desk merge` runs in a temporary worktree on the coordinator's machine, over the request's own worktree, because the request's worktree may sit on another machine.
- Auto-decided: the coordinator, not this design, files the build tasks as issues, because issue filing belongs to the run that schedules them.
- Auto-decided: `desk answer` releases the parked claim, over `desk claim` treating old claims as stale, because every state change stays an explicit comment.
- Auto-decided: the result comment splits `Checked before done` into `Verified by desk` and `Worker says` (a required `--checked` flag), over one line the program writes, because the program can prove only the conflict state and main's ancestry, and the judgment checks must not read as verified.
- Auto-decided: `desk merge` polls the pushed commit's checks to completion with a 20-minute timeout when workflows exist and are not billing-blocked, over merging on `pending`, because right after the push no run has finished and a failing pull request would merge every time.
- Auto-decided: idle detection reads `projection.stage.activity` from `worker-list`, over `orca worktree ps`, because both come from the same agent status and `worker-list` also covers remote workers.
- Auto-decided: `desk digest` keeps a local `badlabels-pinged.json` so a `bad-labels` issue pings once per label set, over a marker on GitHub, because the issue has no comment to mark, and a lost file only repeats a ping.
- Auto-decided: the ntfy sender and the merge helpers live in `src/ping/` and `src/merge/`, over `src/watch/`, because neither belongs to the watchdog.
