import { describe, expect, test } from "bun:test"

import { composeComment } from "../github/markers.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { FakeShell, failed, ok } from "../merge/testing.ts"
import { OrcaError } from "../orca/runner.ts"
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

	const fakeShell = new FakeShell()
	fakeShell.on("git -C /work/12 rev-list --count", ok("0\n"))

	return { ...harness, fakeOrca, fakeShell, deps: { orca: fakeOrca.orca, shell: fakeShell.shell } }
}

const MUTATING = ["worker-release", "worker-stop", "rm"]

function mutations(fakeOrca: FakeOrca): string[][] {
	return fakeOrca.calls.filter((call) => MUTATING.some((word) => call.includes(word)))
}

describe("frontdesk land", () => {
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

	test("lands a closed request whose pull request was merged by hand, with no result", async () => {
		const { fake, context, deps } = setup()
		fake.issue(12).comments = []
		fake.issue(12).state = "CLOSED"
		fake.issue(12).labels = ["request", "stage:working"]

		await landIssue(deps, context, 12)

		expect(fake.issue(12).labels).toEqual(["request", "stage:done"])
	})

	test("refuses before writing anything when the project has no Run", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fakeOrca.runs = []

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(1)
		expect(fake.issue(12).labels).toContain("stage:check")
		expect(fake.issue(12).state).toBe("OPEN")
	})

	test("never removes the main worktree", async () => {
		const { context, fakeOrca, deps } = setup()
		fakeOrca.worktrees = [{ path: "/work/12", isMainWorktree: true }]

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm")).toHaveLength(0)
	})

	test("removes the unused kept worktree beside the worker's own, and no other issue's", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeOrca.workers = [worker({ worktreePath: "/work/12-2" })]
		fakeOrca.worktrees = [
			{ path: "/work/12", isMainWorktree: false },
			{ path: "/work/12-2", isMainWorktree: false },
			{ path: "/work/120", isMainWorktree: false },
			{ path: "/work/1", isMainWorktree: false },
		]
		fakeShell.on("git -C /work/12-2 rev-list --count", ok("0\n"))

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm").map((call) => call.at(-1))).toEqual([
			"path:/work/12-2",
			"path:/work/12",
		])
	})

	test("keeps an unused kept worktree that holds unpushed commits, and still removes the others", async () => {
		const { fake, context, fakeOrca, fakeShell, deps } = setup()
		fakeOrca.workers = [worker({ worktreePath: "/work/12-2" })]
		fakeOrca.worktrees = [
			{ path: "/work/12", isMainWorktree: false },
			{ path: "/work/12-2", isMainWorktree: false },
		]
		fakeShell.on("git -C /work/12-2 rev-list --count", ok("0\n"))
		fakeShell.on("git -C /work/12 rev-list --count @{upstream}..HEAD", ok("3\n"))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm").map((call) => call.at(-1))).toEqual(["path:/work/12-2"])
		expect(report.kept).toEqual([{ path: "/work/12", reason: "3 unpushed commits" }])
		expect(fake.issue(12).comments.at(-1)?.body).toContain("worktree-kept: /work/12")
	})

	test("never removes a same-named worktree of another repository", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeOrca.worktrees = [
			{ path: "/work/12", isMainWorktree: false },
			{ path: "/scratch/12", isMainWorktree: false, repoId: "repo_scratch" },
			{ path: "/remote/12", isMainWorktree: false, hostId: "env-zeus" },
		]
		fakeShell.on("git -C /scratch/12 rev-list --count", ok("0\n"))
		fakeShell.on("git -C /remote/12 rev-list --count", ok("0\n"))

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm").map((call) => call.at(-1))).toEqual(["path:/work/12"])
	})

	test("skips an unused worktree with a live terminal in it", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeOrca.workers = [worker({ worktreePath: "/work/12-2" })]
		fakeOrca.worktrees = [
			{ path: "/work/12", isMainWorktree: false, liveTerminalCount: 1 },
			{ path: "/work/12-2", isMainWorktree: false },
		]
		fakeShell.on("git -C /work/12-2 rev-list --count", ok("0\n"))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm").map((call) => call.at(-1))).toEqual(["path:/work/12-2"])
		expect(report.kept).toEqual([{ path: "/work/12", reason: "a terminal is still open in it" }])
	})

	test("does not sweep a hand-made 12-experiment worktree or one on another branch", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeOrca.worktrees = [
			{ path: "/work/12", isMainWorktree: false },
			{ path: "/work/12-experiment", isMainWorktree: false },
			{ path: "/work/12-3", isMainWorktree: false, branch: "refs/heads/someone/else" },
		]
		fakeShell.on("git -C /work/12-experiment rev-list --count", ok("0\n"))
		fakeShell.on("git -C /work/12-3 rev-list --count", ok("0\n"))

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm").map((call) => call.at(-1))).toEqual(["path:/work/12"])
	})

	test("exits 3 after GitHub is done and removes nothing when Orca cannot name the current worktree", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fakeOrca.failing.add("worktree current")

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(3)
		expect(fake.issue(12).state).toBe("CLOSED")
		expect(fakeOrca.called("rm")).toHaveLength(0)
	})

	test("refuses the cleanup when Orca truncated the worktree list", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fakeOrca.worktreesTruncated = true

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(3)
		expect(failure.message).toContain("truncated")
		expect(fake.issue(12).state).toBe("CLOSED")
	})

	test("removes the kept worktree when no worker row is left for the claim", async () => {
		const { context, fakeOrca, deps } = setup()
		fakeOrca.workers = []

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm", "path:/work/12")).toHaveLength(1)
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

	test("a worktree reporting only untracked files is removed with force, and the paths are listed", async () => {
		const { fake, context, fakeOrca, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 status --porcelain", ok("?? .serena/\n"))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm", "path:/work/12", "--force")).toHaveLength(1)
		expect(report.removedUntracked).toEqual([".serena/"])
		expect(report.kept).toEqual([])
		expect(fake.issue(12).comments.at(-1)?.body).toContain(".serena/")
	})

	test("a clean worktree is removed without force", async () => {
		const { fakeOrca, context, deps } = setup()

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm", "path:/work/12")).toHaveLength(1)
		expect(fakeOrca.called("rm", "--force")).toHaveLength(0)
	})

	test("a worktree with modified tracked files is kept, with the reason, and land still succeeds", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 status --porcelain", ok(" M src/a.ts\n?? .serena/\n"))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm")).toHaveLength(0)
		expect(report.kept).toEqual([{ path: "/work/12", reason: "modified tracked files: src/a.ts" }])
	})

	test("a worktree with unpushed commits is kept, with the reason", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 rev-list --count @{upstream}..HEAD", ok("2\n"))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm")).toHaveLength(0)
		expect(report.kept[0]?.reason).toBe("2 unpushed commits")
	})

	test("a branch without an upstream is compared against origin/main", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 rev-list --count @{upstream}..HEAD", failed(""))
		fakeShell.on("git -C /work/12 rev-list --count origin/main..HEAD", ok("1\n"))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm")).toHaveLength(0)
		expect(report.kept[0]?.reason).toBe("1 unpushed commit")
	})

	test("a kept worktree is reported on the issue once, however many times land runs", async () => {
		const { fake, context, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 rev-list --count @{upstream}..HEAD", ok("2\n"))

		await landIssue(deps, context, 12)
		const commentsAfterFirst = fake.issue(12).comments.length
		await landIssue(deps, context, 12)

		expect(fake.issue(12).comments).toHaveLength(commentsAfterFirst)
	})

	test("a remote worktree that Orca refuses as dirty is kept, not retried as a failure", async () => {
		const { context, fakeOrca, deps } = setup()
		fakeOrca.worktrees = []
		fakeOrca.workers = [
			worker({ hostKind: "environment", hostId: "env-zeus", worktreePath: "/srv/w/12" }),
		]
		const refuse: typeof deps.orca = async (args) => {
			if (args.includes("rm")) {
				throw new OrcaError(args, "Failed to delete worktree at /srv/w/12. M src/a.ts")
			}

			return fakeOrca.orca(args)
		}

		const report = await landIssue({ ...deps, orca: refuse }, context, 12)

		expect(report.kept[0]?.path).toBe("/srv/w/12")
	})

	test("a remote worktree removal that fails for another reason exits 3 so the next pass retries", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fakeOrca.workers = [
			worker({ hostKind: "environment", hostId: "env-zeus", worktreePath: "/srv/w/12" }),
		]
		fakeOrca.failing.add("worktree rm")

		const failure = await failureOf(landIssue(deps, context, 12))

		expect(failure.code).toBe(3)
		expect(
			fake
				.issue(12)
				.comments.map((comment) => comment.body)
				.join("\n"),
		).not.toContain("worktree-kept")
	})

	test("an empty rev-list output keeps the worktree instead of reading as zero unpushed commits", async () => {
		const { context, fakeOrca, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 status --porcelain", ok("?? .serena/\n"))
		fakeShell.on("git -C /work/12 rev-list --count", ok(""))

		const report = await landIssue(deps, context, 12)

		expect(fakeOrca.called("rm")).toHaveLength(0)
		expect(report.kept[0]?.reason).toBe("cannot tell whether the branch has unpushed commits")
	})

	test("a kept worktree whose reason changed between runs is still noted once", async () => {
		const { fake, context, fakeShell, deps } = setup()
		fakeShell.on("git -C /work/12 rev-list --count @{upstream}..HEAD", ok("2\n"))
		await landIssue(deps, context, 12)
		const commentsAfterFirst = fake.issue(12).comments.length

		fakeShell.on("git -C /work/12 rev-list --count @{upstream}..HEAD", ok("3\n"))
		await landIssue(deps, context, 12)

		expect(fake.issue(12).comments).toHaveLength(commentsAfterFirst)
	})

	test("lists workers only in the project's own Run", async () => {
		const { context, fakeOrca, deps } = setup()

		await landIssue(deps, context, 12)

		expect(fakeOrca.called("worker-list", "--run", "run_kit")).toHaveLength(1)
	})
})
