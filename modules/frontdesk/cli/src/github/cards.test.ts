import { describe, expect, test } from "bun:test"

import { canonicalCard, cardProblems, sayBackLines } from "./cards.ts"
import { parseMarker } from "./markers.ts"
import { decisionCard } from "./testing/seed.ts"

describe("card say-back lines", () => {
	test("an option without a say-back arrow is rejected", () => {
		const card = decisionCard("code-detail").replace(
			" → Retries = 5, the same as the old client.",
			"",
		)

		expect(cardProblems(card)).toEqual([
			expect.stringContaining("option 2 needs a say-back line after its consequence"),
		])
	})

	test("an arrow with no text after it is rejected", () => {
		const card = decisionCard("code-detail").replace("→ Retries = 3, the same as the server.", "→ ")

		expect(cardProblems(card).join(" ")).toContain("option 1 needs a say-back line")
	})

	test("a say-back line on the continuation line of an option counts", () => {
		const card = decisionCard("code-detail").replace(
			" → Retries = 3, the same as the server.",
			"\n   → Retries = 3, the same as the server.",
		)

		expect(cardProblems(card)).toEqual([])
		expect(sayBackLines(card)).toEqual([
			"Retries = 3, the same as the server.",
			"Retries = 5, the same as the old client.",
		])
	})

	test("a numbered list outside the options is not read as options", () => {
		const card = decisionCard("code-detail").replace(
			"The background sentence.",
			"The background sentence.\n1. first fact\n2. second fact\n",
		)

		expect(cardProblems(card)).toEqual([])
		expect(sayBackLines(card)).toHaveLength(2)
	})

	test("a card whose options cannot be enumerated needs no say-back line", () => {
		const card = `<!-- frontdesk:decision -->
**Kind:** code-detail

Background.

**Already checked:** grep.

The options cannot be enumerated because the name is free text.

**Recommendation:** call it retry_count.
`

		expect(cardProblems(card)).toEqual([])
		expect(sayBackLines(card)).toEqual([])
	})

	test("a card carries the visible Agent line and still parses clean", () => {
		const posted = canonicalCard(decisionCard("code-detail"), "c_first1", 2)
		const again = canonicalCard(posted, "c_first1", 2)

		expect(posted.split("\n")[1]).toBe("**Agent:**")
		expect(again).toBe(posted)
		expect(cardProblems(posted)).toEqual(cardProblems(decisionCard("code-detail")))
		expect(sayBackLines(posted)).toEqual(sayBackLines(decisionCard("code-detail")))
	})

	test("the card id lands on the decision marker beside the claim", () => {
		const posted = canonicalCard(decisionCard("code-detail"), "c_first1", 2)

		expect(parseMarker(posted)).toEqual({
			kind: "decision",
			attrs: { claim: "c_first1", card: "c_first1-2" },
		})
	})
})
