import { owningClaim } from "../github/derive.ts"
import { type IssueState, isUnclaimedIntake, stageOf } from "../github/issue.ts"
import type { Reachability } from "../orca/hosts.ts"
import type { Message } from "../orca/inbox.ts"
import { isLive, type Worker } from "../orca/workers.ts"
import { landedPullRequest } from "../reconcile/landed.ts"
import { type Ledger, stringList } from "./ledger.ts"

const MINUTE = 60_000
export const POLL_MS = 30_000
export const GITHUB_POLL_MS = MINUTE
export const IDLE_LIMIT_MS = 10 * MINUTE
export const HUNG_LIMIT_MS = 20 * MINUTE
export const MACHINE_SILENT_MS = 15 * MINUTE

const SEEN_FILE = "watch-seen.json"
const MACHINES_FILE = "watch-machines.json"

export type WatchEvent =
	| { event: "worker-stopped"; issue: number; dispatch: string }
	| { event: "worker-idle"; issue: number; dispatch: string }
	| { event: "worker-hung"; issue: number; dispatch: string }
	| { event: "worker-gone"; issue: number; dispatch: string }
	| { event: "machine-silent"; machine: string; released: number[]; failed: number[] }
	| { event: "human-comment"; issue: number }
	| { event: "ready"; issue: number }
	| { event: "merged"; issue: number }
	| { event: "mail"; ids: string[] }
	| { event: "tick" }

export type WatchDeps = {
	now: () => Date
	workers: () => Promise<Worker[]>
	mail: () => Promise<Message[] | undefined>
	issues: () => Promise<IssueState[]>
	reachability: (machine: string) => Promise<Reachability>
	release: (issue: number, claimId: string) => Promise<void>
	startupWork: () => Promise<number[]>
	localMachine: string
	ledger: Ledger
}

type GithubBaseline = {
	ready: Set<number>
	merged: Set<number>
	humanComments: Set<number>
}

export type WatchState = {
	startedAt: number
	seenWorking: Set<string>
	idleSince: Map<string, number>
	lastGithubPoll: number | undefined
	snapshot: IssueState[]
	baseline: GithubBaseline | undefined
}

export function newWatchState(now: Date): WatchState {
	return {
		startedAt: now.getTime(),
		seenWorking: new Set(),
		idleSince: new Map(),
		lastGithubPoll: undefined,
		snapshot: [],
		baseline: undefined,
	}
}

function awaitsWorker(issue: IssueState): boolean {
	const stage = stageOf(issue)
	if (!issue.open || stage.kind !== "one") return false

	if (stage.label === "stage:ready") return true

	return stage.label === "stage:intake" && isUnclaimedIntake(issue)
}

function baselineOf(issues: readonly IssueState[]): GithubBaseline {
	const waiting = issues.filter((issue) => {
		const stage = stageOf(issue)

		return (
			issue.open &&
			stage.kind === "one" &&
			(stage.label === "stage:needs-you" || stage.label === "stage:check")
		)
	})

	return {
		ready: new Set(issues.filter(awaitsWorker).map((issue) => issue.number)),
		merged: new Set(
			issues.filter((issue) => landedPullRequest(issue) !== undefined).map((issue) => issue.number),
		),
		humanComments: new Set(
			waiting.flatMap((issue) =>
				issue.comments.filter((comment) => !comment.agent).map((comment) => comment.databaseId),
			),
		),
	}
}

function githubEvents(issues: readonly IssueState[], before: GithubBaseline): WatchEvent[] {
	const now = baselineOf(issues)
	const events: WatchEvent[] = []

	for (const number of now.ready) {
		if (!before.ready.has(number)) events.push({ event: "ready", issue: number })
	}

	for (const number of now.merged) {
		if (!before.merged.has(number)) events.push({ event: "merged", issue: number })
	}

	const commented = new Set<number>()
	for (const issue of issues) {
		const stage = stageOf(issue)
		const waiting =
			stage.kind === "one" && (stage.label === "stage:needs-you" || stage.label === "stage:check")
		if (!issue.open || !waiting) continue

		const fresh = issue.comments.some(
			(comment) => !comment.agent && !before.humanComments.has(comment.databaseId),
		)
		if (fresh && !commented.has(issue.number)) {
			commented.add(issue.number)
			events.push({ event: "human-comment", issue: issue.number })
		}
	}

	return events
}

async function mailEvents(
	deps: WatchDeps,
): Promise<{ events: WatchEvent[]; beats: Map<string, number> }> {
	const messages = await deps.mail()
	const beats = new Map<string, number>()
	if (messages === undefined) return { events: [], beats }

	for (const message of messages) {
		if (message.type !== "heartbeat" || message.dispatchId === undefined) continue

		const at = message.createdAt.getTime()
		beats.set(message.dispatchId, Math.max(beats.get(message.dispatchId) ?? 0, at))
	}

	const real = messages.filter(
		(message) => message.type !== "heartbeat" && !message.from.startsWith("run:"),
	)
	const stored = await deps.ledger.read(SEEN_FILE)

	if (stored === undefined) {
		await deps.ledger.write(SEEN_FILE, real.map((message) => message.id).toSorted())

		return { events: [], beats }
	}

	const seen = new Set(stringList(stored))
	const fresh = real.filter((message) => !seen.has(message.id))
	if (fresh.length === 0) return { events: [], beats }

	await deps.ledger.write(SEEN_FILE, [...seen, ...fresh.map((message) => message.id)].toSorted())

	return { events: [{ event: "mail", ids: fresh.map((message) => message.id) }], beats }
}

