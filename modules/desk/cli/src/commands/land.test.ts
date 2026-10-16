import { describe, expect, test } from "bun:test"

import { composeComment } from "../github/markers.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { FakeOrca } from "../orca/testing/fake-orca.ts"
import { worker } from "../reconcile/testing/fixtures.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { landIssue } from "./land.ts"

function setup(pullRequestState: "MERGED" | "OPEN" = "MERGED") {
	const harness = makeListingHarness()
	const fakeOrca = new FakeOrca()
	harness.fake.pullRequests.set(45, {
		number: 45,
		state: pullRequestState,
		isDraft: false,
		body: "closes #12",
		mergeable: "UNKNOWN",
		headRefOid: "abc",
		baseRefName: "main",
		behindBy: 0,
	})
	harness.fake.addIssue({
		number: 12,
		labels: ["request", "autopilot", "stage:check"],
		pullRequests: [45],
	})
	harness.fake.addComment(12, claimBody("c_1", "ctx_y"))
	harness.fake.addComment(12, composeComment("result", { claim: "c_1", pr: "45" }, "Done"))
	fakeOrca.workers = [worker()]
	fakeOrca.worktrees = [{ path: "/work/12", isMainWorktree: false }]

	return { ...harness, fakeOrca, deps: { orca: fakeOrca.orca } }
}

const MUTATING = ["worker-release", "worker-stop", "rm"]

function mutations(fakeOrca: FakeOrca): string[][] {
	return fakeOrca.calls.filter((call) => MUTATING.some((word) => call.includes(word)))
}

describe("desk land", () => {
	test("moves the stage to done, closes the issue, releases the worker and removes its worktree", async () => {
		const { fake, context, fakeOrca, deps } = setup()

		await landIssue(deps, context, 12)

		expect(fake.issue(12).labels).toContain("stage:done")
		expect(fake.issue(12).labels).not.toContain("stage:check")
		expect(fake.issue(12).state).toBe("CLOSED")
		expect(fakeOrca.called("worker-release", "ctx_y")).toHaveLength(1)
		expect(fakeOrca.called("rm", "path:/work/12")).toHaveLength(1)
	})

	test("is idempotent: a second run writes nothing and cleans nothing", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		await landIssue(deps, context, 12)

		const gitHubCallsBefore = fake.calls.length
		const orcaMutationsBefore = mutations(fakeOrca).length
		const stateBefore = JSON.stringify(fake.issue(12))

		await landIssue(deps, context, 12)

		const writes = fake.calls
			.slice(gitHubCallsBefore)
			.filter((call) => call[0] === "issue" || call.includes("POST") || call.includes("PATCH"))
		expect(writes).toEqual([])
		expect(mutations(fakeOrca)).toHaveLength(orcaMutationsBefore)
		expect(JSON.stringify(fake.issue(12))).toBe(stateBefore)
	})

	test("refuses while the pull request is not merged", async () => {
		const { fake, context, deps } = setup("OPEN")

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(1)
		expect(fake.issue(12).labels).toContain("stage:check")
	})

	test("refuses an old merged pull request after the request was reopened", async () => {
		const { fake, context, deps } = setup()
		fake.addComment(12, composeComment("reopen", { comment: "9" }, "no, because"))
		fake.issue(12).labels = ["request", "autopilot", "stage:ready"]

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(1)
		expect(fake.issue(12).state).toBe("OPEN")
		expect(fake.issue(12).labels).toContain("stage:ready")
	})

	test("never removes the main worktree", async () => {
		const { context, fakeOrca, deps } = setup()
		fakeOrca.worktrees = [{ path: "/work/12", isMainWorktree: true }]

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm")).toHaveLength(0)
	})

	test("a failed Orca step exits 3 after GitHub is done, and the next run retries only the failed step", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fakeOrca.failing.add("orchestration worker-release")

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(3)
		expect(fake.issue(12).labels).toContain("stage:done")
		expect(fake.issue(12).state).toBe("CLOSED")

		fakeOrca.failing.clear()
		await landIssue(deps, context, 12)

		expect(fakeOrca.called("worker-release")).toHaveLength(2)
		expect(fakeOrca.called("rm", "path:/work/12")).toHaveLength(1)
	})

	test("a remote worker's worktree is removed through its environment", async () => {
		const { context, fakeOrca, deps } = setup()
		fakeOrca.workers = [
			worker({ hostKind: "environment", hostId: "env-zeus", worktreePath: "/srv/w/12" }),
		]

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm", "--environment", "zeus", "path:/srv/w/12")).toHaveLength(1)
	})

	test("lists workers only in the project's own Run", async () => {
		const { context, fakeOrca, deps } = setup()

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("worker-list", "--run", "run_kit")).toHaveLength(1)
	})
})
