# Review

Read this before writing any brief (the self-check list goes in every brief), when a pull request touches one of the project's `### Review paths`, when choosing the flag a worker's `/ship` gets, and when a pull request merges or a worker has to be stopped.

## The standard: silent and costly

A fresh reviewer re-reads the codebase every time. One cost 102,000 tokens on a three-line change. The coordinator therefore decides review on this standard, never on size and never by asking the human.

A pull request gets the standing reviewer only when a mistake in it would be both silent and costly.

- **Silent:** nothing else would catch it. Not the compiler, not the tests, not the picture on the result, and not the human's own check.
- **Costly:** it loses or corrupts data, breaks many things at once, or can harm the machine.

| Gets the reviewer | Does not |
|---|---|
| Persisted data formats and their loading | Anything visible in a screenshot: UI, art, layout |
| A timing or ordering core that many flows depend on | User-facing text, wording |
| Numbers many things read: prices, limits, growth rates | Deleting code or content (the compiler finds what still uses it) |
| Scripts that kill processes or delete files | One feature covered by its own tests |
| A refactor of shared code that changes behaviour on purpose | A large pull request that only moves or renames |

A project's `### Review paths` is its answer to this table, written as globs. A project with no list falls back to the standard itself. When in doubt, the pull request gets no reviewer: the human's check at `stage:check` is the review.

## The standing reviewer

One Opus worker at medium effort. It reads and reports, and never pushes.

- **Start.** The first time a pull request meets the standard. `worker-start --agent claude --model opus --effort medium --worktree current`, with `--task-title reviewer`. The title carries no `#<n> `, because `reconcile` joins workers to issues by that prefix and the reviewer belongs to no single issue. UNVERIFIED: how `reconcile` treats a live worker with no issue. Check on the first run, and name the title in `reference/routing.md` if it needs another form.
- **Reuse.** The rest of the run reuses the same terminal through `worker-start --terminal`. The coordinator keeps no handle in memory: a fresh coordinator finds the reviewer in `worker-list` by its title.
- **Between pull requests.** `/clear` the terminal before a pull request in an unrelated area (`reference/tokens.md`). Keep the context for a second look at the same pull request.
- **Report.** Findings go on the Issue as a comment ending with `<!-- desk:agent -->`, so the record survives a crash and the comment does not read as a human answer. The coordinator forwards the findings to the request's worker.
- **Never a fresh subagent.** The coordinator does not review from a subagent in its own session. The subagent's effort cannot be set or seen, and it starts from nothing. The coordinator runs no `/code-review` itself.
- **End.** `worker-release` when the run has no more qualifying pull requests, as part of the end-of-run check below.

## The review pass, from the same area input as routing

- **Correctness-critical path** (a review path): `/ship --code-review`, whatever the size. Simplify and rulify, plus the correctness pass.
- **Otherwise, above about 50 changed lines** of non-generated code: `/ship --review`. Quality and conventions only. This also covers a large pull request that gets `/simplify` while the worker still holds everything in context.
- **Below that, or values, config, text, docs, renames, generated artifacts:** no flag, at any size.

The critical tier gets its own level because `/simplify` explicitly does not hunt bugs and `/rulify` checks conventions. On an auth or migration diff those two tidy the code and check comment style while the actual defect goes past. Quality and correctness are different questions, and only the second one is why the path is on the list.

**Say which and why, every time**, in the brief and in the result: `no review pass: 15 lines, not correctness-critical`. A silent skip reads as "this was checked". That is the failure a merge gate exists to prevent, and it is worse than skipping loudly.

## The self-check list in every brief

Every worker checks itself before `desk done`, with the context it already has. The brief carries this list, with the project's additions:

- Merge `origin/main` into your branch and resolve every conflict yourself. Conflicts are never the coordinator's job.
- Nothing you use has been removed or renamed on the base.
- Nothing contradicts `## Decisions` on the Issue.
- Every user-visible string removed, reworded or added is listed in the pull request, old and new, in every language the project ships.
- No test only retypes the code it checks.

The `--checked` text on `desk done` is the worker's statement of this list. A project adds its own lines through its `## desk` section, such as a scan for duplicate identifiers on the merged tree.

## CI failures and review rounds

The worker that owns a pull request pushes its own commits. When CI fails, the coordinator sends the failure back to that worker. The worker reads the failed job with `gh run view <run id> --log-failed` and fixes it, up to 2 attempts. A failure that also fails on `main` is unrelated to the branch: the worker reports it with the evidence and does not fix it.

Per review round, fetch only the new comments on the pull request, never the whole thread. Fixes go to the worker that wrote the code while its terminal is open, otherwise to a Sonnet worker at low effort. The coordinator reads and rules only on comments that dispute a design choice, and that ruling is a card. Comments on code the pull request did not author are skipped.

## The pull request body stays current

After every push to a pull request, the coordinator re-checks the body before the digest reports it:

1. The body describes the current design, not an earlier iteration.
2. Every new or changed screen is listed in the worker's result, and the body shows each one.
3. The footer names every model that wrote code on the branch, for example `Generated with Claude Code by Claude Opus 5.5 and Claude Haiku 4.5`.

A stacked pull request gets its own worktree, so its worker cost stays its own.

## Merge is the gate

Merge is the only gate, and it is human. A change reaches `main` because a person commented `looks good`. A worker marks its own pull request ready on finishing, which is what the state means: ready for the human's review. A finished draft looks exactly like a draft still being written, so the work that most needed attention would be the hardest to see.

The coordinator reads every pull request body before `desk merge`. `desk merge` runs the project's check command and refuses on a conflict.

## After the merge: cleanup

`desk land` runs after the merge, whether `desk merge` did it or the human pressed Merge in the GitHub app. Nothing is reaped before then, because until a pull request merges the human may still want to say something to the worker that wrote it.

- `desk land` releases the worker and removes its worktree. A merged area needs nothing else.
- A running worker that has to go: `worker-stop`, then `worker-release`.
- A worker's processes outlive its worktree. `desk land` does not look for them, so the brief tells the worker to stop every process it started (`reference/tokens.md`). Before a manual `orca worktree rm`, run `pgrep -fl <worktree path>` and stop what it lists. A dev server from a deleted worktree keeps its port and silently breaks the developer's own servers.
- At the end of every run, run `worker-list` and name the workers still live and why.
