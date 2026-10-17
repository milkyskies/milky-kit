import { describe, expect, test } from "bun:test"

import { openCards, parseComments } from "./derive.ts"
import { composeComment } from "./markers.ts"

function comments(...bodies: string[]) {
	return parseComments(
		bodies.map((body, index) => ({
			id: `IC_${index}`,
			databaseId: 1000 + index,
			body,
			createdAt: `2026-10-16T14:0${index}:00Z`,
		})),
	)
}

const card = (claim: string, id: string) =>
	composeComment("decision", { claim, card: id }, `## ${id}`)
const answer = (id: string) => `<!-- desk:answer card=${id} -->\nGo.`

describe("open cards", () => {
	test("a card with no answer is open, and its answer closes it", () => {
		const parked = comments(card("c_1", "c_1-1"), card("c_1", "c_1-2"))
		expect(openCards(parked).map((open) => open.id)).toEqual(["c_1-1", "c_1-2"])

		const half = comments(card("c_1", "c_1-1"), card("c_1", "c_1-2"), answer("c_1-1"))
		expect(openCards(half).map((open) => open.id)).toEqual(["c_1-2"])
	})

	test("only the newest park counts", () => {
		const both = comments(card("c_1", "c_1-1"), answer("c_1-1"), card("c_2", "c_2-1"))

		expect(openCards(both).map((open) => open.id)).toEqual(["c_2-1"])
	})

	test("a card from before card ids has no id and is never open", () => {
		const legacy = comments(composeComment("decision", {}, "## Decision needed"))

		expect(openCards(legacy)).toEqual([])
	})
})
