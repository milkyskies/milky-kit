import { basename } from "node:path"

import { acquireCoordinatorLock } from "../project/lock.ts"
import { coordinatorLockPath } from "../project/paths.ts"
import { remoteMachines } from "../project/section.ts"
import type { Facts } from "./facts.ts"
import {
	type CheckResult,
	fail,
	type PreflightEnvironment,
	pass,
	type Runner,
	skip,
} from "./types.ts"

const ANCESTOR_LIMIT = 40

export const PING_SETUP_FIX =
	"set FRONTDESK_NTFY_URL and FRONTDESK_NTFY_TOPIC in ~/.config/frontdesk/.env, as docs/frontdesk/phase-2.md section 7 describes"

export async function findAncestorPid(
	run: Runner,
	startPid: number,
	executable: string,
): Promise<number | undefined> {
	let pid = startPid

	for (let step = 0; step < ANCESTOR_LIMIT && pid > 1; step += 1) {
		const result = await run("ps", ["-o", "ppid=,comm=", "-p", String(pid)])
		const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(result.stdout)
		const parent = Number(match?.[1])
		const command = match?.[2]
		if (result.status !== 0 || command === undefined || !Number.isInteger(parent)) return undefined

		if (pid !== startPid && basename(command) === executable) return pid

		pid = parent
	}

	return undefined
}

export async function checkPinnedMachine(
	_: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	const result = await facts.section()
	if (result.kind !== "ok") {
		return [
			fail(
				"pinned machine",
				"the pinned machine is unknown without a valid ## frontdesk section",
				"fix the ## frontdesk section first",
			),
		]
	}

	const pinned = result.section.coordinator.machine
	const local = await facts.localMachineName()
	if (local === pinned) return [pass("pinned machine", `this is ${pinned}, the pinned machine`)]

	return [
		fail(
			"pinned machine",
			`this machine is ${local}, the coordinator is pinned to ${pinned}`,
			`start the coordinator on ${pinned}`,
		),
	]
}

export async function checkCoordinatorLock(
	environment: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	if (environment.repo === undefined) return []

	const claudePid = await findAncestorPid(environment.run, environment.startPid, "claude")
	if (claudePid === undefined) {
		return [
			fail(
				"coordinator lock",
				"no claude process above this shell, so there is no session to hold the lock",
				"run the coordinator from a claude session",
			),
		]
	}

	const status = await facts.statusOf()

	const verdict = await acquireCoordinatorLock({
		path: coordinatorLockPath(environment.home, environment.repo),
		ownPid: claudePid,
		orcaSessionId: status?.sessionId,
		isAlive: environment.isAlive,
		now: environment.now,
	})

	if (verdict.kind === "taken") return [pass("coordinator lock", `lock taken by pid ${claudePid}`)]
	if (verdict.kind === "ours")
		return [pass("coordinator lock", `lock already held by pid ${claudePid}`)]

	const { orcaSessionId, pid } = verdict.lock
	const holder = orcaSessionId ? `Orca session ${orcaSessionId}` : `the claude process ${pid}`

	return [
		fail(
			"coordinator lock",
			`another coordinator holds the lock: ${holder} (pid ${pid})`,
			`stop the coordinator in ${holder} first`,
		),
	]
}

export async function checkWorkerMachines(
	_: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	const result = await facts.section()
	if (result.kind !== "ok") return []

	const checks: CheckResult[] = []
	for (const machine of remoteMachines(result.section)) {
		const check = `worker machine ${machine.name}`
		const status = await facts.statusOf(machine.name)

		checks.push(
			status?.reachable
				? pass(check, `${machine.name} reachable`)
				: skip(
						check,
						`${machine.name} unreachable, skipped this pass`,
						`connect ${machine.name} in Orca`,
					),
		)
	}

	return checks
}

export async function checkPingConfigured(
	environment: PreflightEnvironment,
): Promise<CheckResult[]> {
	const missing = ["FRONTDESK_NTFY_URL", "FRONTDESK_NTFY_TOPIC"].filter((key) => !environment.variables[key])
	if (missing.length === 0) return [pass("ping configured", "ping configured")]

	return [fail("ping configured", `${missing.join(" and ")} not set`, PING_SETUP_FIX)]
}
