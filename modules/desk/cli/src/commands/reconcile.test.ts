import { describe, expect, test } from "bun:test"
import { failureOf } from "../github/testing/seed.ts"
import { FakeOrca } from "../orca/testing/fake-orca.ts"
import { SECTION, worker } from "../reconcile/testing/fixtures.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { runWith } from "./reconcile.ts"

function setup() {
	const harness = makeListingHarness({ json: true })
	const fakeOrca = new FakeOrca()
	const deps = { orca: fakeOrca.orca, loadSection: async () => SECTION }

	return { ...harness, fakeOrca, deps }
}

describe("desk reconcile command", () => {
	test("never reads the Orca mailbox", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fake.addIssue({ number: 12 })
		fakeOrca.workers = [worker()]
		fakeOrca.messages = [
			{
				id: "msg_1",
				type: "worker_done",
				from: "term_x",
				subject: "done",
				createdAt: "2026-10-16T14:00:00Z",
			},
		]

		await runWith(deps, [], context)

		const touched = fakeOrca.calls.map((call) => call.join(" "))
		expect(
			touched.some((call) => call.includes("inbox") || call.includes("orchestration check")),
		).toBe(false)
		expect(touched.some((call) => call.includes("worker-list"))).toBe(true)
	})

	test("prints the mismatch list as JSON", async () => {
		const { fake, context, output, deps } = setup()
		fake.addIssue({ number: 12 })

		await runWith(deps, [], context)

		const [line] = output
		expect(JSON.parse(line ?? "{}").mismatches).toMatchObject([
			{ issue: 12, code: "dispatch", machine: "Minerva" },
		])
	})

	test("a ready request with a kept worktree is dispatched into it, found from Orca's worktree list", async () => {
		const { fake, context, output, fakeOrca, deps } = setup()
		fake.addIssue({ number: 16, labels: ["request", "autopilot", "stage:ready"] })
		fakeOrca.worktrees = [
			{ path: "/work/main", isMainWorktree: true },
			{ path: "/work/16", isMainWorktree: false },
		]

		await runWith(deps, [], context)

		expect(JSON.parse(output[0] ?? "{}").mismatches).toMatchObject([
			{ issue: 16, code: "dispatch", workerStart: ["--worktree", "path:/work/16"] },
		])
	})

	test("never dispatches into a same-named worktree of another repository or host", async () => {
		const { fake, context, output, fakeOrca, deps } = setup()
		fake.addIssue({ number: 16, labels: ["request", "autopilot", "stage:ready"] })
		fakeOrca.worktrees = [
			{ path: "/scratch/16", isMainWorktree: false, repoId: "repo_scratch" },
			{ path: "/remote/16", isMainWorktree: false, hostId: "env-zeus" },
		]

		await runWith(deps, [], context)

		expect(JSON.parse(output[0] ?? "{}").mismatches[0].workerStart[1]).toBe("new-child")
	})

	test("refuses to reconcile when Orca truncated the worktree list", async () => {
		const { fake, context, fakeOrca, deps } = setup()
		fake.addIssue({ number: 16, labels: ["request", "autopilot", "stage:ready"] })
		fakeOrca.worktreesTruncated = true

		await expect(runWith(deps, [], context)).rejects.toThrow("truncated")
	})

	test("joins a live worker to its request through the task title", async () => {
		const { fake, context, output, fakeOrca, deps } = setup()
		fake.addIssue({ number: 12, labels: ["request", "autopilot", "stage:ready"] })
		fakeOrca.workers = [worker()]
		fakeOrca.tasks = [{ id: "task_y", title: "#12 Add greet", createdAt: "2026-10-16T13:00:00Z" }]

		await runWith(deps, [], context)

		expect(JSON.parse(output[0] ?? "{}").mismatches).toMatchObject([
			{ issue: 12, code: "unclaimed-worker" },
		])
	})

	test("lists workers and tasks only in the project's own Run, so another project's worker is never touched", async () => {
		const { fake, context, output, fakeOrca, deps } = setup()
		fake.addIssue({
			number: 12,
			state: "CLOSED",
			labels: ["request", "stage:done"],
		})
		fakeOrca.runs = [
			{ id: "run_other", objective: "desk milkyskies/other" },
			{ id: "run_kit", objective: "desk milkyskies/kit" },
		]
		fakeOrca.workers = [worker({ dispatchId: "ctx_other", taskId: "task_other" })]
		fakeOrca.workerRuns.set("ctx_other", "run_other")
		fakeOrca.tasks = [
			{ id: "task_other", title: "#12 Other project", createdAt: "2026-10-16T13:00:00Z" },
		]

		await runWith(deps, [], context)

		expect(JSON.parse(output[0] ?? "{}").mismatches).toEqual([])
		expect(fakeOrca.called("worker-list", "--run", "run_kit")).toHaveLength(1)
		expect(fakeOrca.called("task-list", "--run", "run_kit")).toHaveLength(1)
	})

	test("refuses when the project has no Run yet, and names the fix", async () => {
		const { context, fakeOrca, deps } = setup()
		fakeOrca.runs = []

		const failure = await failureOf(runWith(deps, [], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("desk run")
	})

	test("refuses a worker list that covered every Run", async () => {
		const { context, deps, fakeOrca } = setup()
		fakeOrca.ignoreRunFlag = true

		await expect(runWith(deps, [], context)).rejects.toThrow("every Run")
	})
})
