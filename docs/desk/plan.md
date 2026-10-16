# The desk: plan

Written 2026-10-16 from a long design session in kansai-2. Everything below was settled with the user unless it is marked **Open** or **UNVERIFIED**. The working names (the desk, the frontman, request, exploration) are placeholders until the user names them.

## 1. The goal

You run every project through one front desk. You hand in a request in plain words. You get back either the finished result with a picture or preview, or decision cards with the background first. Nothing waits on you without a ping. Nothing is lost when a session or a message dies. It uses as few tokens as quality allows.

### Done when

1. You can file a request from your phone in one sentence.
2. Every question reaches you as a card: background, then the question, then proposals. Answering writes the decision to its home (a dictionary row, a test, a doc).
3. Your phone pings only for "needs a decision" and "done, check it".
4. Killing the coordinator mid-run loses nothing: a fresh one carries on, because state lives only in GitHub Issues.
5. Each request's screen shows your own words, its decisions, the agent's small calls, its pictures, and a button that opens its agent.
6. It works the same in kansai-2 and ebihara, because milky-kit installs it.
7. Every job runs on the cheapest model that does it well, and a worker refuses to start without its setup and pings you the fix.

### Not part of it

- Agents making design decisions unattended.
- A fork of Joshua's kit (`@joshuafolkken/kit`).
- GitHub Projects or `glb`.
- Replacing Orca as the live dashboard of running agents.

## 2. The problem it solves

One long chat holds many topics at once. A question arrives without its background, which sits twenty messages up and mixed with other topics. Exploring and deciding happen in the same place, so it is unclear what is actually decided. The result is lost context and めんどくさい. The fix is one screen per thing, and one card per decision.

## 3. How it feels

### Home

```
✏️  I want…
🔔 NEEDS YOU          Counter accents (kansai-2), 2 questions
👀 DONE, CHECK IT     Word page shows its sentences  [picture]
🆕 PROPOSED BY AGENTS Counter table has no 〜分   [✓ start] [✗ drop]
⏳ WORKING            Past rule for 〜ている, 40 min
```

Every project is in one place, sorted by what needs you. Only the top sections need attention.

### One request

Your own words, verbatim, at the top. Then: the open question cards, the decisions so far with dates, the agent's small calls (each overturnable), the pictures, and a 💬 button that opens the request's agent.

### A question card

```
Counters are all placeholder H0 now. Whatever 三時 is
decides the pattern for every 〜時 (一時, 二時, 四時 …).

三時 (さんじ): which do you say?

提案  ○ LHL   ○ HHL   ○ HLL   ○ other…
💬 talk about this first
```

The order is always background, question, proposals. After an answer, the card says it back in one line ("三時 = LHL. 〜時 follows 三") and shows the next card.

### Done, check it

A screenshot or live preview, one plain sentence on what changed, the decisions and small calls, then two buttons: "looks good" merges it, and "no, because…" reopens the same request with the reason attached.

### Pings

Only "needs a decision" and "done, check it". Nothing for progress or logs.

### What you never do

Re-explain context, decode labels like "option B", touch worktrees, models, merges or cleanup, or hunt for where a decision went. You never need to open GitHub Issues by hand. They are storage, and the desk shows everything.

## 4. Concepts

| Name (working) | What it is |
|---|---|
| **The desk** | The web app you use. Not inside Orca: a separate app, which can also sit in an Orca browser tab on the Mac |
| **Request** | One thing you want. One GitHub Issue underneath |
| **Exploration** | A request whose result is decisions and new requests, not code. This is where kabeuchi happens |
| **Proposed request** | A request an agent filed. It waits for your ✓ before it starts |
| **Card** | One open decision on a request, with background first |
| **Decision** | An answered card. Written to the request and to the fact's home |
| **Small call** | A choice the agent made itself, logged as `Auto-decided: X over Y because Z`, overturnable from the request screen |

### Roles

| Role | Job | Talks to | Model |
|---|---|---|---|
| **Frontman** (desk agent) | Turns a one-line request into a well-written request, asking the unclear parts as cards | You | Opus, medium |
| **Request agent** | Builds one request, and parks design questions as cards | The coordinator, and you through cards and 💬 | By difficulty, the routing table below |
| **Coordinator** | Dispatches, routes models, merges, cleans up. Invisible to you | Request agents | Sonnet, medium |

