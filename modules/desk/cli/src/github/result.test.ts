import { describe, expect, test } from "bun:test"

import { run as done } from "../commands/done.ts"
import { parseComments } from "./derive.ts"
import { parseResult } from "./result.ts"
import { makeHarness } from "./testing/fake-gh.ts"
import { seedWorking } from "./testing/seed.ts"

const PICTURE = "https://github.com/milkyskies/kit/blob/desk-pictures/12/after.png?raw=true"

async function resultOf(extraFlags: string[], body: string) {
	const { fake, context } = makeHarness()
	seedWorking(fake, 12)
	fake.issue(12).body = body
	fake.addComment(12, "<!-- desk:proposed-request issue=51 -->\nFiled.\n<!-- desk:agent -->\n")
	fake.pullRequests.set(45, {
		number: 45,
		state: "OPEN",
		isDraft: false,
		body: "closes #12",
		mergeable: "MERGEABLE",
		headRefOid: "headsha",
		baseRefName: "main",
		behindBy: 0,
	})

	await done(
		[
			"12",
			"--dispatch",
			"ctx_y",
			"--pr",
			"45",
			"--summary",
			"Login now sends a magic link.",
			"--checked",
			"Nothing used was removed upstream.",
			...extraFlags,
		],
		context,
	)

	const comment = parseComments(fake.issue(12).comments).at(-1)
	if (comment === undefined) throw new Error("no result comment")

	return comment
}

describe("parseResult reads what desk done wrote", () => {
	test("a result with a picture, decisions and a way to see it", async () => {
		const comment = await resultOf(
			["--picture", PICTURE, "--see", "`mise run dev`, then open /login"],
			"## Problem\n\nP.\n\n## Decisions\n\n- 2026-10-15: use magic links\n- 2026-10-16: no password\n",
		)

		expect(parseResult(comment)).toEqual({
			pr: 45,
			summary: "Login now sends a magic link.",
			pictures: [PICTURE],
			noPicture: undefined,
			see: "`mise run dev`, then open /login",
			decisionsUsed: ["- 2026-10-15: use magic links", "- 2026-10-16: no password"],
			workerSays: "Nothing used was removed upstream.",
			proposedRequests: [51],
		})
	})

	test("a result with no picture and no decisions", async () => {
		const comment = await resultOf(["--no-picture", "a backend change"], "## Problem\n\nP.\n")

		expect(parseResult(comment)).toMatchObject({
			pictures: [],
			noPicture: "a backend change",
			see: undefined,
			decisionsUsed: [],
		})
	})

	test("a comment that is not a result is not parsed", () => {
		const [comment] = parseComments([
			{ id: "IC_1", databaseId: 1, body: "looks good", createdAt: "2026-10-16T14:00:00Z" },
		])

		expect(comment && parseResult(comment)).toBeUndefined()
	})
})
