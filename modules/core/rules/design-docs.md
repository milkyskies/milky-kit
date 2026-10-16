---
paths:
  - "docs/**"
---

# Design docs

## Not a bible

A doc says what was decided and why. It is never the argument for keeping the decision. Quoting a doc back as the reason not to change something is circular: a rule gets invented, written down, then cited as law by the next reader. A rule with nobody's name and no reasoning is suspect, not settled.

Shipped code is not a bible either. That something already runs is a fact about the schedule, not about the design. Write the cost of changing it down; never let the cost veto. If the right answer needs a rewrite, the doc states the right answer and the rewrite goes on the board.

## No archaeology

A doc says what is true now. Git holds the history. Delete on sight:

- "Reviewed on…", "Corrected…", "Added…" stamps.
- Struck-through headings and rows.
- "Superseded", "old pick", "this previously said X".
- Paragraphs about what an earlier draft got wrong. Keep the reasoning, cut the autobiography.
- Findings sections. A fixed finding is the document. An open one belongs in the doc's Open list.

A dated decision record is a snapshot by design and is exempt. It is replaced by a newer record, never edited.

What a doc carries instead:

| | |
|---|---|
| **Decided** | stated flat, with no date and no ceremony |
| **Open** | what has to be answered, and by whom if not us |
| **Proposal** | whose it is, so an invented rule cannot become law |

## Opening

Title, then an overview, then one metadata line. The overview is two to four paragraphs, and a reader who has never seen the file understands the thing by the end of it. Write it in this order:

1. **Background.** The fact the rest depends on.
2. **What the system is**, concretely, with an example.
3. **Where it stands**, if that is interesting.

Do not open with an epigram or a filing status. A compressed line reads as clever to its author and as a riddle to everyone else.

The metadata line comes after the overview: `**Status.** decided, undecided, built, partly built or not built, plus the one detail that matters · **Owns.** the facts this file is the single source for`. No dates, no filing history.

Verbatim user quotes go in a final `## Appendix: what the user actually said`. A quote earns a place in the body only when the quote is the decision.

## Links and owners

- A reference to another doc is a markdown link, not a path in backticks. Backticks are for code identifiers.
- One owner per fact. Two copies of a table drift within a week. When you catch yourself explaining what a linked doc already owns, link instead.
