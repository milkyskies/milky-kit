import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf, seedWorking } from "../github/testing/seed.ts"
import { run } from "./done.ts"

const PR_URL = "https://github.com/milkyskies/kit/blob/desk-pictures/12/after.png?raw=true"
const FLAGS = [
	"--dispatch",
	"ctx_y",
	"--pr",
	"45",
	"--summary",
	"Login now sends a magic link.",
	"--picture",
	PR_URL,
	"--checked",
	"Nothing used was removed upstream.",
]

function setup() {
	const harness = makeHarness()
	seedWorking(harness.fake, 12)
	harness.fake.pullRequests.set(45, {
		number: 45,
		state: "OPEN",
		isDraft: false,
		body: "closes #12\n\nBody.",
		mergeable: "MERGEABLE",
		headRefOid: "headsha",
		baseRefName: "main",
		behindBy: 0,
	})

	return harness
}

describe("frontdesk done", () => {
	test("posts the result comment and moves to stage:check", async () => {
		const { fake, context } = setup()
		fake.issue(12).body =
			"## Problem\n\nP.\n\n## Decisions\n\n- 2026-10-15: use magic links\n\n## Small calls\n\n- a\n- b\n"
		fake.addComment(
			12,
			"<!-- frontdesk:proposed-request issue=51 -->\nFiled.\n<!-- frontdesk:agent -->\n",
		)

		await run(["12", ...FLAGS, "--see", "`mise run dev`, then open /login"], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:check")

		const result = issue.comments.at(-1)?.body ?? ""
		expect(result).toStartWith("<!-- frontdesk:result claim=c_first1 pr=45 -->\n## Done, check it")
		expect(result).toContain("Login now sends a magic link.")
		expect(result).toContain(`![picture](${PR_URL})`)
		expect(result).toContain("**See it yourself:** `mise run dev`, then open /login")
		expect(result).toContain("**Pull request:** #45")
		expect(result).toContain("**Decisions used:**\n- 2026-10-15: use magic links")
		expect(result).toContain("**Small calls:** 2, listed under `## Small calls` in the description")
		expect(result).toContain(
			"**Verified by frontdesk:** the pull request is not CONFLICTING (GitHub says MERGEABLE), and its head contains main at abc1234 (behind_by 0).",
		)
		expect(result).toContain("**Worker says:** Nothing used was removed upstream.")
		expect(result).toContain("**Proposed requests:** #51")
		expect(result).toContain("Reply `looks good` to merge, or `no, because …` to send it back.")
	})

	test("writes the no-picture line when a reason is given", async () => {
		const { fake, context } = setup()
		const flags = FLAGS.filter((_flag, index) => ![6, 7].includes(index)).concat([
			"--no-picture",
			"no screen changed",
		])

		await run(["12", ...flags], context)

		expect(fake.issue(12).comments.at(-1)?.body).toContain("No picture: no screen changed")
	})

	test("exits 2 without --checked", async () => {
		const { fake, context } = setup()
		const flags = FLAGS.slice(0, -2)

		const result = await failureOf(run(["12", ...flags], context))

		expect(result.code).toBe(2)
		expect(result.message).toContain("missing --checked")
		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("exits 2 when neither a picture nor a no-picture reason is given", async () => {
		const { context } = setup()
		const flags = FLAGS.filter((_, index) => ![6, 7].includes(index))

		expect((await failureOf(run(["12", ...flags], context))).code).toBe(2)
	})

	test("refuses a draft pull request, a wrong first line, and a conflicting one", async () => {
		const { fake, context } = setup()
		const pr = fake.pullRequests.get(45)
		if (!pr) throw new Error("fixture missing")

		pr.isDraft = true
		expect((await failureOf(run(["12", ...FLAGS], context))).message).toContain("still a draft")

		pr.isDraft = false
		pr.body = "Fixes things\n\ncloses #12"
		expect((await failureOf(run(["12", ...FLAGS], context))).message).toContain(
			'starts with "Fixes things"',
		)

		pr.body = "closes #12"
		pr.mergeable = "CONFLICTING"
		const conflicting = await failureOf(run(["12", ...FLAGS], context))
		expect(conflicting.code).toBe(1)
		expect(conflicting.message).toContain("CONFLICTING")
		expect(fake.issue(12).comments).toHaveLength(1)
	})

	test("refuses when the newest claim belongs to another dispatch", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12, "ctx_other")

		const result = await failureOf(run(["12", ...FLAGS], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("belongs to dispatch ctx_other")
	})

	test("reports how far behind main the head is instead of claiming it contains main", async () => {
		const { fake, context } = setup()
		const pr = fake.pullRequests.get(45)
		if (pr) pr.behindBy = 3

		await run(["12", ...FLAGS], context)

		expect(fake.issue(12).comments.at(-1)?.body).toContain(
			"its head is behind main at abc1234 by 3 commits",
		)
	})
})
