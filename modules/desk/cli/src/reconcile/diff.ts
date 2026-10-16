import { attemptCount, owningClaim } from "../github/derive.ts"
import { type IssueState, stageOf } from "../github/issue.ts"
import { machineOfHost } from "../orca/hosts.ts"
import { issueNumberOfTitle } from "../orca/tasks.ts"
import { isBusy, isGone, isLive, isSettled, type Worker } from "../orca/workers.ts"
import { workerMachines } from "../project/section.ts"
import { landedPullRequest } from "./landed.ts"
import type { Mismatch, ReconcileInput } from "./types.ts"

const MINUTE = 60_000
export const CLAIM_GRACE_MS = 10 * MINUTE

const LOOKS_GOOD = /^looks good/i
const FIRST_WORD_NO = /^no(?![\p{L}\p{N}'])/iu
const PRIORITY = /^priority:P(\d)$/

type Assignment = { byIssue: Map<number, Worker[]>; byDispatch: Map<string, Worker> }

function assignWorkers(input: ReconcileInput): Assignment {
	const titles = new Map(input.tasks.map((task) => [task.id, task]))
	const byDispatch = new Map(input.workers.map((worker) => [worker.dispatchId, worker]))
	const byIssue = new Map<number, Worker[]>()
	const add = (number: number, worker: Worker) => {
		const list = byIssue.get(number) ?? []
		if (!list.includes(worker)) list.push(worker)
		byIssue.set(number, list)
	}

	for (const worker of input.workers) {
		const title = titles.get(worker.taskId)?.title
		const number = title === undefined ? undefined : issueNumberOfTitle(title)
		if (number !== undefined) add(number, worker)
	}

	for (const issue of input.issues) {
		const claim = owningClaim(issue.comments)
		const worker = claim === undefined ? undefined : byDispatch.get(claim.dispatch)
		if (worker) add(issue.number, worker)
	}

	return { byIssue, byDispatch }
}

function startedAt(input: ReconcileInput, worker: Worker): Date | undefined {
	return input.tasks.find((task) => task.id === worker.taskId)?.createdAt
}

function priorityOf(issue: IssueState): number {
	for (const label of issue.labels) {
		const match = PRIORITY.exec(label)
		if (match?.[1] !== undefined) return Number(match[1])
	}

	return 2
}

function lastIndexOfKind(issue: IssueState, kind: string): number {
	return issue.comments.findLastIndex((comment) => comment.marker?.kind === kind)
}

function humanComment(issue: IssueState, after: number) {
	const index = issue.comments.findLastIndex((comment) => !comment.agent)

	return index > after ? { index, body: issue.comments[index]?.body ?? "" } : undefined
}

function classifyCheck(issue: IssueState, workers: Worker[]): Mismatch | undefined {
	const number = issue.number
	const resultAt = lastIndexOfKind(issue, "result")
	const human = humanComment(issue, resultAt)
	const live = workers.find(isLive)

	if (human && FIRST_WORD_NO.test(human.body.trim())) {
		return { issue: number, code: "rejected", detail: "the human answered no, because: reopen it" }
	}

	if (workers.some(isBusy)) return undefined

	const conflicting = issue.pullRequests.some(
		(pr) => pr.state === "OPEN" && pr.mergeable === "CONFLICTING",
	)
	if (conflicting) {
		return {
			issue: number,
			code: "check-red",
			detail: live
				? "the pull request conflicts with main: send it back to its worker"
				: "the pull request conflicts with main and no worker is live: dispatch a merge worker",
			worker: live?.dispatchId,
		}
	}

	if (human && LOOKS_GOOD.test(human.body.trim())) {
		return {
			issue: number,
			code: "looks-good",
			detail: "the human said looks good: run desk merge",
		}
	}

	return classifyConversation(issue, resultAt, live)
}

function classifyConversation(
	issue: IssueState,
	after: number,
	live: Worker | undefined,
): Mismatch | undefined {
	const newest = issue.comments.at(-1)
	const human = humanComment(issue, after)
	if (!newest || newest.agent || !human) return undefined

	return {
		issue: issue.number,
		code: "conversation",
		detail: live
			? "a human comment waits for an answer: forward it to the live worker"
			: "a human comment waits for an answer and no worker is live: dispatch a reply-only worker",
		worker: live?.dispatchId,
	}
}

function classifyNeedsYou(
	issue: IssueState,
	workers: Worker[],
	byDispatch: Map<string, Worker>,
): Mismatch | undefined {
	if (workers.some(isBusy)) return undefined

	const claim = owningClaim(issue.comments)
	const parked = claim === undefined ? undefined : byDispatch.get(claim.dispatch)
	const live = parked && isLive(parked) ? parked : workers.find(isLive)

	const conversation = classifyConversation(issue, lastIndexOfKind(issue, "decision"), live)
	if (conversation) return conversation

	if (parked && isLive(parked)) {
		return {
			issue: issue.number,
			code: "parked-worker",
			detail:
				"the request is parked and its worker is still live: release the worker, keep the worktree",
			worker: parked.dispatchId,
			claim: claim?.id,
		}
	}

	return undefined
}

function classifyWorking(
	input: ReconcileInput,
	issue: IssueState,
	byDispatch: Map<string, Worker>,
): Mismatch | undefined {
	const claim = owningClaim(issue.comments)
	if (!claim) {
		return {
			issue: issue.number,
			code: "human-claimed",
			detail:
				"the request is working with no desk claim, so a person or another session took it: report it, never release, requeue or dispatch it",
		}
	}

	const worker = byDispatch.get(claim.dispatch)
	const claimAge = input.now.getTime() - Date.parse(claim.at)

	if (worker && isLive(worker)) {
		if (!isSettled(worker) && worker.activity !== "done") return undefined

		return {
			issue: issue.number,
			code: "unrecorded-result",
			detail: `worker ${claim.dispatch} stopped without recording its result: tell it to run desk done, desk park or desk fail`,
			claim: claim.id,
			worker: claim.dispatch,
			terminalGone: false,
		}
	}

	if (worker && isSettled(worker) && isGone(worker)) {
		return {
			issue: issue.number,
			code: "unrecorded-result",
			detail: `worker ${claim.dispatch} finished and its terminal is gone, with no result recorded: release the claim as stopped`,
			claim: claim.id,
			worker: claim.dispatch,
			terminalGone: true,
		}
	}

	const remote = claim.machine !== input.section.coordinator.machine
	if (!worker && remote) return undefined

	if ((!worker || isGone(worker)) && claimAge > CLAIM_GRACE_MS) {
		return {
			issue: issue.number,
			code: "orphan-claim",
			detail: `claim ${claim.id} names dispatch ${claim.dispatch}, which is ${worker ? "gone" : "absent"}: release it as no-worker`,
			claim: claim.id,
			worker: claim.dispatch,
		}
	}

	return undefined
}

function classifyReady(
	input: ReconcileInput,
	issue: IssueState,
	workers: Worker[],
): Mismatch | undefined {
	const eligible =
		issue.labels.includes("autopilot") &&
		issue.openBlockers.length === 0 &&
		issue.openSubIssues.length === 0
	if (!eligible) return undefined

	const present = workers.filter((worker) => !isGone(worker))
	if (present.length > 0) {
		const cutoff = input.now.getTime() - CLAIM_GRACE_MS
		const never = present.find((worker) => {
			const started = startedAt(input, worker)

			return isLive(worker) && started !== undefined && started.getTime() < cutoff
		})
		if (!never) return undefined

		return {
			issue: issue.number,
			code: "unclaimed-worker",
			detail: `worker ${never.dispatchId} never claimed the request: read its terminal, then worker-stop it`,
			worker: never.dispatchId,
		}
	}

	const attempts = attemptCount(issue.comments)

	return {
		issue: issue.number,
		code: attempts >= 2 ? "escalate" : "dispatch",
		detail:
			attempts >= 2
				? `ready again after ${attempts} attempts: dispatch one tier up, or park it with a card when the last tier was Sonnet`
				: `ready, ${attempts} attempts: route it and start a worker`,
		attempts,
	}
}

function classifyIssue(
	input: ReconcileInput,
	issue: IssueState,
	assignment: Assignment,
): Mismatch | undefined {
	const stage = stageOf(issue)
	const workers = assignment.byIssue.get(issue.number) ?? []

	if (issue.open && stage.kind === "ambiguous") {
		return {
			issue: issue.number,
			code: "bad-labels",
			detail:
				stage.labels.length === 0
					? "the issue has no stage label: change nothing, report it"
					: `the issue has several stage labels (${stage.labels.join(", ")}): change nothing, report it`,
		}
	}

	const label = stage.kind === "one" ? stage.label : undefined
	const merged = landedPullRequest(issue)

	if (merged && label !== "stage:done") {
		return {
			issue: issue.number,
			code: "merged",
			detail: `pull request #${merged.number} is merged and the request is not done: run desk land`,
		}
	}

	if (!issue.open || label === "stage:done") {
		const live = workers.find(isLive)
		if (!live) return undefined

		return {
			issue: issue.number,
			code: "stray-worker",
			detail: `worker ${live.dispatchId} is live on a finished request: stop it, then release it`,
			worker: live.dispatchId,
		}
	}

	if (label === "stage:ready") return classifyReady(input, issue, workers)
	if (label === "stage:working") return classifyWorking(input, issue, assignment.byDispatch)
	if (label === "stage:needs-you") return classifyNeedsYou(issue, workers, assignment.byDispatch)
	if (label === "stage:check") return classifyCheck(issue, workers)

	return undefined
}

function freeSlots(input: ReconcileInput): Map<string, number> {
	const free = new Map(
		workerMachines(input.section).map((machine) => [machine.name, machine.workers]),
	)

	for (const worker of input.workers) {
		if (!isLive(worker) || isSettled(worker)) continue

		const machine = machineOfHost(input.hosts, worker.hostKind, worker.hostId)
		const left = free.get(machine)
		if (left !== undefined) free.set(machine, left - 1)
	}

	return free
}

function assignMachines(input: ReconcileInput, mismatches: Mismatch[]): Mismatch[] {
	const free = freeSlots(input)
	const priorities = new Map(input.issues.map((issue) => [issue.number, priorityOf(issue)]))
	const startable = mismatches
		.filter((mismatch) => mismatch.code === "dispatch" || mismatch.code === "escalate")
		.sort(
			(left, right) =>
				(priorities.get(left.issue) ?? 2) - (priorities.get(right.issue) ?? 2) ||
				left.issue - right.issue,
		)
	const dropped = new Set<Mismatch>()

	for (const mismatch of startable) {
		const machine = [...free.entries()].find(([, left]) => left > 0)?.[0]
		if (machine === undefined) {
			if (mismatch.code === "dispatch") dropped.add(mismatch)
			continue
		}

		mismatch.machine = machine
		free.set(machine, (free.get(machine) ?? 0) - 1)
	}

	return mismatches.filter((mismatch) => !dropped.has(mismatch))
}

export function reconcile(input: ReconcileInput): Mismatch[] {
	const assignment = assignWorkers(input)
	const found: Mismatch[] = []

	for (const issue of input.issues) {
		const mismatch = classifyIssue(input, issue, assignment)
		if (mismatch) found.push(mismatch)
	}

	return assignMachines(input, found).sort((left, right) => left.issue - right.issue)
}

export function workersByIssue(input: ReconcileInput): Map<number, Worker[]> {
	return assignWorkers(input).byIssue
}
