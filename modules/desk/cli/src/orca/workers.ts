import { isRecord, readArray, readField, readString } from "../json.ts"
import type { Orca } from "./runner.ts"

export type Worker = {
	dispatchId: string
	taskId: string
	terminalHandle: string | undefined
	workerState: string
	terminalState: string
	activity: string
	verdict: string
	hostKind: string
	hostId: string
	worktreePath: string | undefined
}

const PAGE_LIMIT = "100"

function optionalString(value: unknown, key: string): string | undefined {
	const field = readField(value, key)

	return typeof field === "string" ? field : undefined
}

function worktreePathOf(worktreeId: string | undefined): string | undefined {
	const separator = worktreeId?.indexOf("::") ?? -1
	if (worktreeId === undefined || separator === -1) return undefined

	return worktreeId.slice(separator + 2)
}

export function parseWorker(row: unknown): Worker {
	const projection = readField(row, "projection")
	const resource = readField(row, "resource")
	const host = readField(projection, "host")

	return {
		dispatchId: readString(row, "dispatchId"),
		taskId: readString(row, "taskId"),
		terminalHandle: optionalString(row, "agentTerminalHandle"),
		workerState: readString(row, "workerState"),
		terminalState: readString(row, "terminalState"),
		activity: readString(readField(projection, "stage"), "activity"),
		verdict: readString(readField(projection, "liveness"), "verdict"),
		hostKind: readString(host, "kind"),
		hostId: readString(host, "id"),
		worktreePath: isRecord(resource)
			? worktreePathOf(optionalString(resource, "worktreeId"))
			: undefined,
	}
}

export function isGone(worker: Worker): boolean {
	return worker.verdict === "exited" || worker.terminalState === "released"
}

export function isLive(worker: Worker): boolean {
	return worker.verdict === "live" && worker.terminalState !== "released"
}

export function isSettled(worker: Worker): boolean {
	return worker.workerState === "succeeded" || worker.workerState === "failed"
}

export function isBusy(worker: Worker): boolean {
	return isLive(worker) && !isSettled(worker) && worker.activity === "working"
}

function nextCursor(result: unknown): string | undefined {
	const page = readField(result, "page")
	if (!isRecord(page)) return undefined

	return typeof page.nextCursor === "string" ? page.nextCursor : undefined
}

export async function listWorkers(
	orca: Orca,
	options: { run?: string; includeRemote: boolean },
): Promise<Worker[]> {
	const workers: Worker[] = []
	let cursor: string | undefined

	do {
		const args = ["orchestration", "worker-list", "--limit", PAGE_LIMIT]
		if (options.includeRemote) args.push("--include-remote")
		if (options.run !== undefined) args.push("--run", options.run)
		if (cursor !== undefined) args.push("--cursor", cursor)

		const result = await orca(args)
		workers.push(...readArray(result, "workers").map(parseWorker))
		cursor = nextCursor(result)
	} while (cursor !== undefined)

	return workers
}
