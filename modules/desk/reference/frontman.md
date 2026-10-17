# The frontman

Read this before claiming a request with `--role frontman`. The rule `desk.md` holds the worker contract, and this file holds what a frontman does differently. The design is section 6 of `docs/desk/phase-5.md` in milky-kit.

A frontman turns a filed request into a well-written one. It reads Milky's words and the project, asks the unclear parts as cards one at a time, and ends with "Is this what you meant?". It writes no code, pushes no branch and opens no pull request. Its worktree is only for reading the project.

Every run is one step. A run ends with one park, one `desk ready` or one `desk fail`, and `desk answer` sends the request back to `stage:intake` after each answer, so the coordinator starts a fresh frontman with the answer in hand. The Issue is everything a frontman knows about earlier runs.

## The sequence

1. `desk preflight --role worker --ping`. On failure claim nothing: send `escalation` with the output, then `worker_done --outcome failed`.
2. `desk claim <n> --machine <machine> --task <task id> --dispatch <dispatch id> --role frontman`. On exit 1 another worker owns the request: stop and send `worker_done --outcome failed`.
3. `gh issue view <n> --comments`. Read the body's `## Your words`, `## Decisions` and `## Small calls`, then every earlier card and the `<!-- desk:answer card=<id> -->` comment that answers it. An issue filed another way has `## Problem` where `## Your words` would be.
4. Read the project: the code the request would touch, `CLAUDE.md`, and its `## desk` section. Send every research question to the researcher agent (`subagent_type: "researcher"`).
5. Take the run's one action, from the next section.
6. Send `worker_done` with a body like `#12 → stage:needs-you` or `#12 → stage:ready (3 points)`.

## The run's one action

Check these in order and take the first that applies.

1. **Milky answered "Is this what you meant?" with yes.** The answer is a yes when the newest `## Decisions` line is the card's one say-back line. Write the body, then run `desk ready` (below).
2. **An accepted proposal with nothing to ask.** Write the body, then run `desk ready`. Milky's ✓ start is the confirmation, so this request skips "Is this what you meant?".
3. **A point the ask setting gives to Milky is still unclear.** Park one card about it.
4. **Nothing is left to ask.** Park the "Is this what you meant?" card.
5. **The run cannot get any further**, after three failed attempts at one thing (the project will not build, a file it needs cannot be read): `desk fail <n> --dispatch <dispatch id> --reason <file>`, listing what was tried. The request returns to `stage:intake`. After two failures the coordinator stops starting frontmen and the digest reports the request as `intake-stuck`.

## What becomes a card

The request's `ask:*` label decides, or the project's `- ask:` line under `### Coordinator` when the request has none. A proposal filed by `desk propose` carries no `ask:*` label.

- `ask:everything`: every unclear point is a card.
- `ask:choices`: design and product points are cards. Code details are the frontman's, each logged with `desk note <n> --dispatch <dispatch id> "Auto-decided: X over Y because Z"`.
- `ask:own-feel`: every point is the frontman's, each logged with `desk note`.

"Is this what you meant?" is asked under every setting. `desk ready` adds the `autopilot` label, and that label is Milky's consent to build, which only Milky gives. The accepted proposal with nothing to ask is the one exception, because the ✓ already gave it.

Never the frontman's, whatever the setting: anything `desk.md` lists, and the priority. A request stays `priority:P2` unless Milky's words say otherwise (`issues.md`).

A second, separate request found inside the words is filed with `desk propose --from <n>`, as `desk.md` says for any side topic.

## One card at a time

A park carries exactly one card: `desk park <n> --dispatch <dispatch id> --card <file>`. Write the card as `~/.claude/kit/modules/desk/reference/parking.md` shows, following `modules/core/rules/cards.md`: background first, then the question, then the 提案 options.

- The `**Already checked:**` line names what the frontman read in the project, so Milky does not look it up again.
- Every option's `→ <say-back line>` is the decision itself, in the words Milky would use. `desk answer` writes the chosen line into `## Decisions`, and the desk shows it as the say-back before the next card.
- A frontman passes no `--proposed-body`. The body is written after Milky confirms the write-up.

## Saying answers back

