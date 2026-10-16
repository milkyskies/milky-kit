import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { isRecord, parseJson } from "../json.ts"

export type CoordinatorLock = { pid: number; orcaSessionId: string | undefined; startedAt: string }

export type LockVerdict =
	| { kind: "taken" }
	| { kind: "ours" }
	| { kind: "held"; lock: CoordinatorLock }

export type LockDependencies = {
	path: string
	ownPid: number
	orcaSessionId: string | undefined
	isAlive: (pid: number) => boolean
	now: () => Date
}

export function processIsAlive(pid: number): boolean {
	try {
		process.kill(pid, 0)

		return true
	} catch (error) {
		return isRecord(error) && error.code === "EPERM"
	}
}

async function readLock(path: string): Promise<CoordinatorLock | undefined> {
	let text: string
	try {
		text = await readFile(path, "utf8")
	} catch {
		return undefined
	}

	try {
		const value = parseJson(text)
		if (!isRecord(value) || typeof value.pid !== "number" || typeof value.startedAt !== "string") {
			return undefined
		}

		const orcaSessionId = typeof value.orcaSessionId === "string" ? value.orcaSessionId : undefined

		return { pid: value.pid, orcaSessionId, startedAt: value.startedAt }
	} catch {
		return undefined
	}
}

async function createLock(dependencies: LockDependencies): Promise<boolean> {
	const lock: CoordinatorLock = {
		pid: dependencies.ownPid,
		orcaSessionId: dependencies.orcaSessionId,
		startedAt: dependencies.now().toISOString(),
	}

	await mkdir(dirname(dependencies.path), { recursive: true })

	try {
		// The exclusive flag lets two coordinators racing for a stale lock end with exactly one winner.
		await writeFile(dependencies.path, `${JSON.stringify(lock)}\n`, { flag: "wx" })

		return true
	} catch (error) {
		if (isRecord(error) && error.code === "EEXIST") return false

		throw error
	}
}

export async function acquireCoordinatorLock(dependencies: LockDependencies): Promise<LockVerdict> {
	const existing = await readLock(dependencies.path)

	if (existing?.pid === dependencies.ownPid) return { kind: "ours" }
	if (existing && dependencies.isAlive(existing.pid)) return { kind: "held", lock: existing }

	await rm(dependencies.path, { force: true })

	if (await createLock(dependencies)) return { kind: "taken" }

	const winner = await readLock(dependencies.path)
	if (winner?.pid === dependencies.ownPid) return { kind: "ours" }
	if (winner) return { kind: "held", lock: winner }

	throw new Error(`the coordinator lock at ${dependencies.path} could not be created`)
}
