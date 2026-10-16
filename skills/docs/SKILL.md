---
name: docs
description: >
  Put a fact in the one document that owns it. Decides which repository and which page a sentence
  belongs in by reading that repository's own doc map, checks whether it is already written
  somewhere, writes it the house way, and commits it where docs commit.
  TRIGGER when: the user says "/docs", "write that down", "put this in the docs", "do we have this
  in the notes / conventions / rules?", "where does this go?", or a change just landed that a
  reader would need to know and no page says it yet.
  DO NOT TRIGGER when: the fact is a task to do (an issue), a lesson about how this user works
  (memory), or code that documents itself.
argument-hint: "[the fact, as one sentence]"
---

# Docs: one owner per fact

The same sentence can plausibly go in six places, and when it goes in two it drifts inside a week —
and the copy in the wrong place is the one nobody updates. This skill makes the decision once, by
the same questions every time, instead of by whichever file happened to be open.

State the fact first, as **one sentence a stranger could act on**. If it takes a paragraph, it is
two facts; split it and route each.

## 1. Whose fact is it?

Ask these in order and stop at the first yes.

| question | then it goes in |
|---|---|
| Is it about how **this user** works — approval gates, worktrees, what to run first? | `~/.claude/CLAUDE.md`. Never a repository: a collaborator must not inherit it |
| Is it a **lesson about the user or a project** that no reader of the repo needs? | memory, one file, one fact |
| Is it a **convention every project of this kind should follow**? | the kit — hand off to `/milky-kit:kit-modify`. Not one project's rules |
| Is it something **to do**, not something that is true? | the tracker. `/milky-kit:todo` |
| Does the repository at hand **depend on another one** whose mechanics this describes? | that other repository |

The last row is the one that gets missed. When a project is built on a tool you also own — a
renderer, a library, an engine — the test is whether the sentence would still be true for a
different consumer of that tool. Yes: it belongs to the tool. The consumer links, and never
restates. Most repositories that stand in that relationship already say so in their own rules; read
them and follow what they say rather than this table.

## 2. Which page? Read the repository's map.

**Every repository owns its own answer to this, and the map is a file in it.** Find it in this
order and stop at the first that exists:

1. What `CLAUDE.md` says to start with — often a named doc ("Start with `docs/the-studio.md`").
2. `docs/README.md`.
3. A rule under `.claude/rules/` scoped to the paths you are about to touch.

Read it and place the sentence where it says. The map wins over anything you assume.

**If the map has no table saying which kind of sentence goes on which page, add one before you
write the fact.** That is the deliverable this skill leaves behind, and it is why the next run is
cheaper. A usable table has a row per *kind* of sentence, not per folder:

| the sentence is | goes in |
|---|---|
| a rule an agent must obey while editing here | the agent rules |
| what a field means, which way a number runs, what a setting defaults to | the reference |
| what to DO, a step in making something | the procedure page for that kind of thing |
| why it is built this way | the topic doc named after the idea |
| a decision about the product | the design docs |
| a plan not yet built | the plans folder, dated |
| a dated observation: a playtest, a measurement | notes, dated — or the commit message |

Some facts are two rows at once. A setting is both a reference entry and a step. Write both; if the
repository has a test that fails until every setting is named in both places, run it after.

## 3. Is it already written?

Before writing, grep every candidate home for the fact's nouns — in this repository, in any
repository row 5 pointed at, and in memory:

```bash
rg -n -i '<two or three nouns>' docs CLAUDE.md .claude/rules
```

Found once: update that sentence in place. Found twice: pick the owner by the map, make the other a
link, and say so in the commit. Found in the wrong repository: move it, and leave a link behind only
if a reader there would look for it.

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

Where the repository's own style rules disagree with this list, they win.

## 5. Commit where docs commit

Docs go straight to `main` in the owning repository — no branch, no PR — unless the same change
touches code, in which case they ride that change's PR.

Then report: the file, the section, any second home you turned into a link, and whether you had to
add a map table.
