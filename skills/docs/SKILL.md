---
name: docs
description: >
  Put a fact in the one document that owns it. Decides which repository, which file and which
  section a sentence belongs in, checks whether it is already written somewhere, writes it the
  house way, and commits it where docs commit.
  TRIGGER when: the user says "/docs", "write that down", "put this in the docs", "do we have this
  in the notes / conventions / rules?", "where does this go?", or a change just landed that a
  reader would need to know and no page says it yet.
  DO NOT TRIGGER when: the fact is a task to do (glb), a lesson about how this user works
  (memory), or code that documents itself.
argument-hint: "[the fact, as one sentence]"
---

# Docs: one owner per fact

Two repositories, five kinds of page each, a CLAUDE.md, a rules folder, a memory and a kit. The
same sentence can plausibly go in six places, and when it goes in two it drifts inside a week and
the copy in the wrong place is the one nobody updates. This skill exists so the decision is made
once, by the same questions every time, instead of by whichever file was open.

State the fact first, as **one sentence a stranger could act on**. If it takes a paragraph, it is
two facts; split it and route each.

## 1. Whose fact is it?

Ask these in order and stop at the first yes.

| question | then it goes in |
|---|---|
| Is it about how **this user** works — approval gates, worktrees, what to run first? | `~/.claude/CLAUDE.md`. Never a repository: a collaborator must not inherit it |
| Is it a **lesson about the user or a project** that no reader of the repo needs — "they say GO before they mean it", "look at every prop before sending"? | memory (`~/.claude/projects/<project>/memory/`), one file, one fact |
| Is it a **convention every project of this kind should follow**? | the kit — hand off to `/milky-kit:kit-modify`. Do not write it into one project's rules |
| Is it something **to do**, not something that is true? | `glb`. A doc is not a tracker; `/milky-kit:todo` |
| Would the sentence be **true for a different game** — what a field means, how an effect behaves, which way a number runs, how to make a kind of thing? | the **tool's** repository (milkysprite), never the game's |
| Otherwise | the **game's** repository (ebihara) |

The fifth row is the one that gets missed. A renderer mechanic explained in the game's
`conventions.md` is the exact failure both repositories' rules were written against. The game links;
it does not restate.

## 2. Which page?

Now inside the owning repository, ask what **kind** of sentence it is. Each kind has one home.

| the sentence is | milkysprite | ebihara |
|---|---|---|
| **a rule an agent must obey** while editing here | `CLAUDE.md` under `## Project-specific`, as a bold sentence plus the incident that earned it | `.claude/rules/<topic>.md`, with `paths:` frontmatter if it is scoped |
| **what a field means**, which way a number runs, what a setting defaults to | `docs/authoring.md`, in that kind's section | — (link to milkysprite) |
| **what to DO**, a step in making something | `docs/workflows/<kind>.md`, on the step an author would already be on; `modelling-small-props.md` for shape advice | `raw/milkysprite/conventions.md` for this game's own choices; `docs/howto/<verb>.md` for engine tasks |
| **why it is built this way**, the reasoning behind a mechanism | the topic doc under `docs/` — `silhouette-and-surface.md`, `everything-sits-on-a-node.md`, `how-inheritance-works.md` — or a new one named after the idea | `docs/dev/<topic>.md` |
| **a decision about the game** — what a thing is, how a system works | — | `docs/design/`, per `docs/README.md` and the `design-docs` rule; open questions on `design/decisions.md` |
| **a plan not yet built** | `docs/plans/YYYY-MM-DD-<slug>.md` | `docs/design/plan.md` if it is scope; an issue if it is work |
| **a dated observation**: a playtest, a measurement, "on the 9th this looked like…" | the issue it belongs to, or the commit message | `docs/notes/YYYY-MM-DD-<slug>.md` |
| **what a picture should look like**, a reference | — | `docs/design/art/`, `docs/reference/` |

A property added to an effect or a finish is **two** rows at once — the workflow page and
`authoring.md` — and `the_workflow_pages_keep_up.rs` fails until both name it. Run
`cargo test -p milkysprite-core --test the_workflow_pages_keep_up` after.

When the owning repository has a map, read it before choosing: milkysprite's is
`docs/the-studio.md` and `docs/workflows/README.md`; ebihara's is `docs/README.md` and the table in
`.claude/rules/milkysprite-assets.md`. The map wins over this table if they disagree, and then this
table is stale — fix it.

## 3. Is it already written?

Before writing, grep every candidate home for the fact's nouns, in both repositories and in memory:

```bash
rg -n -i '<two or three nouns>' ~/code/projects/milkysprite/docs ~/code/projects/milkysprite/CLAUDE.md \
  ~/code/games/ebihara/docs ~/code/games/ebihara/raw/milkysprite/conventions.md ~/code/games/ebihara/.claude/rules
```

Found once: update that sentence in place. Found twice: pick the owner by the tables above, make
the other a link, and say so in the commit. Found in the wrong repository: move it, and leave a link
behind only if a reader there would look for it.

## 4. Write it the house way

- **On the page the reader is already on when they need it.** Not a new section at the bottom, not
  an appendix. If the natural place is the middle of a numbered step, it goes in the middle of the
  step.
- **Say what to DO with it**, not that it exists. "Set `weight` to `none` on a strand" beats "there
  is a `weight` field."
- **Say which way a number runs.** High-is-more or low-is-more, in the same sentence as the number.
- **Keep the reasoning, cut the autobiography.** No dates, no "updated", no "previously this said",
  no strikethrough. Git holds the history. The incident that earned a rule is reasoning and stays;
  the story of finding it is autobiography and goes.
- **Link, do not repeat.** A markdown link to the owning page, never a paraphrase of it.
- **One sentence in bold carries the rule**; the paragraph under it is why.

## 5. Commit where docs commit

Docs go straight to `main` in the owning repository — no branch, no PR — unless the same change
touches code, in which case they ride that change's PR. Commit message says what a reader can now
find, not what was edited.

Then report: the file, the section, and any second home you turned into a link.