A chosen option's say-back line reaches `## Decisions` through `desk answer`. An answer typed into "other…" arrives as free text, and its `## Decisions` line is that text alone. The next frontman appends ` → <what the answer means for the request, in one line>` to that line, with the body edit described under "Writing the body", in the same run as its other action.

## "Is this what you meant?"

When nothing is left to ask, park this card:

```markdown
<!-- desk:decision -->
## Decision needed

**Kind:** design

<the write-up Milky confirms: what will be built, each decision from ## Decisions, each small call, what is out of scope, and the points estimate with its one-line reason>

**Already checked:** <what the frontman read in the project>

**Question:** Is this what you meant?

**Options:**
1. 提案 Yes, build it as written - the request joins the build queue with the write-up above as its body → <the request in one line>, confirmed as written

Corrections cannot be enumerated ahead of time, so every correction goes in "other…".

<details><summary>What would I pick?</summary>

<the frontman's own read: yes, or the part of the write-up it is least sure of and why>

</details>

_Stopped at: the write-up is ready. Reply in a comment and I will pick it up._

<!-- desk:agent -->
```

The single option is a relayed proposal from the kansai-2 agent, not yet confirmed by Milky. The desk and `/decisions` already add "other…" to every card, so a second "no" option would be a worse copy of it.

A correction typed into "other…" is an answer like any other. The next frontman folds it into the write-up, asks what the correction leaves unclear, and then parks "Is this what you meant?" again with the new write-up.

## Writing the body

After Milky's yes, or for the accepted proposal with nothing to ask:

1. `desk status <n>`. If the newest claim is no longer this run's, stop.
2. Write the new body to a file, in this order:
   - `## Your words`, byte for byte. A request filed another way keeps its `## Problem` byte for byte instead, because that section stands where Milky's words would.
   - The house sections from `modules/issues/rules/issues.md`, in its order and as they apply: `## Problem` (below `## Your words` when that section exists), `## What this issue does`, `## Area`, `## Out of scope`, `## Reference points`, `## Acceptance criteria`, `## Tests`, `## Dependencies`. `## Area` is never left out, because the coordinator routes the build worker from it.
   - `## Decisions` and `## Small calls`, every existing line kept byte for byte. `desk answer` and `desk note` refuse to edit a body that lost an earlier line, and the desk shows both sections.
   - Only what Milky confirmed. A point missing from the confirmed write-up does not enter the body. For the accepted proposal, the body holds only what the proposal and the project already say.
3. Choose the type by the table in `issues.md`: feature, change, fix, chore, docs or refactor.
4. Estimate the points by the table in `issues.md` and log the reason: `desk note <n> --dispatch <dispatch id> "Auto-decided: points:3 over points:5 because <one line>"`.
5. `desk ready <n> --dispatch <dispatch id> --points <k> --type <type> --body <file>`. One checked step writes the body, releases the claim, adds `autopilot`, the points label and the one `type:*` label, and moves the request to `stage:ready`. It refuses, and changes nothing, when the body rewrites `## Your words` (or the `## Problem` that stands in its place) or drops any `## Decisions` or `## Small calls` line, and when `--type` or `--body` is missing. A request that already has another `type:*` label ends with only the one you pass. After a failure partway through, run the same command again.

## Recognising an accepted proposal

A proposal is filed by `desk propose` with the `proposed` label, and `desk accept` (✓ start on the desk) removes that label. The removal shows in the issue's events:

```bash
gh api repos/<owner>/<repo>/issues/<n>/events \
  --jq '[.[] | select(.event == "unlabeled" and .label.name == "proposed")] | length'
```

A count above zero is an accepted proposal. Its `## Problem` was written by the agent that proposed it, and the frontman keeps it byte for byte. A proposal that needed even one card ends with "Is this what you meant?" like any other request.

## Never

- Write code, push a branch or open a pull request.
- Edit `## Your words`, or the `## Problem` that stands in its place.
- Add `autopilot`, edit the body with `gh`, or change a stage by hand. `desk ready`, `desk park` and `desk fail` do it.
- Put two cards in one park.
- Post a hand-written comment without the trailing `<!-- desk:agent -->` (`desk.md`).
