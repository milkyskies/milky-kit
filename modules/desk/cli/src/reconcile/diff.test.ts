import { describe, expect, test } from "bun:test"
import { composeComment } from "../github/markers.ts"
import { reconcile } from "./diff.ts"
import {
	claim,
	decision,
	HOSTS,
	input,
	issue,
	minutesAgo,
	release,
	result,
	SECTION,
	task,
	worker,
	worktreeRow,
} from "./testing/fixtures.ts"

const READY = ["request", "autopilot", "stage:ready"]
const WORKING = ["request", "autopilot", "stage:working"]
const CHECK = ["request", "autopilot", "stage:check"]
const NEEDS_YOU = ["request", "autopilot", "stage:needs-you"]

function codes(...args: Parameters<typeof input>) {
	return reconcile(input(...args)).map((mismatch) => [mismatch.issue, mismatch.code])
}

describe("desk reconcile", () => {
	test("dispatch: a ready, eligible request with no worker", () => {
		const [mismatch] = reconcile(input({ issues: [issue(12, READY)] }))

		expect(mismatch).toMatchObject({ issue: 12, code: "dispatch", machine: "Minerva", attempts: 0 })
	})

	test("dispatch: starts the worker in a new worktree when the request has none", () => {
		const [mismatch] = reconcile(input({ issues: [issue(16, READY)] }))

		expect(mismatch?.workerStart).toEqual([
			"--worktree",
			"new-child",
			"--name",
			"16",
			"--base-branch",
			"main",
		])
	})

	test("dispatch: starts the worker in the worktree a parked request kept", () => {
		const worktrees = [worktreeRow("/work/15"), worktreeRow("/work/16")]

		const [mismatch] = reconcile(input({ issues: [issue(16, READY)], worktrees }))

		expect(mismatch?.workerStart).toEqual(["--worktree", "path:/work/16"])
	})

	test("dispatch: a kept worktree named <n>-<suffix> is found, and the plain <n> wins over it", () => {
		const suffixed = [worktreeRow("/work/16-2")]
		const both = [...suffixed, worktreeRow("/work/16")]

		const [onlySuffixed] = reconcile(input({ issues: [issue(16, READY)], worktrees: suffixed }))
		const [preferred] = reconcile(input({ issues: [issue(16, READY)], worktrees: both }))

		expect(onlySuffixed?.workerStart).toEqual(["--worktree", "path:/work/16-2"])
		expect(preferred?.workerStart).toEqual(["--worktree", "path:/work/16"])
	})

	test("dispatch: a hand-made 16-experiment or 2026-redesign worktree is not the request's", () => {
		const worktrees = [worktreeRow("/work/16-experiment"), worktreeRow("/work/2026-redesign")]

		const mismatches = reconcile(
			input({ issues: [issue(16, READY), issue(2026, READY)], worktrees }),
		)

		expect(mismatches.map((mismatch) => mismatch.workerStart?.[1])).toEqual([
			"new-child",
			"new-child",
		])
	})

	test("dispatch: Orca's generated <n>-<digits> worktree is the request's", () => {
		const worktrees = [worktreeRow("/work/16-2", { branch: "refs/heads/milkyskies/16-2" })]

		const [mismatch] = reconcile(input({ issues: [issue(16, READY)], worktrees }))

		expect(mismatch?.workerStart).toEqual(["--worktree", "path:/work/16-2"])
	})

	test("dispatch: a worktree named <n> on another request's branch is not reused", () => {
		const worktrees = [worktreeRow("/work/16", { branch: "refs/heads/milkyskies/other-work" })]

		const [mismatch] = reconcile(input({ issues: [issue(16, READY)], worktrees }))

		expect(mismatch?.workerStart?.[1]).toBe("new-child")
	})

	test("dispatch: a worktree of another issue or the main checkout is never reused", () => {
		const worktrees = [
			worktreeRow("/work/160"),
			worktreeRow("/work/1"),
			worktreeRow("/work/16", { isMain: true }),
		]

		const [mismatch] = reconcile(input({ issues: [issue(16, READY)], worktrees }))

		expect(mismatch?.workerStart?.[1]).toBe("new-child")
	})

	test("escalate: carries the same worker-start arguments", () => {
		const bodies = [
			claim("c_1", "ctx_1"),
			release("c_1", "stopped"),
			claim("c_2", "ctx_2"),
			release("c_2", "stopped"),
		]
		const worktrees = [worktreeRow("/work/12")]

		const [mismatch] = reconcile(input({ issues: [issue(12, READY, bodies)], worktrees }))

		expect(mismatch).toMatchObject({
			code: "escalate",
			workerStart: ["--worktree", "path:/work/12"],
		})
	})

	test("dispatch: a remote machine starts a top-level worktree in its own repository", () => {
		const section = {
			...SECTION,
			machines: [
				{ name: "Minerva", workers: 0, repo: undefined },
				{ name: "zeus", workers: 1, repo: "~/Code/kit" },
			],
		}
		const worktrees = [worktreeRow("/work/5")]

		const [mismatch] = reconcile(input({ issues: [issue(5, READY)], section, worktrees }))

		expect(mismatch?.workerStart).toEqual([
			"--on",
			"zeus",
			"--worktree",
			"new-top-level",
			"--repo",
			"~/Code/kit",
		])
	})

	test("dispatch: skips a request without autopilot, with a blocker, or with an open sub-issue", () => {
		const issues = [
			issue(1, ["request", "stage:ready"]),
			issue(2, READY, [], { openBlockers: [9] }),
			issue(3, READY, [], { openSubIssues: [10] }),
		]

		expect(codes({ issues })).toEqual([])
	})

	test("dispatch: stops at the machine's worker limit, highest priority first", () => {
		const issues = [
			issue(1, [...READY, "priority:P3"]),
			issue(2, [...READY, "priority:P0"]),
			issue(3, [...READY, "priority:P2"]),
		]
		const section = { ...SECTION, machines: [{ name: "Minerva", workers: 2, repo: undefined }] }

		expect(codes({ issues, section })).toEqual([
			[2, "dispatch"],
			[3, "dispatch"],
		])
	})

	test("dispatch: live workers on a machine use up its slots", () => {
		const section = { ...SECTION, machines: [{ name: "Minerva", workers: 1, repo: undefined }] }
		const workers = [worker({ dispatchId: "ctx_other", taskId: "task_other" })]

		expect(codes({ issues: [issue(5, READY)], workers, section })).toEqual([])
	})

	test("dispatch: a remote machine with a free slot takes the request", () => {
		const section = {
			...SECTION,
			machines: [
				{ name: "Minerva", workers: 0, repo: undefined },
				{ name: "zeus", workers: 1, repo: "~/Code/kit" },
			],
		}

		const [mismatch] = reconcile(input({ issues: [issue(5, READY)], section }))

		expect(mismatch?.machine).toBe("zeus")
	})

	test("escalate: a ready request with two attempts", () => {
		const bodies = [
			claim("c_1", "ctx_1"),
			composeFailure("c_1"),
			claim("c_2", "ctx_2"),
			composeFailure("c_2"),
		]

		const [mismatch] = reconcile(input({ issues: [issue(12, READY, bodies)] }))

		expect(mismatch).toMatchObject({ code: "escalate", attempts: 2 })
	})

	test("orphan-claim: the claim names an absent dispatch and is older than 10 minutes", () => {
		const issues = [issue(12, WORKING, [claim("c_1", "ctx_gone", minutesAgo(11))])]

		const [mismatch] = reconcile(input({ issues }))

		expect(mismatch).toMatchObject({ code: "orphan-claim", claim: "c_1", worker: "ctx_gone" })
	})

	test("a remote claim whose worker row is missing waits for the silent-machine rule", () => {
		const remote = [issue(12, WORKING, [claim("c_1", "ctx_gone", minutesAgo(30), "zeus")])]
		const local = [issue(12, WORKING, [claim("c_1", "ctx_gone", minutesAgo(30), "Minerva")])]

		expect(codes({ issues: remote })).toEqual([[12, "remote-claim-unseen"]])
		expect(codes({ issues: local })).toEqual([[12, "orphan-claim"]])
	})

	test("orphan-claim: a remote worker that is listed as exited still counts", () => {
		const gone = worker({ verdict: "exited", terminalState: "released", hostKind: "environment" })
		const issues = [issue(12, WORKING, [claim("c_1", "ctx_y", minutesAgo(30), "zeus")])]

		expect(codes({ issues, workers: [gone] })).toEqual([[12, "orphan-claim"]])
	})

	test("orphan-claim: an exited worker counts, a young claim does not", () => {
		const gone = worker({ verdict: "exited", terminalState: "released" })

		expect(
			codes({
				issues: [issue(12, WORKING, [claim("c_1", "ctx_y", minutesAgo(11))])],
				workers: [gone],
			}),
		).toEqual([[12, "orphan-claim"]])
		expect(
			codes({
				issues: [issue(12, WORKING, [claim("c_1", "ctx_y", minutesAgo(5))])],
				workers: [gone],
			}),
		).toEqual([])
	})

	test("unclaimed-worker: a ready request with a live worker started 10 minutes ago", () => {
		const workers = [worker()]
		const tasks = [task("task_y", "#12 Add greet", 11)]

		const [mismatch] = reconcile(input({ issues: [issue(12, READY)], workers, tasks }))

		expect(mismatch).toMatchObject({ code: "unclaimed-worker", worker: "ctx_y" })
	})

	test("unclaimed-worker: a worker started a minute ago is left alone", () => {
		const tasks = [task("task_y", "#12 Add greet", 1)]

		expect(codes({ issues: [issue(12, READY)], workers: [worker()], tasks })).toEqual([])
	})

	test("unrecorded-result: the claimed worker sits idle at its prompt", () => {
		const workers = [worker({ activity: "done", workerState: "succeeded" })]
		const issues = [issue(12, WORKING, [claim("c_1", "ctx_y")])]

		const [mismatch] = reconcile(input({ issues, workers }))

		expect(mismatch).toMatchObject({ code: "unrecorded-result", terminalGone: false })
	})

	test("unrecorded_result_tells_a_frontman_to_end_with_desk_ready", () => {
		const workers = [worker({ activity: "done", workerState: "succeeded" })]
		const frontman = composeComment(
			"claim",
			{
				id: "c_1",
				machine: "Minerva",
				task: "task_x",
				dispatch: "ctx_y",
				at: minutesAgo(30),
				role: "frontman",
			},
			"Claimed.",
		)
		const issues = [issue(12, ["request", "stage:working"], [frontman])]

		const [mismatch] = reconcile(input({ issues, workers }))

		expect(mismatch?.detail).toContain("desk ready, desk park or desk fail")
		expect(mismatch?.detail).not.toContain("desk done")
	})

	test("unrecorded-result: a builder is still told desk done, desk park or desk fail", () => {
		const workers = [worker({ activity: "done", workerState: "succeeded" })]
		const issues = [issue(12, WORKING, [claim("c_1", "ctx_y")])]

		const [mismatch] = reconcile(input({ issues, workers }))

		expect(mismatch?.detail).toContain("desk done, desk park or desk fail")
	})

	test("unrecorded-result: a finished worker whose terminal is gone is released as stopped", () => {
		const workers = [
			worker({ verdict: "exited", terminalState: "released", workerState: "succeeded" }),
		]
		const issues = [issue(12, WORKING, [claim("c_1", "ctx_y", minutesAgo(2))])]

		const [mismatch] = reconcile(input({ issues, workers }))

		expect(mismatch).toMatchObject({ code: "unrecorded-result", terminalGone: true })
	})

	test("a worker still working on its claim is no mismatch", () => {
		const issues = [issue(12, WORKING, [claim("c_1", "ctx_y")])]

		expect(codes({ issues, workers: [worker()] })).toEqual([])
	})

	test("parked-worker: a needs-you request whose claimed worker is still live", () => {
		const workers = [worker({ activity: "done", workerState: "succeeded" })]
		const issues = [issue(12, NEEDS_YOU, [claim("c_1", "ctx_y"), decision()])]

		const [mismatch] = reconcile(input({ issues, workers }))

		expect(mismatch).toMatchObject({ code: "parked-worker", worker: "ctx_y", claim: "c_1" })
	})

	test("a needs-you request with no worker needs nothing", () => {
		const issues = [issue(12, NEEDS_YOU, [claim("c_1", "ctx_y"), decision()])]

		expect(codes({ issues })).toEqual([])
	})

	test("looks-good: the newest human comment after the result starts with looks good", () => {
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1"), "Looks good, ship it"])]

		expect(codes({ issues })).toEqual([[12, "looks-good"]])
	})

	test("auto-land: a land:auto request at check with no human comment after the result", () => {
		const issues = [
			issue(12, [...CHECK, "land:auto"], [claim("c_1", "ctx_y"), result("c_1")]),
			issue(13, CHECK, [claim("c_2", "ctx_z"), result("c_2", "46")]),
		]

		expect(codes({ issues })).toEqual([[12, "auto-land"]])
	})

	test("auto-land: a request with no landing label follows the project default", () => {
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1")])]
		const auto = { ...SECTION, coordinator: { ...SECTION.coordinator, land: "land:auto" as const } }

		expect(codes({ issues, section: auto })).toEqual([[12, "auto-land"]])
		expect(codes({ issues })).toEqual([])
	})

	test("auto-land: a land:check label beats a land:auto project default", () => {
		const issues = [issue(12, [...CHECK, "land:check"], [claim("c_1", "ctx_y"), result("c_1")])]
		const auto = { ...SECTION, coordinator: { ...SECTION.coordinator, land: "land:auto" as const } }

		expect(codes({ issues, section: auto })).toEqual([])
	})

	test("auto-land: a blocked attempt after the result waits for the human, a new result tries again", () => {
		const blocked = composeComment("autoland", { pr: "45", blocked: "check" }, "Not landed.")
		const waiting = [
			issue(12, [...CHECK, "land:auto"], [claim("c_1", "ctx_y"), result("c_1"), blocked]),
		]
		const retried = [
			issue(
				12,
				[...CHECK, "land:auto"],
				[claim("c_1", "ctx_y"), result("c_1"), blocked, result("c_1", "46")],
			),
		]

		expect(codes({ issues: waiting })).toEqual([])
		expect(codes({ issues: retried })).toEqual([[12, "auto-land"]])
	})

	test("auto-land: only a clean review newer than a blocked=review attempt tries again", () => {
		const blocked = composeComment("autoland", { pr: "45", blocked: "review" }, "Not landed.")
		const clean = composeComment("review", { pr: "45", verdict: "clean" }, "Fine.")
		const blocking = composeComment("review", { pr: "45", verdict: "blocking" }, "No.")
		const checkBlocked = composeComment("autoland", { pr: "45", blocked: "check" }, "Not landed.")
		const bodies = (...rest: string[]) => [claim("c_1", "ctx_y"), result("c_1"), ...rest]

		expect(codes({ issues: [issue(12, [...CHECK, "land:auto"], bodies(blocked, clean))] })).toEqual(
			[[12, "auto-land"]],
		)
		expect(
			codes({ issues: [issue(12, [...CHECK, "land:auto"], bodies(blocked, blocking))] }),
		).toEqual([])
		expect(codes({ issues: [issue(12, [...CHECK, "land:auto"], bodies(blocked))] })).toEqual([])
		expect(
			codes({ issues: [issue(12, [...CHECK, "land:auto"], bodies(checkBlocked, clean))] }),
		).toEqual([])
	})

	test("auto-land: a result that names no pull request number is left alone", () => {
		const noNumber = composeComment("result", { claim: "c_1" }, "## Done, check it")
		const issues = [issue(12, [...CHECK, "land:auto"], [claim("c_1", "ctx_y"), noNumber])]

		expect(codes({ issues })).toEqual([])
	})

	test("auto-land: a human comment, a conflict or a busy worker comes first", () => {
		const labels = [...CHECK, "land:auto"]
		const conflicting = [{ number: 45, state: "OPEN", isDraft: false, mergeable: "CONFLICTING" }]

		expect(
			codes({
				issues: [issue(12, labels, [claim("c_1", "ctx_y"), result("c_1"), "no, because x"])],
			}),
		).toEqual([[12, "rejected"]])
		expect(
			codes({ issues: [issue(12, labels, [claim("c_1", "ctx_y"), result("c_1"), "why this?"])] }),
		).toEqual([[12, "conversation"]])
		expect(
			codes({
				issues: [issue(12, labels, [claim("c_1", "ctx_y"), result("c_1"), "looks good"])],
			}),
		).toEqual([[12, "looks-good"]])
		expect(
			codes({
				issues: [
					issue(12, labels, [claim("c_1", "ctx_y"), result("c_1")], { pullRequests: conflicting }),
				],
			}),
		).toEqual([[12, "check-red"]])
		expect(
			codes({
				issues: [issue(12, labels, [claim("c_1", "ctx_y"), result("c_1")])],
				workers: [worker()],
			}),
		).toEqual([])
	})

	test("looks-good: a looks good older than the result does not count", () => {
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), "looks good", result("c_1")])]

		expect(codes({ issues })).toEqual([])
	})

	test("rejected: the newest human comment's first word is no", () => {
		const issues = [
			issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1"), "no, because the count starts at 0"]),
		]

		expect(codes({ issues })).toEqual([[12, "rejected"]])
	})

	test("rejected: not sure is a conversation, never a rejection", () => {
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1"), "not sure about this"])]

		expect(codes({ issues })).toEqual([[12, "conversation"]])
	})

	test("conversation: forwards to the live worker, or asks for a reply-only worker", () => {
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1"), "why a loop here?"])]
		const settled = worker({ activity: "done", workerState: "succeeded" })

		expect(reconcile(input({ issues, workers: [settled] }))[0]).toMatchObject({
			code: "conversation",
			worker: "ctx_y",
		})
		expect(reconcile(input({ issues }))[0]).toMatchObject({
			code: "conversation",
			worker: undefined,
		})
	})

	test("conversation: a human comment on a parked request", () => {
		const issues = [
			issue(12, NEEDS_YOU, [claim("c_1", "ctx_y"), decision(), "what does the cache hold?"]),
		]

		expect(codes({ issues })).toEqual([[12, "conversation"]])
	})

	test("conversation: an answered comment is no longer pending", () => {
		const reply = release("c_1", "stopped")
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1"), "why a loop?", reply])]

		expect(codes({ issues })).toEqual([])
	})

	test("merged: a merged pull request on a request that is not done", () => {
		const pullRequests = [{ number: 45, state: "MERGED", isDraft: false, mergeable: "UNKNOWN" }]

		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1")], { pullRequests })]

		expect(codes({ issues })).toEqual([[12, "merged"]])
	})

	test("merged: an old merged pull request on a reopened request is not a merge", () => {
		const pullRequests = [{ number: 45, state: "MERGED", isDraft: false, mergeable: "UNKNOWN" }]
		const reopened = [
			claim("c_1", "ctx_y"),
			result("c_1"),
			`<!-- desk:reopen comment=9 -->\nno, because\n\n<!-- desk:agent -->\n`,
		]

		expect(codes({ issues: [issue(12, READY, reopened, { pullRequests })] })).toEqual([
			[12, "dispatch"],
		])
	})

	test("merged: a closed request whose pull request was merged by hand, with no result, still lands", () => {
		const pullRequests = [{ number: 45, state: "MERGED", isDraft: false, mergeable: "UNKNOWN" }]
		const closed = issue(12, ["request", "stage:working"], [], { pullRequests, open: false })

		expect(codes({ issues: [closed] })).toEqual([[12, "merged"]])
	})

	test("merged: only the pull request the newest result names counts", () => {
		const pullRequests = [{ number: 44, state: "MERGED", isDraft: false, mergeable: "UNKNOWN" }]
		const issues = [
			issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1", "45")], { pullRequests }),
		]

		expect(codes({ issues })).toEqual([])
	})

	test("merged: a request already at done is left alone", () => {
		const pullRequests = [{ number: 45, state: "MERGED", isDraft: false, mergeable: "UNKNOWN" }]
		const done = issue(12, ["request", "stage:done"], [], { pullRequests, open: false })

		expect(codes({ issues: [done] })).toEqual([])
	})

	test("check-red: a conflicting pull request, with the live worker or without one", () => {
		const pullRequests = [{ number: 45, state: "OPEN", isDraft: false, mergeable: "CONFLICTING" }]
		const issues = [issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1")], { pullRequests })]
		const settled = worker({ activity: "done", workerState: "succeeded" })

		expect(reconcile(input({ issues, workers: [settled] }))[0]).toMatchObject({
			code: "check-red",
			worker: "ctx_y",
		})
		expect(reconcile(input({ issues }))[0]).toMatchObject({ code: "check-red", worker: undefined })
	})

	test("check-red outranks looks-good: the conflict is fixed first", () => {
		const pullRequests = [{ number: 45, state: "OPEN", isDraft: false, mergeable: "CONFLICTING" }]
		const issues = [
			issue(12, CHECK, [claim("c_1", "ctx_y"), result("c_1"), "looks good"], { pullRequests }),
		]

		expect(codes({ issues })).toEqual([[12, "check-red"]])
	})

	test("stray-worker: a live worker on a closed request or one at done", () => {
		const tasks = [task("task_y", "#12 Add greet")]
		const closed = issue(12, ["request", "stage:done"], [], { open: false })
		const doneOpen = issue(13, ["request", "stage:done"])

		expect(codes({ issues: [closed], workers: [worker()], tasks })).toEqual([[12, "stray-worker"]])
		expect(
			codes({ issues: [doneOpen], workers: [worker()], tasks: [task("task_y", "#13 Other")] }),
		).toEqual([[13, "stray-worker"]])
	})

	test("bad-labels: no stage label, or two of them; the program changes nothing", () => {
		const issues = [issue(1, ["request"]), issue(2, ["request", "stage:ready", "stage:check"])]

		expect(codes({ issues })).toEqual([
			[1, "bad-labels"],
			[2, "bad-labels"],
		])
	})

	test("human-claimed: a working request with no claim comment is reported and nothing else", () => {
		const labels = [...WORKING]
		const tasks = [task("task_y", "#12 Add greet", 30)]

		expect(codes({ issues: [issue(12, labels)] })).toEqual([[12, "human-claimed"]])
		expect(
			codes({ issues: [issue(12, labels, ["I am on this one"])], workers: [worker()], tasks }),
		).toEqual([[12, "human-claimed"]])
	})

	test("backlog and done are ignored", () => {
		const issues = [
			issue(2, ["request", "stage:backlog"]),
			issue(3, ["request", "stage:done"], [], { open: false }),
		]

		expect(codes({ issues })).toEqual([])
	})

	test("the machine behind a worker comes from the host list", () => {
		const section = { ...SECTION, machines: [{ name: "zeus", workers: 1, repo: "~/k" }] }
		const remote = worker({ hostKind: "environment", hostId: "env-zeus" })

		expect(HOSTS.some((host) => host.id === "env-zeus")).toBe(true)
		expect(codes({ issues: [issue(5, READY)], workers: [remote], section })).toEqual([])
	})
})

