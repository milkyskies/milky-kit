import { describe, expect, test } from "bun:test"

import { loadIssues } from "./load.ts"
import { makeListingHarness } from "./testing/github.ts"

describe("loading issues for a pass", () => {
	test("reads every page of open issues and the first page of closed ones", async () => {
		const { fake, extras, context } = makeListingHarness()
		extras.pageSize = 2
		for (const number of [1, 2, 3, 4, 5]) fake.addIssue({ number })
		fake.addIssue({ number: 6, state: "CLOSED", labels: ["request", "stage:done"] })

		const issues = await loadIssues(context.gh, context.repo)

		expect(issues.map((issue) => issue.number).toSorted()).toEqual([1, 2, 3, 4, 5, 6])
		expect(issues.find((issue) => issue.number === 6)?.open).toBe(false)
	})

	test("reads an issue a worker names even when it fell off the closed page", async () => {
		const { fake, extras, context } = makeListingHarness()
		extras.pageSize = 1
		fake.addIssue({ number: 7, state: "CLOSED", labels: ["request", "stage:done"] })
		fake.addIssue({ number: 8, state: "CLOSED", labels: ["request", "stage:done"] })

		const issues = await loadIssues(context.gh, context.repo, [7])

		expect(issues.map((issue) => issue.number).toSorted()).toEqual([7, 8])
	})

	test("keeps the labels, comments and linked pull requests of each issue", async () => {
		const { fake, context } = makeListingHarness()
		fake.pullRequests.set(45, {
			number: 45,
			state: "OPEN",
			isDraft: false,
			body: "closes #12",
			mergeable: "CONFLICTING",
			headRefOid: "abc",
			baseRefName: "main",
			behindBy: 0,
		})
		fake.addIssue({ number: 12, labels: ["request", "stage:check"], pullRequests: [45] })
		fake.addComment(12, "looks good")

		const [issue] = await loadIssues(context.gh, context.repo)

		expect(issue?.labels).toEqual(["request", "stage:check"])
		expect(issue?.comments.map((comment) => comment.body)).toEqual(["looks good"])
		expect(issue?.pullRequests).toEqual([
			{ number: 45, state: "OPEN", isDraft: false, mergeable: "CONFLICTING", headSha: "abc" },
		])
	})
})
