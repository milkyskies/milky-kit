---
name: arch-diagrams
description: >
  Generate Mermaid architecture diagrams for a change (branch / PR / diff) that help a reviewer
  re-map the code in their head: where things live, how they connect, and what changed. Picks
  diagram types mechanically from the diff (Change Map / Sequence / ER / Class / State), colors by
  change-state, and returns a markdown block to embed in a PR body.
  TRIGGER when: composing a PR body (invoked by /write-pr), or the user asks for architecture /
  change / "what does this PR do" diagrams of a branch, PR, or diff.
  DO NOT TRIGGER when: the change is 1-2 trivial files with no cross-file structure (just say so).
argument-hint: "[branch | PR number | nothing = current branch vs origin/main]"
---

# arch-diagrams

Produce Mermaid diagrams whose job is to **update the reader's mental map of the code** — locate things and re-understand how they fit, not decorate. Every diagram must earn its place.

## Procedure

1. **Get the diff.** `git diff --name-status $(git merge-base HEAD origin/main)...HEAD` (or `gh pr view <n> --json files`). For each path note its status: `A`=added, `M`=modified, `D`=removed.
2. **Read the real source — not the PR description.** Open the migration, model, route, and orchestration files you'll depict. PR bodies are often wrong about column names and signatures; the source is truth. (Classic failure: an ER drawn from the body invents a column the migration doesn't have.)
3. **Run the trigger table** → the set of diagram *types* to draw.
4. **Pick a mode per type** (single vs before/after) from additive-vs-mutative.
5. **Detect wired flow** → only then add entry points + effects.
6. **Draft each** with a title, `+`/`~`/`-` markers, the legend, and the right edges/shapes.
7. **Apply caps**, and note anything you omitted (test files, dropped nodes).

## Axis 1 — Type (chosen by trigger)

| Type | Answers | Fires when the diff contains… | Mermaid |
|---|---|---|---|
| **Change Map** | where things live & how they connect | any multi-file change (≈ always) | `flowchart` |
| **Sequence** | in what order calls happen | a new/changed endpoint, webhook, async/orchestration flow | `sequenceDiagram` |
| **ER** | the data model & keys | a migration / new table / schema change | `erDiagram` |
| **Class** | type structure / hierarchy | a new aggregate or non-trivial type | `classDiagram` |
| **State** | lifecycle transitions | a new status enum / state field / state machine | `stateDiagram-v2` |

Draw every type whose trigger fired. The Change Map almost always fires; the rest are conditional.

## Axis 2 — Mode (chosen by additive-vs-mutative)

- **Additive** (adds new structure to a facet) → **single diagram + color/markers** (the "before" is empty, so a comparison adds nothing).
- **Mutative** (alters / rewires / removes existing structure) → **Before/After pair** (two *separate* diagrams, never one; red = was, green = now).

| Type | Additive → single | Mutative → before/after |
|---|---|---|
| ER | new table | alter column, add FK, split table |
| Class | new type | refactor fields / change hierarchy |
| Sequence | new flow | insert/reorder a step in an existing flow |
| State | new state machine | add/remove transitions |
| Change Map | new file island | rewire existing dependencies |

A PR full of `~` (modified) files can still be all-single if the modifications only *append* (new case in a sealed/union type, new DI binding). Before/After is triggered by *mutating existing behavior*, not by "a tracked file changed."

## Legend (render on every diagram set)

> `+` added · `~` modified · `-` removed · (unmarked) = context · solid = runtime flow · dotted = structural · 🟢/🟡/🔴/⚪️ color reinforces.

**Markers are authoritative; color only reinforces.** ER and State cannot be colored in Mermaid, so the `+`/`~`/`-` text is the only change signal there — always include it. Color encodes node change-state **only**; edges never carry color.

## Edge vocabulary (meaning via line-style + label)

| Relationship | Mermaid | Style |
|---|---|---|
| calls / request flow | `A --> B` | solid |
| data flow (label the payload type) | `A -- TypeName --> B` | solid + label |
| primary happy path | `A ==> B` | thick |
| depends / imports | `A -.-> B` | dotted |
| implements | `Impl -. implements .-> Iface` | dotted + label |
| maps / serializes | `Dto -. maps .-> Model` | dotted + label |
| emits / produces | `Agg -. emits .-> Event` | dotted + label |
| typed by / generated from | `Client -. typed by .-> Spec` | dotted + label |
| persists / reads | `Repo -- save/find --> Table` | solid + label |

**Direction:** arrow points toward what it uses / where data goes. Read inbound-at-top. Don't draw return arrows unless the response shape is the point. Label any non-obvious edge; for dotted labels use the spaced form `-. text .->` (mermaid drops the label without the spaces).

## Node shapes

- default rectangle `["..."]`
- entry point → stadium `(["webhook: push"])`
- external system → hexagon `{{Third-party API}}`
- datastore → cylinder `[("table_name")]`

## Entry points & effects (flow diagrams only)

On Change Maps that show a *wired* flow, and on Sequence diagrams:
- Mark **entry points** (HTTP route, webhook, cron, queue, UI event, CLI) with the stadium shape — the reader's "start here."
- Mark **effects / egress** with `!` + verb on the boundary-crossing edge: `-- ! save -->`, `-- ! call -->`, `-- ! publish -->`. The crossing *is* the effect.

**Skip entirely when nothing is wired** (additive/structural PRs) — there is no entry point and the lone repo→table write is already shown.

## Titles

Each diagram gets a markdown `####` heading + a one-line "what to look at" caption, plus a Mermaid frontmatter `title:` so the rendered SVG is self-labeled:

```
---
title: "Change Map — <subject>"
---
```

## Per-type rendering notes

- **flowchart** — full color via `classDef`/`class` + markers. The workhorse.
- **ER** — cannot color. Whole-entity `+` for a new table (state it in the caption); for an altered table put markers in attribute comments: `varchar old_col "- dropped"`, `bigint n "~ widened"`. Note `UNIQUE`/index/RLS in the caption.
- **Class** — color via `classDef` + `cssClass "A,B" added`, but back it up with a caption listing new vs existing (renderer support varies).
- **State** — cannot color. Keep transition labels single-line (no `\n`); list emitted events in the caption.

## Scale & caps

- 1-2 trivial files → skip diagrams or one small Change Map.
- Big PR → one Change Map per area subgraph (frontend / api-contract / backend layers); **omit test/story files** and say so in the caption.
- **Soft cap 3-4 diagrams.** If more would fire, the PR is probably too big — note it.
- Cap context (unchanged) nodes at 1-3 nearest neighbors.

## Output

Return a single markdown block, ready to paste into a PR body under an `## Architecture diagrams` section:

- the legend line,
- a one-liner naming which triggers fired and which were skipped (and why),
- each diagram as `#### Title` + caption + fenced ```mermaid```.

Mark which facet each diagram answers so the reader knows why it's there.

## Worked reference

For an **additive** backend PR (new aggregate + table, nothing wired) the set is **Change Map + ER + Class + State**, all single+color; Before/After and Sequence are skipped (nothing mutated, nothing wired). For a **full-stack PR that replaces** a save mechanism, the set is **Change Map + Before/After + Sequence + State**. Same legend, same conventions; only the triggered set differs.