describe("desk reconcile: intake", () => {
	const INTAKE = ["request", "stage:intake", "priority:P2"]

	test("intake: a filed request with no worker and no open card gets a frontman", () => {
		const [mismatch] = reconcile(input({ issues: [issue(12, INTAKE)] }))

		expect(mismatch).toMatchObject({ issue: 12, code: "intake", machine: "Minerva" })
		expect(mismatch?.workerStart).toEqual([
			"--worktree",
			"new-child",
			"--name",
			"12",
			"--base-branch",
			"main",
		])
	})

	test("intake: needs no autopilot label", () => {
		expect(codes({ issues: [issue(12, INTAKE)] })).toEqual([[12, "intake"]])
	})

	test("intake: a proposal Milky has not accepted is left alone", () => {
		expect(codes({ issues: [issue(12, [...INTAKE, "proposed"])] })).toEqual([])
	})

	test("intake: an issue with no request label is left alone", () => {
		expect(codes({ issues: [issue(12, ["stage:intake"])] })).toEqual([])
	})

	test("intake: a closed issue is left alone", () => {
		expect(codes({ issues: [issue(12, INTAKE, [], { open: false })] })).toEqual([])
	})

	test("intake: a live frontman worker means no second dispatch", () => {
		const tasks = [task("task_y", "#12 Counter accents", 3)]

		expect(codes({ issues: [issue(12, INTAKE)], workers: [worker()], tasks })).toEqual([])
	})

	test("intake: a card still open holds the frontman back", () => {
		const open = composeComment("decision", { claim: "c_1", card: "c_1-1" }, "## Decision needed")

		expect(codes({ issues: [issue(12, INTAKE, [claim("c_1", "ctx_y"), open])] })).toEqual([])
	})

	test("intake: dispatches again once the last card is answered", () => {
		const card = composeComment("decision", { claim: "c_1", card: "c_1-1" }, "## Decision needed")
		const answer = "<!-- desk:answer card=c_1-1 -->\nLHL."
		const released = release("c_1", "answered")

		expect(
			codes({ issues: [issue(12, INTAKE, [claim("c_1", "ctx_y"), card, answer, released])] }),
		).toEqual([[12, "intake"]])
	})

	test("intake: shares the machine slots with ready requests, lowest priority number first", () => {
		const section = { ...SECTION, machines: [{ name: "Minerva", workers: 1, repo: undefined }] }
		const urgent = ["request", "stage:intake", "priority:P1"]

		const found = reconcile(input({ issues: [issue(1, READY), issue(2, urgent)], section }))

		expect(found.map((mismatch) => [mismatch.issue, mismatch.code])).toEqual([[2, "intake"]])
	})

	test("intake_after_two_failed_attempts_is_stuck_not_dispatched", () => {
		const bodies = [
			claim("c_1", "ctx_a"),
			composeFailure("c_1"),
			claim("c_2", "ctx_b"),
			composeFailure("c_2"),
		]

		expect(codes({ issues: [issue(12, INTAKE, bodies)] })).toEqual([[12, "intake-stuck"]])
	})

	test("intake: one failed attempt still dispatches", () => {
		const bodies = [claim("c_1", "ctx_a"), composeFailure("c_1")]

		expect(codes({ issues: [issue(12, INTAKE, bodies)] })).toEqual([[12, "intake"]])
	})

	test("answered_not_requeued: every card answered but the request still waits on needs-you", () => {
		const card = composeComment("decision", { claim: "c_1", card: "c_1-1" }, "## Decision needed")
		const answer = "<!-- desk:answer card=c_1-1 -->\nLHL."

		expect(
			codes({ issues: [issue(12, NEEDS_YOU, [claim("c_1", "ctx_y"), card, answer])] }),
		).toEqual([[12, "answered-not-requeued"]])
	})

	test("a card answer is not a conversation, a chat comment still is", () => {
		const card = composeComment("decision", { claim: "c_1", card: "c_1-1" }, "## Decision needed")
		const second = composeComment("decision", { claim: "c_1", card: "c_1-2" }, "## Decision needed")
		const answer = "<!-- desk:answer card=c_1-1 -->\nLHL."
		const bodies = [claim("c_1", "ctx_y"), card, second, answer]

		expect(codes({ issues: [issue(12, NEEDS_YOU, bodies)] })).toEqual([])
		expect(codes({ issues: [issue(12, NEEDS_YOU, [...bodies, "Why LHL?"])] })).toEqual([
			[12, "conversation"],
		])
	})
})

function composeFailure(claimId: string): string {
	return `<!-- desk:failed claim=${claimId} attempt=1 -->\nNothing worked.\n\n<!-- desk:agent -->\n`
}
