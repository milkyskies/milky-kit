import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { acquireCoordinatorLock } from "./lock.ts"

const directories: string[] = []

afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	)
})

async function lockPath(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "desk-lock-"))
	directories.push(directory)

	return join(directory, "state", "coordinator.lock")
}

function dependencies(path: string, ownPid: number, alive: number[] = []) {
	return {
		path,
		ownPid,
		orcaSessionId: `session-${ownPid}`,
		isAlive: (pid: number) => alive.includes(pid),
		now: () => new Date("2026-10-16T14:00:00Z"),
	}
}

describe("coordinator lock", () => {
	test("creates the lock, with its directory, when none exists", async () => {
		const path = await lockPath()

		expect((await acquireCoordinatorLock(dependencies(path, 10))).kind).toBe("taken")
		expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
			pid: 10,
			orcaSessionId: "session-10",
			startedAt: "2026-10-16T14:00:00.000Z",
		})
	})

	test("a dead holder is free to take over, and a corrupt file counts as dead", async () => {
		const path = await lockPath()
		await acquireCoordinatorLock(dependencies(path, 10))

		expect((await acquireCoordinatorLock(dependencies(path, 20))).kind).toBe("taken")

		await writeFile(path, "{ not json")

		expect((await acquireCoordinatorLock(dependencies(path, 30))).kind).toBe("taken")
	})

	test("a live holder keeps the lock and is returned to the caller", async () => {
		const path = await lockPath()
		await acquireCoordinatorLock(dependencies(path, 10))

		const verdict = await acquireCoordinatorLock(dependencies(path, 20, [10]))

		expect(verdict).toMatchObject({ kind: "held", lock: { pid: 10, orcaSessionId: "session-10" } })
	})

	test("two coordinators racing for a stale lock end with exactly one winner", async () => {
		const path = await lockPath()
		await acquireCoordinatorLock(dependencies(path, 10))

		const verdicts = await Promise.all([
			acquireCoordinatorLock(dependencies(path, 20)),
			acquireCoordinatorLock(dependencies(path, 30)),
		])

		expect(verdicts.map((verdict) => verdict.kind).sort()).toEqual(["held", "taken"])
	})
})
