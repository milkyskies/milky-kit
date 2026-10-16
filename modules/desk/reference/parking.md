# Parking a decision

Read this before running `desk park`. The rule `desk.md` holds the sequence. This file holds the card format.

A card is one decision. Two decisions on one issue are two card files. Write each card as a file with this shape, markers included, and pass it to `desk park`. The program validates the shape before it posts anything and names the missing part.

```markdown
<!-- desk:decision -->
## Decision needed

**Kind:** <code-detail | design>

<background: the facts the reader needs, so no other page has to be opened>

**Already checked:** <one line: what you searched or read, so the reader does not repeat it>

**Question:** <the one decision, in one or two sentences>

**Options:**
1. 提案 <option written out in full> - <consequence>
2. 提案 <option written out in full> - <consequence>

**Recommendation:** <the recommended option, written out in full>

_Stopped at: <what you were doing>. Reply in a comment and I will pick it up._

<!-- desk:agent -->
```

The **Kind** line is mandatory, and it decides the recommendation.

- **code-detail** (a name, a retry count, which library function): keep the **Recommendation** line, with one recommended option.
- **design** (a design, product or pitch call): drop the **Recommendation** line. Put the pick in a collapsed block instead, so GitHub hides it until tapped:

  ```markdown
  <details><summary>What would I pick?</summary>

  <the picked option, written out, and the reason>

  </details>
  ```

  A pick shown up front anchors the human, and a design call is theirs to make unanchored. You still write a pick on every design card.

Options are numbered, each one is marked 提案 so no proposal reads as a settled call, and each is written out in full. Nobody refers to an option by its number or a letter. If you genuinely cannot enumerate options, say so in one line instead of padding the list.

## Propose the issue you needed

When you park because the issue was underspecified (stop reason 1 only), also pass `--proposed-body <file>` with the body you would have needed:

```markdown
<!-- desk:proposed-body -->
## Proposed issue body

<the full replacement body>

<!-- desk:agent -->
```

- Carry `## Problem` through unchanged, byte for byte. Intent is the human's; only the mechanics are yours to draft.
- Fill in `## Acceptance criteria` and `## Tests` concretely enough that the next attempt can finish without asking again.
- Resolve the ambiguity into explicit numbered options.
- Post none for the other three stop reasons. A security decision needs an answer, not a rewritten spec.
