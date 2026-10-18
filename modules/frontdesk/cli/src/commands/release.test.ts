import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf, seedFrontmanWorking, seedWorking } from "../github/testing/seed.ts"
import { run } from "./release.ts"

describe("frontdesk release", () => {
	test("posts the release naming the newest claim and returns the issue to ready", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)

		await run(["12", "--reason", "no-worker"], context)

		expect(fake.issue(12).labels).toContain("stage:ready")
		expect(fake.issue(12).comments.at(-1)?.body).toStartWith(
			"<!-- frontdesk:release claim=c_first1 reason=no-worker -->",
		)
	})

	test("refuses when --claim names an older claim than the newest", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)

		const result = await failureOf(run(["12", "--reason", "stopped", "--claim", "c_old"], context))

		expect(result.code).toBe(1)
		expect(fake.issue(12).labels).toContain("stage:working")
		expect(fake.issue(12).comments).toHaveLength(1)
	})

	test("refuses an issue that is not working, and the answered reason", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })

		expect((await failureOf(run(["12", "--reason", "stopped"], context))).code).toBe(1)
		expect((await failureOf(run(["12", "--reason", "answered"], context))).code).toBe(2)
	})

	test("released_frontman_returns_to_intake_not_ready", async () => {
		const { fake, context } = makeHarness()
		seedFrontmanWorking(fake, 12)

		await run(["12", "--reason", "no-worker"], context)

		expect(fake.issue(12).labels).toContain("stage:intake")
		expect(fake.issue(12).labels).not.toContain("stage:ready")
	})
})
