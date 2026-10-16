import { describe, expect, test } from "bun:test"
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
})
