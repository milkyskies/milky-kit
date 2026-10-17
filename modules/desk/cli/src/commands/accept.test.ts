import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { run as accept } from "./accept.ts"
import { run as drop } from "./drop.ts"

const PROPOSED = ["request", "proposed", "stage:intake", "priority:P2", "type:fix"]

describe("desk accept", () => {
	test("removes proposed and leaves the request at intake", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: PROPOSED })

		await accept(["7"], context)

		expect(fake.issue(7).labels).toEqual(["request", "stage:intake", "priority:P2", "type:fix"])
		expect(fake.issue(7).state).toBe("OPEN")
	})

	test("refuses a request that was never proposed", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: ["request", "stage:intake"] })

		const result = await failureOf(accept(["7"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("proposed")
	})

	test("refuses a proposal that already moved past intake", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: ["request", "proposed", "stage:ready"] })

		const result = await failureOf(accept(["7"], context))

		expect(result.message).toContain("stage:intake")
	})
})

describe("desk drop", () => {
	test("closes a proposal as not planned at stage:done", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: PROPOSED })

		await drop(["7"], context)

		const issue = fake.issue(7)
		expect(issue.state).toBe("CLOSED")
		expect(issue.labels).toEqual(["request", "priority:P2", "type:fix", "stage:done"])
		expect(fake.callsMatching(["issue", "close"])[0]).toContain("not planned")
	})

	test("refuses a request that is not a proposal, leaving it open", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: ["request", "stage:intake"] })

		const result = await failureOf(drop(["7"], context))

		expect(result.code).toBe(1)
		expect(fake.issue(7).state).toBe("OPEN")
		expect(fake.issue(7).labels).toContain("stage:intake")
	})

	test("refuses an issue that is already closed", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: ["request", "proposed", "stage:done"], state: "CLOSED" })

		const result = await failureOf(drop(["7"], context))

		expect(result.code).toBe(1)
	})

	test("drop_can_be_rerun_after_the_close_succeeded_but_the_labels_did_not_move", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 7, labels: PROPOSED, state: "CLOSED" })

		await drop(["7"], context)

		expect(fake.issue(7).labels).toContain("stage:done")
		expect(fake.issue(7).labels).not.toContain("proposed")
		expect(fake.callsMatching(["issue", "close"])).toHaveLength(0)
	})
})
