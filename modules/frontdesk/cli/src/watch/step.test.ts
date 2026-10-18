import { describe, expect, test } from "bun:test"

import type { IssueState } from "../github/issue.ts"
import type { Message } from "../orca/inbox.ts"
import type { Worker } from "../orca/workers.ts"
import {
	claim,
	input,
	issue,
	minutesAgo,
	NOW,
	result,
	SECTION,
	worker,
} from "../reconcile/testing/fixtures.ts"
import { memoryLedger } from "./ledger.ts"
import { parseDuration, watchLoop } from "./loop.ts"
import { dispatchableAtStart } from "./startup.ts"
import { newWatchState, step, type WatchDeps } from "./step.ts"

const MAX_WAIT = 30 * 60_000

class Harness {
	clock = new Date(NOW)
	workers: Worker[] = []
	messages: Message[] | undefined = []
	issues: IssueState[] = []
	reachable = new Map<string, boolean>()
	releases: [number, string][] = []
	failRelease = false
	unknown = false
	githubReads = 0
	ledger = memoryLedger()
	section = SECTION

	readonly deps: WatchDeps = {
		now: () => this.clock,
		workers: async () => this.workers,
		mail: async () => this.messages,
		issues: async () => {
			this.githubReads += 1

			return this.issues
		},
		reachability: async (machine) => {
			if (this.unknown) return "unknown"

			return (this.reachable.get(machine) ?? true) ? "reachable" : "unreachable"
		},
		release: async (number, claimId) => {
			if (this.failRelease) throw new Error("refused")
			this.releases.push([number, claimId])
		},
		startupWork: async () =>
			dispatchableAtStart(
				input({
					issues: this.issues,
					workers: this.workers,
					section: this.section,
					now: this.clock,
				}),
			),
		localMachine: "Minerva",
		ledger: this.ledger,
	}

	state = newWatchState(this.clock)

	advance(minutes: number): void {
		this.clock = new Date(this.clock.getTime() + minutes * 60_000)
	}

	poll(maxWait = MAX_WAIT) {
		return step(this.state, this.deps, maxWait)
	}

	freshRun(): void {
		this.state = newWatchState(this.clock)
	}
}

const RESULT = result("c_1", "45")
const WORKING = ["request", "autopilot", "stage:working"]
const FRESH = (id: string, dispatch: string) => claim(id, dispatch, minutesAgo(1))

function message(
	id: string,
	type: string,
	from = "term_worker",
	dispatchId?: string,
	at = NOW,
): Message {
	return { id, type, from, subject: type, createdAt: at, dispatchId }
}

