import { describe, expect, test } from "bun:test"

import { activeClaims, attemptCount, parseComments } from "../github/derive.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { run as claim } from "./claim.ts"
import { run } from "./ready.ts"

const FLAGS = ["--dispatch", "ctx_y"]
const CLAIM = ["--machine", "zeus", "--task", "task_x", "--dispatch", "ctx_y", "--role", "frontman"]

async function frontmanWorking() {
	const harness = makeHarness()
	harness.fake.addIssue({ number: 12, labels: ["request", "stage:intake", "priority:P2"] })
	await claim(["12", ...CLAIM], harness.context)

	return harness
}

describe("desk ready", () => {
	test("hands a written-up request to the build queue: autopilot, points, ready, claim released", async () => {
		const { fake, context } = await frontmanWorking()

		await run(["12", ...FLAGS, "--points", "3"], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:ready")
		expect(issue.labels).toContain("autopilot")
		expect(issue.labels).toContain("points:3")
		expect(issue.labels).not.toContain("stage:working")

		const comments = parseComments(issue.comments)
		expect(activeClaims(comments)).toHaveLength(0)
		expect(attemptCount(comments)).toBe(0)
	})

	test("lets a builder claim the request next", async () => {
		const { fake, context } = await frontmanWorking()
		await run(["12", ...FLAGS, "--points", "2"], context)

		await claim(["12", "--machine", "zeus", "--task", "t2", "--dispatch", "ctx_build"], context)

		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("replaces an earlier points label", async () => {
		const { fake, context } = await frontmanWorking()
		fake.issue(12).labels.push("points:8")

		await run(["12", ...FLAGS, "--points", "2"], context)

		expect(fake.issue(12).labels.filter((label) => label.startsWith("points:"))).toEqual([
			"points:2",
		])
	})

	test("refuses a points value outside the Fibonacci set, changing nothing", async () => {
		const { fake, context } = await frontmanWorking()

		const result = await failureOf(run(["12", ...FLAGS, "--points", "4"], context))

		expect(result.code).toBe(2)
		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("refuses a claim that is not a frontman's", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12, labels: ["request", "autopilot", "stage:working"] })
		fake.addComment(12, claimBody("c_first1"))

		const result = await failureOf(run(["12", ...FLAGS, "--points", "3"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("frontman")
		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("refuses another dispatch", async () => {
		const { fake, context } = await frontmanWorking()

		const result = await failureOf(run(["12", "--dispatch", "ctx_other", "--points", "3"], context))

		expect(result.message).toContain("belongs to dispatch ctx_y")
		expect(fake.issue(12).labels).toContain("stage:working")
	})
})
