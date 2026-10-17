import { describe, expect, test } from "bun:test"

import { activeClaims, attemptCount, parseComments } from "../github/derive.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { run as claim } from "./claim.ts"
import { run } from "./ready.ts"

const WORDS = "## Your words\n\nMake the counter accents follow 三時.\n"
const SEEDED_BODY = `${WORDS}\n## Decisions\n\n- 2026-10-16: 三時 = LHL\n\n## Small calls\n\n- 2026-10-16: Auto-decided: a over b because c\n`
const WRITTEN_BODY = `${WORDS}\n## Problem\n\nThe accents are wrong.\n\n## Area\n\n- apps/client/**\n\n## Acceptance criteria\n\n- The accents follow 三時.\n\n## Tests\n\n- accents_follow_san_ji\n\n## Decisions\n\n- 2026-10-16: 三時 = LHL\n\n## Small calls\n\n- 2026-10-16: Auto-decided: a over b because c\n`
const FLAGS = ["--dispatch", "ctx_y", "--type", "change", "--body", "body.md"]
const CLAIM = ["--machine", "zeus", "--task", "task_x", "--dispatch", "ctx_y", "--role", "frontman"]

async function frontmanWorking() {
	const harness = makeHarness()
	harness.fake.addIssue({
		number: 12,
		labels: ["request", "stage:intake", "priority:P2"],
		body: SEEDED_BODY,
	})
	harness.fake.files.set("body.md", WRITTEN_BODY)
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

		const result = await failureOf(
			run(["12", ...FLAGS.with(1, "ctx_other"), "--points", "3"], context),
		)

		expect(result.message).toContain("belongs to dispatch ctx_y")
		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("ready_can_be_rerun_after_the_claim_was_released_but_the_labels_did_not_move", async () => {
		const { fake, context } = await frontmanWorking()
		fake.dropLabelWrites = true
		await failureOf(run(["12", ...FLAGS, "--points", "3"], context))
		fake.dropLabelWrites = false

		await run(["12", ...FLAGS, "--points", "3"], context)

		expect(fake.issue(12).labels).toContain("stage:ready")
		expect(fake.issue(12).labels).toContain("autopilot")
		expect(fake.issue(12).comments.filter((c) => c.body.includes("reason=ready"))).toHaveLength(1)
	})

	test("ready_without_type_label_is_refused", async () => {
		const { fake, context } = await frontmanWorking()

		const result = await failureOf(
			run(["12", "--dispatch", "ctx_y", "--body", "body.md", "--points", "3"], context),
		)

		expect(result.code).toBe(2)
		expect(result.message).toContain("--type")
		expect(fake.issue(12).labels).toContain("stage:working")
		expect(fake.issue(12).body).toBe(SEEDED_BODY)
	})

	test("ready_refuses_a_type_that_is_not_a_type_label", async () => {
		const { context } = await frontmanWorking()

		const result = await failureOf(run(["12", ...FLAGS.with(3, "epic"), "--points", "3"], context))

		expect(result.code).toBe(2)
	})

	test("ready_writes_body_and_stage_together", async () => {
		const { fake, context } = await frontmanWorking()

		await run(["12", ...FLAGS, "--points", "3"], context)

		const issue = fake.issue(12)
		expect(issue.body).toBe(WRITTEN_BODY)
		expect(issue.labels).toContain("stage:ready")
		expect(issue.labels).toContain("type:change")
	})

	test("ready_replaces_an_earlier_type_label_so_exactly_one_remains", async () => {
		const { fake, context } = await frontmanWorking()
		fake.issue(12).labels.push("type:fix")

		await run(["12", ...FLAGS, "--points", "3"], context)

		expect(fake.issue(12).labels.filter((label) => label.startsWith("type:"))).toEqual([
			"type:change",
		])
	})

	test("ready_refuses_a_body_that_rewrote_the_words_and_changes_nothing", async () => {
		const { fake, context } = await frontmanWorking()
		fake.files.set("body.md", WRITTEN_BODY.replace("三時.", "3 o'clock."))

		const result = await failureOf(run(["12", ...FLAGS, "--points", "3"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("## Your words")
		expect(fake.issue(12).body).toBe(SEEDED_BODY)
		expect(fake.issue(12).labels).toContain("stage:working")
		expect(fake.issue(12).comments.filter((c) => c.body.includes("reason=ready"))).toHaveLength(0)
	})

	test("ready_refuses_a_body_that_dropped_a_decision_or_small_call", async () => {
		const { fake, context } = await frontmanWorking()
		fake.files.set("body.md", WRITTEN_BODY.replace("- 2026-10-16: 三時 = LHL\n", ""))

		const result = await failureOf(run(["12", ...FLAGS, "--points", "3"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("三時 = LHL")
		expect(fake.issue(12).body).toBe(SEEDED_BODY)
	})

	test("ready_keeps_a_small_call_written_after_the_frontman_read_the_body", async () => {
		const { fake, context } = await frontmanWorking()
		fake.issue(12).body += "- 2026-10-17: Auto-decided: late over early because late\n"

		const result = await failureOf(run(["12", ...FLAGS, "--points", "3"], context))

		expect(result.message).toContain("late over early")
	})

	test("ready_for_an_issue_filed_another_way_keeps_its_problem_section", async () => {
		const { fake, context } = await frontmanWorking()
		fake.issue(12).body = "## Problem\n\nOriginal problem.\n\n## Decisions\n"
		fake.files.set("body.md", "## Problem\n\nRewritten problem.\n\n## Decisions\n")

		const result = await failureOf(run(["12", ...FLAGS, "--points", "3"], context))

		expect(result.message).toContain("## Problem")
	})
})