describe("frontdesk watch", () => {
	test("worker-stopped: a worker seen working that stops at its prompt wakes at once", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [FRESH("c_1", "ctx_y")])]
		h.workers = [worker({ activity: "working" })]
		expect(await h.poll()).toEqual([])

		h.advance(0.5)
		h.workers = [worker({ activity: "done" })]

		expect(await h.poll()).toEqual([{ event: "worker-stopped", issue: 12, dispatch: "ctx_y" }])
	})

	test("worker-idle: a worker already idle at the start wakes only after 10 minutes", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [FRESH("c_1", "ctx_y")])]
		h.workers = [worker({ activity: "done" })]

		expect(await h.poll()).toEqual([])
		h.advance(9)
		expect(await h.poll()).toEqual([])
		h.advance(1)

		expect(await h.poll()).toEqual([{ event: "worker-idle", issue: 12, dispatch: "ctx_y" }])
	})

	test("worker-hung: working with no heartbeat for 20 minutes", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_y", minutesAgo(25))])]
		h.workers = [worker()]

		expect(await h.poll()).toEqual([{ event: "worker-hung", issue: 12, dispatch: "ctx_y" }])
	})

	test("worker-hung: a heartbeat five minutes ago keeps the worker quiet", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_y", minutesAgo(25))])]
		h.workers = [worker()]
		h.messages = [
			message("msg_h", "heartbeat", "term_worker", "ctx_y", new Date(NOW.getTime() - 5 * 60_000)),
		]

		expect(await h.poll()).toEqual([])
	})

	test("worker-gone: the worker's liveness verdict is exited", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [FRESH("c_1", "ctx_y")])]
		h.workers = [worker({ verdict: "exited", terminalState: "released" })]

		expect(await h.poll()).toEqual([{ event: "worker-gone", issue: 12, dispatch: "ctx_y" }])
	})

	test("machine-silent: 15 minutes unreachable releases every claim on that machine, then wakes", async () => {
		const h = new Harness()
		h.issues = [
			issue(12, WORKING, [claim("c_1", "ctx_a", minutesAgo(5), "zeus")]),
			issue(13, WORKING, [claim("c_2", "ctx_b", minutesAgo(5), "zeus")]),
			issue(14, WORKING, [claim("c_3", "ctx_c", minutesAgo(5), "Minerva")]),
		]
		h.reachable.set("zeus", false)

		expect(await h.poll()).toEqual([])
		h.advance(14)
		expect(await h.poll()).toEqual([])
		expect(h.releases).toEqual([])
		h.advance(1)

		const events = await h.poll()

		expect(h.releases).toEqual([
			[12, "c_1"],
			[13, "c_2"],
		])
		expect(events).toEqual([
			{ event: "machine-silent", machine: "zeus", released: [12, 13], failed: [] },
		])
	})

	test("machine-silent: polls where the local Orca cannot answer never count against a remote machine", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_a", minutesAgo(5), "zeus")])]
		h.reachable.set("zeus", false)
		h.unknown = true

		await h.poll()
		h.advance(20)

		expect(await h.poll()).toEqual([])
		expect(h.releases).toEqual([])
	})

	test("machine-silent: a poll the local Orca cannot answer wipes the earlier unreachable start", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_a", minutesAgo(5), "zeus")])]
		h.reachable.set("zeus", false)
		await h.poll()
		h.advance(5)
		h.unknown = true
		await h.poll()
		h.advance(20)
		h.unknown = false

		expect(await h.poll()).toEqual([])
		expect(h.releases).toEqual([])
	})

	test("machine-silent: a machine that answers in between starts the 15 minutes over", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_a", minutesAgo(5), "zeus")])]
		h.reachable.set("zeus", false)
		await h.poll()
		h.advance(10)
		h.reachable.set("zeus", true)
		await h.poll()
		h.advance(10)
		h.reachable.set("zeus", false)

		expect(await h.poll()).toEqual([])
		expect(h.releases).toEqual([])
	})

	test("machine-silent: the 15 minutes carry over to a fresh watch run", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_a", minutesAgo(5), "zeus")])]
		h.reachable.set("zeus", false)
		await h.poll()
		h.advance(16)
		h.freshRun()

		const events = await h.poll()

		expect(events).toMatchObject([{ event: "machine-silent", released: [12] }])
	})

	test("machine-silent: a release that is refused is reported as failed, never crashes the watch", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [claim("c_1", "ctx_a", minutesAgo(30), "zeus")])]
		h.reachable.set("zeus", false)
		h.failRelease = true
		await h.poll()
		h.advance(15)

		expect(await h.poll()).toEqual([
			{ event: "machine-silent", machine: "zeus", released: [], failed: [12] },
		])
	})

	test("human-comment: a new human comment on a parked or checked request", async () => {
		const h = new Harness()
		const labels = ["request", "autopilot", "stage:needs-you"]
		h.issues = [issue(12, labels, ["<!-- frontdesk:decision -->\nq\n\n<!-- frontdesk:agent -->\n"])]
		await h.poll()
		h.advance(1)
		h.issues = [
			issue(12, labels, [
				"<!-- frontdesk:decision -->\nq\n\n<!-- frontdesk:agent -->\n",
				"what does it hold?",
			]),
		]

		expect(await h.poll()).toEqual([{ event: "human-comment", issue: 12 }])
	})

	test("human-comment: an agent comment does not wake", async () => {
		const h = new Harness()
		const labels = ["request", "autopilot", "stage:check"]
		h.issues = [issue(12, labels, [])]
		await h.poll()
		h.advance(1)
		h.issues = [
			issue(12, labels, ["<!-- frontdesk:result claim=c pr=1 -->\nDone\n\n<!-- frontdesk:agent -->\n"]),
		]

		expect(await h.poll()).toEqual([])
	})

	test("ready: a request that newly reaches stage:ready", async () => {
		const h = new Harness()
		h.issues = [issue(1, ["request", "stage:ready"]), issue(2, ["request", "stage:needs-you"])]
		expect(await h.poll()).toEqual([])
		h.advance(1)
		h.issues = [
			issue(1, ["request", "stage:ready"]),
			issue(2, ["request", "autopilot", "stage:ready"]),
		]

		expect(await h.poll()).toEqual([{ event: "ready", issue: 2 }])
	})

	test("a parked frontman request that is answered back to intake wakes the coordinator", async () => {
		const h = new Harness()
		h.issues = [issue(5, ["request", "stage:needs-you"])]
		expect(await h.poll()).toEqual([])
		h.advance(1)
		h.issues = [issue(5, ["request", "stage:intake"])]

		expect(await h.poll()).toEqual([{ event: "ready", issue: 5 }])
	})

	test("a proposal waiting for Milky's yes does not wake the coordinator", async () => {
		const h = new Harness()
		h.issues = [issue(5, ["request", "stage:needs-you"])]
		expect(await h.poll()).toEqual([])
		h.advance(1)
		h.issues = [issue(5, ["request", "proposed", "stage:intake"])]

		expect(await h.poll()).toEqual([])
	})

	test("released_request_does_not_wait_for_the_tick", async () => {
		const h = new Harness()
		h.issues = [issue(34, ["request", "autopilot", "stage:ready"])]

		expect(await h.poll()).toEqual([{ event: "ready", issue: 34 }])
	})

	test("full_slots_do_not_wake_the_coordinator", async () => {
		const h = new Harness()
		h.section = { ...SECTION, machines: [{ name: "Minerva", workers: 1, repo: undefined }] }
		h.issues = [issue(34, ["request", "autopilot", "stage:ready"])]
		h.workers = [worker({ dispatchId: "ctx_other", taskId: "task_other" })]

		expect(await h.poll()).toEqual([])
	})

	test("merged: a linked pull request that newly merged", async () => {
		const h = new Harness()
		const open = { number: 45, state: "OPEN", isDraft: false, mergeable: "MERGEABLE" }
		h.issues = [issue(12, ["request", "stage:check"], [RESULT], { pullRequests: [open] })]
		await h.poll()
		h.advance(1)
		h.issues = [
			issue(12, ["request", "stage:check"], [RESULT], {
				pullRequests: [{ ...open, state: "MERGED" }],
			}),
		]

		expect(await h.poll()).toEqual([{ event: "merged", issue: 12 }])
	})

	test("mail: a worker's message wakes once; heartbeats and the Run's own mail never do", async () => {
		const h = new Harness()
		await h.poll()
		h.messages = [
			message("msg_1", "worker_done"),
			message("msg_2", "heartbeat", "term_worker", "ctx_y"),
			message("msg_3", "status", "run:run_1"),
		]

		expect(await h.poll()).toEqual([{ event: "mail", ids: ["msg_1"] }])

		h.freshRun()
		expect(await h.poll()).toEqual([])
	})

	test("mail: messages already in the mailbox when the watch first runs are not a wake", async () => {
		const h = new Harness()
		h.messages = [message("msg_old", "worker_done")]

		expect(await h.poll()).toEqual([])
		h.messages = [message("msg_old", "worker_done"), message("msg_new", "escalation")]

		expect(await h.poll()).toEqual([{ event: "mail", ids: ["msg_new"] }])
	})

	test("mail: a failed mailbox read is skipped, never taken as an empty mailbox", async () => {
		const h = new Harness()
		h.messages = [message("msg_old", "worker_done")]
		await h.poll()
		h.messages = undefined

		expect(await h.poll()).toEqual([])

		h.messages = [message("msg_old", "worker_done")]
		expect(await h.poll()).toEqual([])
	})

	test("tick: nothing happened for the whole --max-wait", async () => {
		const h = new Harness()
		expect(await h.poll()).toEqual([])
		h.advance(30)

		expect(await h.poll()).toEqual([{ event: "tick" }])
	})

	test("GitHub is read once a minute, not every 30-second poll", async () => {
		const h = new Harness()

		await h.poll()
		h.advance(0.5)
		await h.poll()
		h.advance(0.5)
		await h.poll()

		expect(h.githubReads).toBe(2)
	})

	test("a GitHub read that fails is skipped and retried", async () => {
		const h = new Harness()
		let calls = 0
		h.deps.issues = async () => {
			calls += 1
			if (calls === 1) throw new Error("rate limited")

			return []
		}

		expect(await h.poll()).toEqual([])
		h.advance(0.5)
		expect(await h.poll()).toEqual([])
		expect(calls).toBe(2)
	})

	test("the loop sleeps between polls and returns the first wake", async () => {
		const h = new Harness()
		h.issues = [issue(12, WORKING, [FRESH("c_1", "ctx_y")])]
		h.workers = [worker({ verdict: "exited", terminalState: "released" })]
		let polls = 0
		const original = h.deps.workers
		h.deps.workers = async () => {
			polls += 1

			return polls < 3 ? [worker()] : original()
		}
		const slept: number[] = []

		const events = await watchLoop(
			h.deps,
			async (ms) => {
				slept.push(ms)
				h.advance(ms / 60_000)
			},
			MAX_WAIT,
		)

		expect(slept).toEqual([30_000, 30_000])
		expect(events).toEqual([{ event: "worker-gone", issue: 12, dispatch: "ctx_y" }])
	})

	test("--max-wait reads seconds, minutes and hours, and refuses anything else", () => {
		expect(parseDuration("90s")).toBe(90_000)
		expect(parseDuration("30m")).toBe(1_800_000)
		expect(parseDuration("2h")).toBe(7_200_000)
		expect(() => parseDuration("soon")).toThrow("--max-wait")
	})
})
