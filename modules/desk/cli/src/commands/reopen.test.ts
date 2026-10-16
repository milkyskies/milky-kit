import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { run } from "./reopen.ts"

describe("desk reopen", () => {
	test("quotes the human reason, then moves the check back to ready", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12, labels: ["request", "autopilot", "stage:check"] })
		const reason = fake.addComment(12, "no, because the button is the wrong colour")

		await run(["12", "--comment", String(reason.databaseId)], context)

		expect(fake.issue(12).labels).toContain("stage:ready")
		const posted = fake.issue(12).comments.at(-1)?.body ?? ""
		expect(posted).toStartWith(`<!-- desk:reopen comment=${reason.databaseId} -->`)
		expect(posted).toContain("> no, because the button is the wrong colour")
	})

	test("refuses outside stage:check and for an agent comment", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		expect((await failureOf(run(["12", "--comment", "1"], context))).code).toBe(1)

		fake.issue(12).labels = ["request", "stage:check"]
		const agent = fake.addComment(
			12,
			"<!-- desk:result claim=c pr=1 -->\nDone.\n<!-- desk:agent -->",
		)
		expect(
			(await failureOf(run(["12", "--comment", String(agent.databaseId)], context))).code,
		).toBe(1)
	})
})