## 5. How things get in

1. **The "I want…" box** on the desk. One line. If anything is unclear, the frontman asks as cards inside the new request, one at a time (`/obo` style), says each answer back, and ends with "Is this what you meant?" before work starts.
2. **From an exploration:** side topics are split off as their own requests, and `/decide` turns "let's build this" into requests.
3. **From any Claude session:** `/todo <one line>` in Orca or the Claude app.
4. **Agents file them** when they find something outside their own request. These land as proposed and start only on your ✓.

The frontman has no general chat. "What's waiting on me" is the home screen. "Pause everything" and "this one first" are buttons. A general chat would rebuild the mixed stream this plan removes.

## 6. Kabeuchi: explorations

1. Start from the desk: "Explore: how agents should ask me questions". That creates an exploration.
2. 💬 opens it as a free chat in the Claude app or Orca, on Opus at high effort, with researchers available.
3. Side topics are split off as their own requests, and the chat goes straight back to the exploration.
4. It ends with `/decide`: one table of settled, tentative and open. You confirm it, the decisions are written to their homes, and build items become requests.
5. The desk shows the exploration like any request: its decisions, the requests it spawned, and 💬 to pick it back up.

## 7. Architecture

```
YOU ── phone or Mac ──► THE DESK (web app, milky-kit react-spa template)
                          │ new request          ▲ cards / done
                          ▼                      │
                        FRONTMAN ── asks cards ──┘
                          │ a fully decided request
                          ▼
                        COORDINATOR + REQUEST AGENTS (Orca workers)
                          │ read and write
                          ▼
                        GITHUB ISSUES + LABELS: the only truth

Underneath: milky-kit rules and skills · PREFLIGHT script · WATCHDOG script
Orca stays the live dashboard of running agents.
```

### Robustness rules

The old coordinator held the truth in Orca's mailbox and in its own conversation, so one lost `worker_done` or one compacted chat put everything out of sync. These rules replace that:

