import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { run } from "./propose.ts"

describe("desk propose", () => {
	test("files a proposed request with no autopilot label and records it on the source issue", async () => {
		const { fake, context, output } = makeHarness()
		fake.addIssue({ number: 12 })
		fake.files.set("body.md", "## Problem\n\nA side topic.\n")

		await run(
			["--from", "12", "--title", "Fix the side topic", "--type", "fix", "--body", "body.md"],
			context,
		)

		const created = fake.issue(101)
		expect(created.labels).toEqual([
			"request",
			"proposed",
			"stage:intake",
			"priority:P2",
			"type:fix",
		])
		expect(created.labels).not.toContain("autopilot")
		expect(output).toEqual(["101"])
		expect(fake.issue(12).comments.at(-1)?.body).toStartWith(
			"<!-- desk:proposed-request issue=101 -->",
		)
	})

	test("rejects a body without a Problem section, and an unknown type", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		fake.files.set("body.md", "Just text.")
		fake.files.set("good.md", "## Problem\n\nx")

		expect(
			(
				await failureOf(
					run(["--from", "12", "--title", "t", "--type", "fix", "--body", "body.md"], context),
				)
			).code,
		).toBe(2)
		expect(
			(
				await failureOf(
					run(["--from", "12", "--title", "t", "--type", "bug", "--body", "good.md"], context),
				)
			).code,
		).toBe(2)
		expect(fake.issues.size).toBe(1)
	})
})
