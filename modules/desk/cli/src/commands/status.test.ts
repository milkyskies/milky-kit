import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { seedWorking } from "../github/testing/seed.ts"
import { run } from "./status.ts"

describe("desk status", () => {
	test("prints the stage, claim, attempts, last human comment and pull request, and writes nothing", async () => {
		const { fake, context, output } = makeHarness()
		seedWorking(fake, 12)
		fake.addComment(12, "please hurry")
		fake.issue(12).pullRequests = [45]
		fake.pullRequests.set(45, {
			number: 45,
			state: "OPEN",
			isDraft: true,
			body: "",
			mergeable: "UNKNOWN",
			headRefOid: "h",
			baseRefName: "main",
			behindBy: 0,
		})
		const callsBefore = fake.calls.length

		await run(["12"], context)

		expect(output[0]).toContain("#12 open: stage:working")
		expect(output[0]).toContain("claim: claim c_first1 on zeus")
		expect(output[0]).toContain("attempts: 0")
		expect(output[0]).toContain("comment 1002")
		expect(output[0]).toContain("pull request: #45 OPEN draft, UNKNOWN")
		expect(fake.calls.slice(callsBefore).every((call) => call[1] === "graphql")).toBe(true)
	})

	test("--json prints one object", async () => {
		const { fake, context, output } = makeHarness({ json: true })
		seedWorking(fake, 12)

		await run(["12"], context)

		expect(JSON.parse(output[0] ?? "{}")).toMatchObject({
			issue: 12,
			stage: "stage:working",
			attempts: 0,
		})
	})
})
