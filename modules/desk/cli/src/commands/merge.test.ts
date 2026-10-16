import { describe, expect, test } from "bun:test"

import { composeComment } from "../github/markers.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { FakeShell, failed } from "../merge/testing.ts"
import { FakeOrca } from "../orca/testing/fake-orca.ts"
import { SECTION, worker } from "../reconcile/testing/fixtures.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { runWith } from "./merge.ts"

function setup(options: { workflows?: boolean; check?: string } = {}) {
	const harness = makeListingHarness()
	const fakeOrca = new FakeOrca()
	const shell = new FakeShell()
	const clock: { ms: number; onSleep: (() => void) | undefined } = { ms: 0, onSleep: undefined }
	const { fake } = harness

	fake.pullRequests.set(
		45,
		Object.assign(
			{
				number: 45,
				state: "OPEN" as const,
				isDraft: false,
				body: "closes #12",
				mergeable: "MERGEABLE" as const,
				headRefOid: "abc",
				baseRefName: "main",
				behindBy: 0,
			},
			{ headRefName: "feature/12" },
		),
	)
	fake.addIssue({
		number: 12,
		labels: ["request", "autopilot", "stage:check"],
		pullRequests: [45],
	})
	fake.addComment(12, claimBody("c_1", "ctx_y"))
	fake.addComment(12, composeComment("result", { claim: "c_1", pr: "45" }, "## Done, check it"))
	fake.addComment(12, "Looks good, merge it")
	fakeOrca.workers = [worker()]

	const deps = {
		orca: fakeOrca.orca,
		loadSection: async () => ({
			...SECTION,
			coordinator: { ...SECTION.coordinator, check: options.check ?? SECTION.coordinator.check },
		}),
		shell: shell.shell,
		hasWorkflows: async () => options.workflows ?? false,
		sleep: async (milliseconds: number) => {
			clock.ms += milliseconds
			clock.onSleep?.()
		},
		nowMs: () => clock.ms,
	}

	return { ...harness, fakeOrca, shell, deps, clock }
}

