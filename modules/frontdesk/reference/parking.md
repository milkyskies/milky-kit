# Parking a decision

Read this before running `frontdesk park`. The rule `frontdesk.md` holds the sequence. This file holds the card format.

A card is one decision. Two decisions on one issue are two card files. `frontdesk park` gives each card an id, `card=<claim id>-<k>` on its marker, and Milky answers the cards one at a time; the request goes back to work only after the last one is answered. Write each card as a file with this shape, markers included, and pass it to `frontdesk park`. The program validates the shape before it posts anything and names the missing part.

```markdown
<!-- frontdesk:decision -->
## Decision needed

**Kind:** <code-detail | design>

<background: the facts the reader needs, so no other page has to be opened>

**Already checked:** <one line: what you searched or read, so the reader does not repeat it>

**Question:** <the one decision, in one or two sentences>

**Proposals:**
1. <option written out in full> - <consequence> → <say-back line>
2. <option written out in full> - <consequence> → <say-back line>

**Recommendation:** <the recommended option, written out in full>

_Stopped at: <what you were doing>. Reply in a comment and I will pick it up._

<!-- frontdesk:agent -->
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

Every option ends with `→ <say-back line>`: the answer said back in one line, such as `三時 = LHL. 〜時 follows 三`. The frontdesk shows that line after Milky picks the option and records it under `## Decisions`, so write it as the decision itself, in the words Milky would use. `frontdesk park` rejects an option without one, unless the card says its options cannot be enumerated.

Options are numbered, a single `**Proposals:**` heading introduces them so no proposal reads as a settled call, and each is written out in full. Nobody refers to an option by its number or a letter. If you genuinely cannot enumerate options, say so in one line instead of padding the list.

## Propose the issue you needed

When you park because the issue was underspecified (stop reason 1 only), also pass `--proposed-body <file>` with the body you would have needed:

```markdown
<!-- frontdesk:proposed-body -->
## Proposed issue body

<the full replacement body>

<!-- frontdesk:agent -->
```

- Carry `## Problem` through unchanged, byte for byte. Intent is the human's; only the mechanics are yours to draft.
- Fill in `## Acceptance criteria` and `## Tests` concretely enough that the next attempt can finish without asking again.
- Resolve the ambiguity into explicit numbered options.
- Post none for the other three stop reasons. A security decision needs an answer, not a rewritten spec.
