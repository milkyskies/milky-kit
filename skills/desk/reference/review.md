# Review

Read this when a pull request touches one of the project's `### Review paths`, and when deciding which flag a worker's `/ship` gets.

## The standing reviewer

A change that touches a review path gets the standing reviewer: one Opus worker at medium effort, reused for the whole run. It reads and reports, and never pushes.

A project with no review paths falls back to this: review only where a mistake would be both silent and costly.

## The review pass, from the same area input as routing

- **Correctness-critical path** (a review path): `/ship --code-review`, whatever the size. Simplify and rulify, plus the correctness pass.
- **Otherwise, above about 50 changed lines** of non-generated code: `/ship --review`. Quality and conventions only.
- **Below that, or values, config, text, docs, renames, generated artifacts:** no flag, at any size.

The critical tier gets its own level because `/simplify` explicitly does not hunt bugs and `/rulify` checks conventions. On an auth or migration diff those two tidy the code and check comment style while the actual defect goes past. Quality and correctness are different questions, and only the second one is why the path is on the list.

**Say which and why, every time**, in the brief and in the result: `no review pass: 15 lines, not correctness-critical`. A silent skip reads as "this was checked". That is the failure a merge gate exists to prevent, and it is worse than skipping loudly.

## Merge is the gate

Merge is the only gate, and it is human. A change reaches `main` because a person commented `looks good`. A worker marks its own pull request ready on finishing, which is what the state means: ready for the human's review. A finished draft looks exactly like a draft still being written, so the work that most needed attention would be the hardest to see.

`desk land` runs after the merge, whether `desk merge` did it or the human pressed Merge in the GitHub app. Nothing is reaped before then, because until a pull request merges the human may still want to say something to the worker that wrote it.
