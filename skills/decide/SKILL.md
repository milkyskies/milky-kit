---
name: decide
description: Settle an undecided part of the design with the user and write it into the docs. Runs /obo for the questions, one at a time, then checks the answers, writes them into the docs that own them, and checks the docs back against the answers.
argument-hint: [what to settle: a feature, a screen, a flow, a rule, a piece of the design]
---

Settle something about the design and leave it written down. The questions are `/obo`'s. This skill covers what happens to the answers.

`.claude/rules/talking-about-design.md` and `.claude/rules/design-docs.md` hold throughout. The project's `CLAUDE.md` says where its design docs live and which lenses `obo` uses.

## The topic

$ARGUMENTS

## 1. The questions

Run the `obo` skill on the topic above, to the end: one question at a time, each answer said back in a line, nothing written, and the table of what was settled when the topic is worked through.

## 2. Check 1: the answers

The `obo` table is check 1. Ask the user to correct it, and ask whether to write it.

## 3. Writing

On a yes, write each fact into the doc that owns it, stated flat, following `design-docs.md`. A "maybe" is written as tentative. "For now" is the working rule with the rest left open. An example stays labelled as an example. Say which files changed, and end with "Ready for check 2?"

## 4. Check 2: the documents

Read back every file that was written and compare it against the check 1 table. List anything the docs missed, softened, overstated or got wrong, and any other doc that now contradicts what was written. If nothing is off, say so.

Nothing is committed until the user says so. Then `obo` carries on with the next topic, or the session ends.
