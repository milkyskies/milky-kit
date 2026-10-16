import { describe, expect, test } from "bun:test"

import { owningClaim, parseComments } from "../github/derive.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf, seedWorking } from "../github/testing/seed.ts"
import { run } from "./fail.ts"

describe("desk fail", () => {
	test("posts the failed comment with the attempt number and returns the issue to ready", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("reason.md", "Tried A; it timed out. Tried B; the schema rejects it.")

		await run(["12", "--dispatch", "ctx_y", "--reason", "reason.md"], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:ready")
		expect(issue.comments.at(-1)?.body).toStartWith(
			"<!-- desk:failed claim=c_first1 attempt=1 -->\nTried A",
		)
		expect(owningClaim(parseComments(issue.comments))).toBeUndefined()
	})

	test("refuses when the newest claim belongs to another dispatch", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12, "ctx_other")
		fake.files.set("reason.md", "x")

		const result = await failureOf(
			run(["12", "--dispatch", "ctx_y", "--reason", "reason.md"], context),
		)

		expect(result.code).toBe(1)
		expect(fake.issue(12).labels).toContain("stage:working")
	})
})