function workerEvents(
	state: WatchState,
	workers: readonly Worker[],
	beats: Map<string, number>,
	now: number,
): WatchEvent[] {
	const events: WatchEvent[] = []
	const byDispatch = new Map(workers.map((worker) => [worker.dispatchId, worker]))

	for (const issue of state.snapshot) {
		const stage = stageOf(issue)
		if (!issue.open || stage.kind !== "one" || stage.label !== "stage:working") continue

		const claim = owningClaim(issue.comments)
		const worker = claim === undefined ? undefined : byDispatch.get(claim.dispatch)
		if (!claim || !worker) continue

		const base = { issue: issue.number, dispatch: claim.dispatch }

		if (worker.verdict === "exited") {
			events.push({ event: "worker-gone", ...base })
			continue
		}

		if (!isLive(worker)) continue

		if (worker.activity === "working") {
			state.seenWorking.add(claim.dispatch)
			state.idleSince.delete(claim.dispatch)

			const lastBeat = Math.max(beats.get(claim.dispatch) ?? 0, Date.parse(claim.at))
			if (now - lastBeat >= HUNG_LIMIT_MS) events.push({ event: "worker-hung", ...base })
		} else if (worker.activity === "done") {
			const since = state.idleSince.get(claim.dispatch) ?? now
			state.idleSince.set(claim.dispatch, since)

			if (state.seenWorking.has(claim.dispatch)) events.push({ event: "worker-stopped", ...base })
			else if (now - since >= IDLE_LIMIT_MS) events.push({ event: "worker-idle", ...base })
		}
	}

	return events
}

function parseSince(value: unknown): Map<string, number> {
	const since = new Map<string, number>()
	if (typeof value !== "object" || value === null) return since

	for (const [machine, at] of Object.entries(value)) {
		if (typeof at === "string" && !Number.isNaN(Date.parse(at))) since.set(machine, Date.parse(at))
	}

	return since
}

async function machineEvents(
	state: WatchState,
	deps: WatchDeps,
	now: number,
): Promise<WatchEvent[]> {
	const claimsByMachine = new Map<string, { issue: number; claimId: string }[]>()

	for (const issue of state.snapshot) {
		const stage = stageOf(issue)
		const claim = owningClaim(issue.comments)
		if (!issue.open || stage.kind !== "one" || stage.label !== "stage:working" || !claim) continue
		if (claim.machine === deps.localMachine) continue

		const list = claimsByMachine.get(claim.machine) ?? []
		list.push({ issue: issue.number, claimId: claim.id })
		claimsByMachine.set(claim.machine, list)
	}

	const since = parseSince(await deps.ledger.read(MACHINES_FILE))
	const events: WatchEvent[] = []

	for (const [machine, claims] of claimsByMachine) {
		const reachability = await deps.reachability(machine)
		if (reachability === "unknown") {
			since.delete(machine)
			continue
		}

		if (reachability === "reachable") {
			since.delete(machine)
			continue
		}

		const first = since.get(machine) ?? now
		since.set(machine, first)
		if (now - first < MACHINE_SILENT_MS) continue

		const released: number[] = []
		const failed: number[] = []
		for (const claim of claims) {
			try {
				await deps.release(claim.issue, claim.claimId)
				released.push(claim.issue)
			} catch {
				failed.push(claim.issue)
			}
		}

		events.push({ event: "machine-silent", machine, released, failed })
		since.delete(machine)
	}

	for (const machine of [...since.keys()]) {
		if (!claimsByMachine.has(machine)) since.delete(machine)
	}

	const next = Object.fromEntries(
		[...since].map(([machine, at]) => [machine, new Date(at).toISOString()]),
	)
	const stored = Object.fromEntries(
		[...parseSince(await deps.ledger.read(MACHINES_FILE))].map(([machine, at]) => [
			machine,
			new Date(at).toISOString(),
		]),
	)
	if (JSON.stringify(next) !== JSON.stringify(stored)) await deps.ledger.write(MACHINES_FILE, next)

	return events
}

export async function step(
	state: WatchState,
	deps: WatchDeps,
	maxWaitMs: number,
): Promise<WatchEvent[]> {
	const now = deps.now().getTime()
	const events: WatchEvent[] = []

	if (state.lastGithubPoll === undefined || now - state.lastGithubPoll >= GITHUB_POLL_MS) {
		try {
			const issues = await deps.issues()
			if (state.baseline) events.push(...githubEvents(issues, state.baseline))
			else {
				for (const issue of await deps.startupWork()) events.push({ event: "ready", issue })
			}

			state.snapshot = issues
			state.baseline = baselineOf(issues)
			state.lastGithubPoll = now
		} catch {
			// A failed read is skipped, never taken as an empty issue list, so the next poll retries.
		}
	}

	const mail = await mailEvents(deps)
	events.push(...mail.events)

	events.push(...workerEvents(state, await deps.workers(), mail.beats, now))
	events.push(...(await machineEvents(state, deps, now)))

	if (events.length === 0 && now - state.startedAt >= maxWaitMs) events.push({ event: "tick" })

	return events
}
