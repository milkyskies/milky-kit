import { describe, expect, test } from "bun:test"
import { owningClaim, parseComments } from "../github/derive.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { run } from "./claim.ts"

const FLAGS = ["--machine", "zeus", "--task", "task_x", "--dispatch", "ctx_y"]

describe("desk claim", () => {
	test("claims a ready issue: comment first, then labels, prints the claim id", async () => {
		const { fake, context, output } = makeHarness()
		fake.addIssue({ number: 12 })

		await run(["12", ...FLAGS], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:working")
		expect(issue.labels).not.toContain("stage:ready")
		expect(issue.assignees).toEqual(["milkyskies"])
		expect(output).toEqual(["c_8f3a2b"])

		const claim = owningClaim(parseComments(issue.comments))
		expect(claim).toMatchObject({
			id: "c_8f3a2b",
			machine: "zeus",
			task: "task_x",
			dispatch: "ctx_y",
		})

		const order = fake.calls.map((call) => call.slice(0, 2).join(" "))
		expect(order.indexOf("api -X")).toBeLessThan(order.indexOf("issue edit"))
	})

	test("refuses an issue that is already working, naming the claim", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		await run(["12", ...FLAGS], context)

		const result = await failureOf(run(["12", ...FLAGS], context))

		expect(result.code).toBe(1)
		expect(result.message).toBe(
			"desk: claim #12 refused: stage is stage:working (claim c_8f3a2b on zeus, 2026-10-16T14:02Z), expected stage:ready",
		)
	})

	test("refuses without the autopilot label", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12, labels: ["request", "stage:ready"] })

		const result = await failureOf(run(["12", ...FLAGS], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("no autopilot label")
		expect(fake.issue(12).comments).toHaveLength(0)
	})

	test("refuses an issue with an open blocker or an open sub-issue", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12, blockedBy: [{ number: 7, state: "OPEN" }] })
		fake.addIssue({ number: 13, subIssues: [{ number: 14, state: "OPEN" }] })
		fake.addIssue({ number: 15, blockedBy: [{ number: 8, state: "CLOSED" }] })

		expect((await failureOf(run(["12", ...FLAGS], context))).message).toContain(
			"blocked by open #7",
		)
		expect((await failureOf(run(["13", ...FLAGS], context))).message).toContain(
			"open sub-issues #14",
		)
		await run(["15", ...FLAGS], context)
		expect(fake.issue(15).labels).toContain("stage:working")
	})

	test("refuses a ready issue that still holds an unreleased claim", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		await run(["12", ...FLAGS], context)
		fake.issue(12).labels = ["request", "autopilot", "stage:ready"]

		const result = await failureOf(run(["12", ...FLAGS], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("an unreleased claim exists")
	})

	test("a missing flag is a usage error", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })

		const result = await failureOf(run(["12", "--machine", "zeus"], context))

		expect(result.code).toBe(2)
		expect(fake.issue(12).comments).toHaveLength(0)
	})

	test("a label write that silently fails exits 4 and prints both states", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		fake.dropLabelWrites = true

		const result = await failureOf(run(["12", ...FLAGS], context))

		expect(result.code).toBe(4)
		expect(result.message).toContain("second read shows stage:ready (claim c_8f3a2b on zeus")
		expect(result.message).toContain("(before: stage:ready)")
		expect(result.message).toContain("expected stage:working")
	})

	test("two racing claims: the later one exits 1 and posts a lost-race release", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		fake.afterNextRead = () => {
			fake.addComment(
				12,
				`<!-- desk:claim id=c_early1 machine=hera task=task_z dispatch=ctx_z at=2026-10-16T14:01:59Z -->\nClaimed.\n<!-- desk:agent -->\n`,
			)
		}

		const result = await failureOf(run(["12", ...FLAGS], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("lost the race to c_early1")

		const comments = parseComments(fake.issue(12).comments)
		const release = comments.at(-1)?.marker
		expect(release).toEqual({ kind: "release", attrs: { claim: "c_8f3a2b", reason: "lost-race" } })
		expect(owningClaim(comments)?.id).toBe("c_early1")
	})

	describe("as a frontman", () => {
		const FRONTMAN = [...FLAGS, "--role", "frontman"]
		const intake = ["request", "stage:intake", "priority:P2"]

		test("claims an intake request that has no autopilot label, and writes the role on the marker", async () => {
			const { fake, context } = makeHarness()
			fake.addIssue({ number: 12, labels: intake })

			await run(["12", ...FRONTMAN], context)

			const issue = fake.issue(12)
			expect(issue.labels).toContain("stage:working")
			expect(issue.labels).not.toContain("stage:intake")
			expect(issue.comments[0]?.body).toStartWith(
				"<!-- desk:claim id=c_8f3a2b machine=zeus task=task_x dispatch=ctx_y at=2026-10-16T14:02:00Z role=frontman -->",
			)
			expect(owningClaim(parseComments(issue.comments))?.role).toBe("frontman")
		})

		test("refuses a proposal that Milky has not accepted", async () => {
			const { fake, context } = makeHarness()
			fake.addIssue({ number: 12, labels: [...intake, "proposed"] })

			const result = await failureOf(run(["12", ...FRONTMAN], context))

			expect(result.code).toBe(1)
			expect(result.message).toContain("proposed")
			expect(fake.issue(12).comments).toHaveLength(0)
		})

		test("refuses a ready request, which only a builder claims", async () => {
			const { fake, context } = makeHarness()
			fake.addIssue({ number: 12 })

			const result = await failureOf(run(["12", ...FRONTMAN], context))

			expect(result.message).toContain("stage:intake")
		})

		test("a builder claim still refuses an intake request", async () => {
			const { fake, context } = makeHarness()
			fake.addIssue({ number: 12, labels: [...intake, "autopilot"] })

			const result = await failureOf(run(["12", ...FLAGS], context))

			expect(result.message).toContain("stage:ready")
		})

		test("refuses a role it does not know", async () => {
			const { fake, context } = makeHarness()
			fake.addIssue({ number: 12, labels: intake })

			const result = await failureOf(run(["12", ...FLAGS, "--role", "janitor"], context))

			expect(result.code).toBe(2)
		})
	})
})