1. **The Issue is the only truth.** A worker writes its result to the Issue (a comment plus a label change) before it sends `worker_done`. The Orca mailbox is a doorbell, not a record.
2. **The coordinator reconciles, it does not remember.** Every pass reads all open requests from GitHub, compares them with what Orca is running, and fixes the difference. A fresh coordinator after a crash does exactly the same.
3. **A small script moves state, not the model.** Commands of the shape `desk claim`, `desk park`, `desk done`, `desk merge` change labels and comments the same way every time. The model decides what to do, the script does it.
4. **A watchdog script notices silence** at no token cost (ebihara's `~/.claude/scripts/orca-watchdog.py` is the starting point).
5. **A preflight script runs before anything is dispatched:** Orca running, `gh` logged in, Serena available to workers, MCP servers, `mise` tools, project-specific needs such as a local database. If anything is missing, nothing is dispatched and the phone gets one ping with the exact fix. Each worker runs the same script as its first step.

### State on Issues

Labels, not a Projects board. Proposed label names (**Open**: final names):

- Kind: `request`, `exploration`, `proposed`
- Stage: `stage:intake`, `stage:needs-you`, `stage:working`, `stage:check`, `stage:done`
- How much it asks: `ask:everything`, `ask:choices`, `ask:own-feel`
- Project-defined: points and priority scales kept from glb

Comments carry machine-readable markers, kept from milky-kit's autopilot decision protocol (`<!-- autopilot:* -->`, numbered options, the proposed-body block). The Issue body has a `## Decisions` section that is updated after each answer, and a `## Small calls` section.

### 💬 opens a fresh session

The request agents may run anywhere, so 💬 does not try to reach a live process. It opens a fresh Claude session (Claude app or Orca) that reads the request's Issue and branch first. A decision settled in that chat is written back to the Issue.

## 8. Rules for agents

### How much a request asks

Set per request when it is created, with a project default:

| Setting | Behaviour |
|---|---|
| Ask me everything | Every unclear point becomes a card. Default for design, and always for kansai-2 pitch, because the user's ear is binding |
| Ask me the real choices | The agent decides code details (naming, refactor shape) and logs them as small calls; design and product become cards |
| Your own feel | The agent decides everything and logs each call as `Auto-decided: X over Y because Z` |

Never auto-decided, whatever the setting: merges, deletes, force pushes, repository settings, out-of-scope work.

### Cards

- Background first, then the question, then proposals marked 提案. Never two decisions on one card.
- Every card records what the agent already checked, so you do not repeat its search (idea from LoopKit).
- An unanswered card resurfaces after a set time instead of vanishing (idea from Linear's stale sessions).
- Never refer to an earlier option by a label like "B". Say the whole thing.
- Names, labels and statuses in English.

### Building

- Visual work renders or screenshots its result and looks at it before reporting done.
- An answer is written to the fact's home at once (a dictionary row, a test, a doc), so docs cannot go stale.
- Side topics found while working become proposed requests, never side fixes.
- Workers check themselves before reporting done: merge main and fix conflicts, nothing used was removed upstream, nothing contradicts what the user settled.

### Routing: model and effort

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

Escalation after 2 failed attempts: Haiku to Sonnet, Sonnet to the coordinator.

### Review

A project lists review paths in its `CLAUDE.md`. A change that touches one gets the standing reviewer (one Opus worker at medium effort, reused for the whole run, reads and reports, never pushes). A project with no list falls back to: review only when a mistake would be both silent and costly.

### Tokens

- Pass file paths in briefs, never file contents.
- Read a worker's summary, then its report, then its transcript, and stop when one answers the question.
- `/clear` a reused worker before an unrelated task.
- Never switch models or toggle MCP servers mid-run.
- Rules that load every turn stay small; rules for review, landing, issues and cleanup live in reference files loaded when their moment comes.

### Per project

Each project's `CLAUDE.md` has a `## desk` section: hard areas, review paths, the default ask setting, extra routing rows (ebihara: 3D, dialogue, the duplicate-id scan), and preflight needs.

## 9. What exists today

### Kept from milky-kit

- `skills/todo`: infer first, ask only what cannot be inferred, the house Issue body, an undecided idea filed as a question.
- The decision-comment protocol in `modules/autopilot/rules/autopilot.md`: numbered options, markers, the proposed-body block, a human flips the status.
- One digest push per pass, carrying the question.
- The routing table by area.
- `skills/ship` and `skills/land`, minus their `herdr` and `glb` calls.
- The `react-spa` template, for the desk app.
- The bookkeeping workflow's pattern of reacting to a comment and a merge.

### Retired

- `glb` and the ghlobes module as an agent dependency. Evidence: the graph commands (`ready`, `next`, `path`, `stuck`, `done`) were called zero times in the user's sessions; the user's real use was `update`, `create`, `show` and `list`, which `gh` with labels covers. It also had bugs (a failed claim read like a success, no comment command) and needed manual install and updates. Keep its body template and its points and priority scales.
- `skills/autopilot` as written: it is tied to `herdr` tabs. Autopilot was built 2026-08-02 and 2026-08-03 and stranded when ebihara moved to Orca on 2026-09-03.
- `/decisions` as a terminal-only flow; the desk's cards replace it.

### Brought in from ebihara (`~/Code/Games/ebihara/.claude/`)

- `skills/obo`: one question per message, wait, say the answer back, write nothing until the end. Strip the game examples; each project names its own lenses.
- `skills/decide`: runs `obo`, then writes the answers into docs only after the user says so.
- `rules/talking-about-design.md`: mark proposals as proposals, answer the question asked, quote the user or mark a thought as the agent's own.
- `rules/design-docs.md`: docs are not a bible, no archaeology, one owner per fact.
- The generic feedback memories, as rules: `approval-is-not-verification`, `check-main-before-building`, `remerge-before-merge`, `stop-when-it-turns-into-a-hunt`, `a-test-can-assert-the-bug`.
- The watchdog script and the `ebihara-cool.sh` hook pattern for blocking heavy commands.

Two contradictions to settle while moving them: `adr` says one or two questions at a time and `obo` says exactly one (`obo` wins); `HANDOFF.md` says lead with your own opinion while the newer memory `no-unasked-proposals` says offer a pick only when asked (the memory wins).

### Replaced

- kansai-2's `.claude/skills/shachi` and the global `~/.claude/skills/orch-milky` merge into this plan's routing, review and token rules, then both are deleted.

### Ideas taken from Joshua's kit (MIT, ideas only, no files)

Issues and labels as durable state; workers park questions on the Issue; `Auto-decided:` lines; never auto-deciding merges, deletes or settings; review depth from changed paths; low effort for the ship phase. Parked for later: rules turned into hooks once a rule is shown to be ignored, and the duplicate-read guard.

## 10. Work plan

Each phase is milky-kit work unless stated, on branches with PRs (milky-kit's mode is `branch`).

1. **Move milky-kit off glb onto labels.** Port `/todo`, `/ship`, `/land` and the decision protocol to plain `gh`. Done when no skill or rule calls `glb`.
2. **Rebuild autopilot on Orca, the robust way:** Issue-first results, the reconciling coordinator, the state script, the watchdog, the preflight check (with the Serena check). Done when killing the coordinator mid-run and starting a fresh one loses nothing.
3. **Merge shachi and orch-milky** into the routing, review and token rules above, as reference files loaded on demand. Then delete both old skills.
4. **Bring in `/obo`, `/decide`, `talking-about-design` and `design-docs`** from ebihara, plus the card rules (background first, what was checked, resurfacing).
5. **Build the desk** from the `react-spa` template, reading Issues: home, request screen, cards, done-check, proposed requests, pings, 💬 links. Its own repository.
6. **Move kansai-2's queue** (`~/.shachi-reports/kansai-2-scaffold/queue.md`) into Issues.

## 11. Open questions

- The final names of the desk, the frontman, and the label set.
- **UNVERIFIED:** whether an Orca worker's session can be opened on the phone through the Claude app (decides how 💬 works on the phone).
- **UNVERIFIED:** whether Orca lets apps plug into its interface, so the desk could be a real Orca panel instead of a browser tab.
- **UNVERIFIED:** whether Remote Control's push toggles cover Orca-managed sessions.
- How the desk sends phone pings: the coordinator's push tool, web push, or both.
- Claude Code's own agent view (`claude agents`: Working, Needs input, Ready for review) overlaps with the desk. It is session-centric where the desk is request-centric; check whether the desk can read its state (`claude agents --json`).
- Whether the desk is a separate repository or a milky-kit template plus a deployed instance.
- The remote copies of kansai-2's eight merged worker branches still exist on GitHub.

## 12. Decided against, and why

| Option | Why not |
|---|---|
| Forking Joshua's kit | His agent decides design itself ("when in doubt, it is Tier A"), runs Opus everywhere, brings ESLint and Prettier, and its scheduler would compete with ours. Its one fix for our fragility, state on Issues, is an idea we take directly |
| A claude.ai artifact page as the desk | Answers do not wake agents by themselves, and talking to a request's agent needs a relay |
| Discord as the desk | Weak overview, no custom drawing (pitch contours, previews), and chat already works through the Claude app and Orca |
| JEV (typesafe.ai) for routing | It is a hosted decision API, not a Claude Code feature; its community proxy re-picks the model per message and would fight the routing table. Claude Code itself sorts the few requests a day |
| Claude Code workflows as the main engine | "No mid-run user input", so they cannot ask cards. Kept as a tool for unattended bulk jobs |
| Putting the desk inside Orca | Autopilot died when it was tied to herdr; a desk tied to Orca would die with Orca. Orca is not ours, and the desk must open on the phone |
| One general chat with the frontman | It rebuilds the mixed stream this plan removes |

## 13. Sources

- Joshua's kit: https://github.com/joshuafolkken/kit (`CLAUDE.md` decision tiers, `.claude/skills/workflow-commands/`, `scripts/agent/agent-role-profile.ts`, `scripts/review/review-level.ts`, `scripts/delegation/`)
- Claude Code workflows: https://code.claude.com/docs/en/workflows
- Claude Code agent view: https://code.claude.com/docs/en/agent-view
- Claude Code Remote Control: https://code.claude.com/docs/en/remote-control
- Linear agent sessions and elicitation: https://linear.app/developers/agent-best-practices
- LoopKit question records: https://github.com/luxtelos/loopkit/pull/58
- Anthropic, long-running agent harnesses: https://anthropic.com/engineering/effective-harnesses-for-long-running-agents
- JEV: https://typesafe.ai/blog/introducing-system-one-models-and-jev
