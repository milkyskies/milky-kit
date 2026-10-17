import { describe, expect, test } from "bun:test"
import { join } from "node:path"

import { cardProblems, sayBackLines } from "./cards.ts"

const FRONTMAN_REFERENCE = join(import.meta.dir, "../../../reference/frontman.md")
const CONFIRMATION_CARD = /## "Is this what you meant\?"[\s\S]*?```markdown\n([\s\S]*?)```\n/

async function confirmationCard(): Promise<string> {
	const reference = await Bun.file(FRONTMAN_REFERENCE).text()
	const card = CONFIRMATION_CARD.exec(reference)?.[1]
	if (card === undefined) throw new Error(`no confirmation card template in ${FRONTMAN_REFERENCE}`)

	return card
}

describe("the frontman's confirmation card", () => {
	test("the template in frontman.md passes desk park's validator", async () => {
		expect(cardProblems(await confirmationCard())).toEqual([])
	})

	test("the template offers yes as its only say-back", async () => {
		expect(sayBackLines(await confirmationCard())).toEqual([
			"<the request in one line>, confirmed as written",
		])
	})
})
