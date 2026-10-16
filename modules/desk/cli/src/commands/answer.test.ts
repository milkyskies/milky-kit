import { describe, expect, test } from "bun:test"

import { activeClaims, attemptCount, parseComments } from "../github/derive.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf, seedWorking } from "../github/testing/seed.ts"
import { run as answer } from "./answer.ts"
import { run as claim } from "./claim.ts"

describe("desk answer", () => {
	test("posts the human answer, records the decision, releases the claim, and moves to ready", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go with five retries.")

		await answer(["12", "--body", "answer.md", "--decision", "five retries"], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:ready")
		expect(issue.body).toContain("## Decisions\n\n- 2026-10-16: five retries")

		const comments = parseComments(issue.comments)
		expect(comments.at(-2)).toMatchObject({ body: "Go with five retries.", agent: false })
		expect(comments.at(-1)?.marker).toEqual({
			kind: "release",
			attrs: { claim: "c_first1", reason: "answered" },
		})
		expect(activeClaims(comments)).toHaveLength(0)
		expect(attemptCount(comments)).toBe(0)
	})

	test("lets the next worker claim after the answer", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go.")

		await answer(["12", "--body", "answer.md", "--decision", "go"], context)
		await claim(["12", "--machine", "zeus", "--task", "t2", "--dispatch", "ctx_next"], context)

		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("refuses an issue that is not waiting on a human", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("answer.md", "Go.")

		const result = await failureOf(
			answer(["12", "--body", "answer.md", "--decision", "go"], context),
		)

		expect(result.code).toBe(1)
	})

	test("rejects an answer that carries the agent marker", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go.\n<!-- desk:agent -->")

		expect(
			(await failureOf(answer(["12", "--body", "answer.md", "--decision", "go"], context))).code,
		).toBe(2)
	})
})