describe("desk merge", () => {
	test("refuses without a looks good comment newer than the result, and touches nothing", async () => {
		const { fake, context, shell, deps } = setup()
		fake.issue(12).comments.pop()
		fake.addComment(12, "can you rename it first?")

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("looks good")
		expect(shell.calls).toHaveLength(0)
		expect(fake.issue(12).labels).toContain("stage:check")
	})

	test("refuses a looks good that is older than the result", async () => {
		const { fake, context, deps } = setup()
		const comments = fake.issue(12).comments
		fake.issue(12).comments = [comments[0], comments[2], comments[1]].filter(
			(comment) => comment !== undefined,
		)

		expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
	})

	test("refuses on a conflict with main, names the files, pushes and merges nothing", async () => {
		const { fake, context, shell, deps } = setup()
		shell.on("git merge origin/main", failed("CONFLICT (content)"))
		shell.on("git diff --name-only", { code: 0, stdout: "src/a.ts\nsrc/b.ts\n", stderr: "" })

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("src/a.ts, src/b.ts")
		expect(shell.called("git push")).toHaveLength(0)
		expect(shell.called("git merge --abort")).toHaveLength(1)
		expect(shell.called("git worktree remove")).not.toHaveLength(0)
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("refuses when the local check fails and reports the first failing line", async () => {
		const { context, shell, deps } = setup({ check: "bun test" })
		shell.on("sh -c bun test", failed("running\n1 fail: parser rejects empty input\n"))

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("1 fail: parser rejects empty input")
		expect(shell.called("git push")).toHaveLength(0)
	})

	test("runs the check command from the ## desk section", async () => {
		const configured = setup({ check: "bun test" })
		await runWith(configured.deps, ["12"], configured.context)
		expect(configured.shell.called("sh -c bun test")).toHaveLength(1)

		const standard = setup()
		await runWith(standard.deps, ["12"], standard.context)
		expect(standard.shell.called("sh -c mise run check")).toHaveLength(1)
	})

	test("merges with a merge commit, reports no CI configured, and never reads checks", async () => {
		const { fake, context, output, shell, deps } = setup()

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("no CI configured")
		expect(fake.callsMatching(["pr", "merge", "45"])[0]).toContain("--merge")
		expect(fake.callsMatching(["pr", "checks"])).toHaveLength(0)
		expect(fake.calls.some((call) => call.join(" ").includes("check-runs"))).toBe(false)
		expect(shell.called("git push origin HEAD:feature/12")).toHaveLength(1)

		const mergeComment = fake
			.issue(12)
			.comments.find((comment) => comment.body.startsWith("<!-- desk:merge"))
		expect(mergeComment?.body).toStartWith("<!-- desk:merge pr=45 ci=none check=passed -->")
		expect(fake.issue(12).labels).toContain("stage:done")
		expect(fake.issue(12).state).toBe("CLOSED")
	})

	test("reports CI blocked when the failing run was never started because of billing", async () => {
		const { context, output, extras, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 7, name: "ci", status: "completed", conclusion: "failure" }]
		extras.annotations.set(7, [
			{ message: "The job was not started because your account is locked due to a billing issue." },
		])

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("CI blocked")
	})

	test("reports CI blocked when Actions is disabled", async () => {
		const { fake, context, output, extras, deps } = setup({ workflows: true })
		extras.actionsEnabled = false

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("CI blocked")
		expect(fake.issue(12).comments.some((comment) => comment.body.includes("ci=blocked"))).toBe(
			true,
		)
	})

	test("refuses when configured CI is failing for a real reason", async () => {
		const { fake, context, extras, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 8, name: "ci", status: "completed", conclusion: "failure" }]
		extras.annotations.set(8, [{ message: "Process completed with exit code 1." }])

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("CI failing (ci)")
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("waits for CI that is still running, then merges once it passes", async () => {
		const { context, output, extras, clock, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 9, name: "ci", status: "in_progress", conclusion: null }]
		clock.onSleep = () => {
			extras.checkRuns = [{ id: 9, name: "ci", status: "completed", conclusion: "success" }]
		}

		await runWith(deps, ["12"], context)

		expect(clock.ms).toBe(20_000)
		expect(output[0]).toContain("CI passed")
	})

	test("refuses when a started CI run never finishes within the timeout, and merges nothing", async () => {
		const { fake, context, extras, clock, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 9, name: "ci", status: "in_progress", conclusion: null }]

		const failure = await failureOf(runWith(deps, ["12", "--ci-timeout", "5m"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("did not finish within 5 minutes")
		expect(clock.ms).toBeGreaterThanOrEqual(300_000)
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("treats a commit that no workflow ran for as no CI for this change, after a short grace", async () => {
		const { fake, context, output, clock, deps } = setup({ workflows: true })

		await runWith(deps, ["12"], context)

		expect(clock.ms).toBe(120_000)
		expect(output[0]).toContain("no CI ran for this change")
		expect(fake.issue(12).comments.some((comment) => comment.body.includes("ci=none"))).toBe(true)
	})

	test("a run that appears during the grace period is waited on, not skipped", async () => {
		const { context, output, extras, clock, deps } = setup({ workflows: true })
		clock.onSleep = () => {
			extras.checkRuns = [{ id: 9, name: "ci", status: "completed", conclusion: "success" }]
		}

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("CI passed")
	})

	test("refuses when CI fails while it is being waited on", async () => {
		const { fake, context, extras, clock, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 9, name: "ci", status: "queued", conclusion: null }]
		extras.annotations.set(9, [{ message: "Process completed with exit code 1." }])
		clock.onSleep = () => {
			extras.checkRuns = [{ id: 9, name: "ci", status: "completed", conclusion: "failure" }]
		}

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.message).toContain("CI failing (ci)")
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("refuses when a human comments no during the local check", async () => {
		const { fake, context, shell, deps } = setup()
		shell.on("sh -c", () => {
			fake.addComment(12, "no, because the count should start at 0")

			return { code: 0, stdout: "", stderr: "" }
		})

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
		expect(fake.issue(12).labels).toContain("stage:check")
	})

	test("merges only the commit that passed the check", async () => {
		const { fake, context, deps } = setup()

		await runWith(deps, ["12"], context)

		const [call] = fake.callsMatching(["pr", "merge", "45"])
		expect(call?.slice(call.indexOf("--match-head-commit"))).toEqual([
			"--match-head-commit",
			"sha123",
		])
	})

	test("lands the issue: the worker is released after the merge", async () => {
		const { context, fakeOrca, deps } = setup()

		await runWith(deps, ["12"], context)

		expect(fakeOrca.called("worker-release", "ctx_y")).toHaveLength(1)
	})
})
