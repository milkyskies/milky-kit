# Tokens

Read this before writing a brief or reusing a worker.

- Pass file paths in briefs, never file contents. The worker reads what it needs.
- Read a worker's summary, then its report, then its transcript, and stop when one answers the question.
- `/clear` a reused worker before an unrelated task (`reference/routing.md`).
- Never switch models or toggle MCP servers mid-run.
- Rules that load every turn stay small. Rules for review, landing, issues and cleanup live in reference files loaded when their moment comes.

## What a brief adds to the Issue

The Issue holds the spec: `## Area`, `## Acceptance criteria`, `## Tests`, reference points. The brief points at it and adds only what the Issue cannot know:

- **The exact acceptance commands**, such as `pnpm --filter web exec biome check <paths>` or `mise run check`.
- **The rule to run them first.** "Run the acceptance command yourself before pushing. If it cannot run (missing tools, dependencies, ports), stop and `desk park` the request with a card. Do not push unverified."
- **A reference point for a Haiku worker.** An existing similar feature to follow, since Haiku is routed only where a pattern exists.
- **A time cap on every local test command**, such as "stop after 5 minutes".
- **No blocking waits.** A worker never blocks on CI (`gh pr checks --watch`), end-to-end runs, deploys or long test runs. A blocked worker cannot read a follow-up, so it goes deaf for the whole wait. The worker pushes and records its result. The coordinator checks the slow thing once, when a later pass makes it relevant.
- **Its own ports.** Each running worker gets its own dev-server port range, derived from the issue number, and never stops a process whose working directory is outside its own worktree. Two workers on default ports kill or write into each other's servers.
- **Stop what you start.** Before `desk done`, the worker stops every process it started (dev servers, watchers) by PID or by its own worktree path (`pkill -f <worktree path>`), never by process name such as `pkill -f workerd`, which kills the developer's and other workers' servers.
- **The research line.** "Send every research question to the researcher agent (`subagent_type: "researcher"`)."
- **The self-check list** from `reference/review.md`.

## Reading a worker

1. The result comment on the Issue and the `worker_done` body.
2. `git diff --stat` on the branch.
3. The worker's report, if it wrote one.
4. `worker-read --dispatch <id>` as the last resort. Read a full transcript only when the first three fall short.

Raw output over about 10,000 tokens with no model as its author, such as a long log that a script cannot cut, goes through the scout agent first. The scout condenses it to the blocking points.

Per pull request review round, fetch only the new comments (`reference/review.md`).

## Talking to a busy worker

- A worker misses messages sent while it is busy. Collect changes and send them as one follow-up after `worker_done`. Send mid-task only when the change alters work in progress.
- Put a mid-task change on the Issue as a comment too: the latest comment wins, and a worker that started later reads it.
- A change sent mid-task is not done until the result shows it. Check the result comment against each mid-task change before the digest reports it, and fold anything missed into the next brief.

## Cache

- A cache belongs to one model. Workers on different models share nothing.
- Keep the coordinator's idle gaps under one hour, the cache lifetime. `desk watch` wakes it after 30 minutes at most, so the default holds.
- Choose model and effort at session start. Never switch `/model`, toggle MCP servers or plugins, or edit `CLAUDE.md` mid-run. Each one rewrites the whole cache.
- Workers share through git branches, Issue comments and the rules in `.claude/rules/`. A worker in another area gets what the coordinator learned inside its brief, as a path or a sentence.

## The cost report

A cost script (`pr-cost.py`) reads a worktree's local Claude Code transcripts, multiplies the token counts by list price per model, and prints a table for the pull request body. The desk should have this as a later command, `desk cost <n>`, and this change does not port it.

- **Why it belongs in the program.** The Issue's claim names the dispatch and the worktree, so `desk cost <n>` needs no worktree argument. The script as written takes paths by hand, which is the step a coordinator forgets.
- **What the command must handle that the script does not.** A worker on another machine keeps its transcripts there, so the command runs on the worker's machine. The price table in the script is hardcoded and goes stale with each model release, so the command reads prices from one place in the program. The totals exclude the coordinator session and say so.
- **Output.** The table the script prints, posted as a comment on the Issue, because the Issue is the record. `desk done` could link it.
- **Until then.** The cost table is not required in the pull request body.
