import {
	checkCoordinatorLock,
	checkPingConfigured,
	checkPinnedMachine,
	checkWorkerMachines,
} from "./coordinator-checks.ts"
import { createFacts, type Facts } from "./facts.ts"
import {
	checkDeskSection,
	checkLabels,
	checkMcpServers,
	checkProjectNeeds,
	checkRulesLinked,
} from "./project-checks.ts"
import {
	checkBun,
	checkGhLoggedIn,
	checkKitCurrent,
	checkKitPresent,
	checkMiseTools,
	checkOrcaRunning,
	checkRepositoryResolved,
	checkRepositoryWritable,
	checkSerena,
} from "./tool-checks.ts"
import { type CheckResult, fail, type PreflightEnvironment, type Role } from "./types.ts"

type Check = (environment: PreflightEnvironment, facts: Facts) => Promise<CheckResult[]>

const SHARED_CHECKS: Check[] = [
	checkBun,
	checkKitPresent,
	checkKitCurrent,
	checkOrcaRunning,
	checkGhLoggedIn,
	checkRepositoryResolved,
	checkRepositoryWritable,
	checkRulesLinked,
	checkMcpServers,
	checkMiseTools,
	checkProjectNeeds,
]

const ROLE_CHECKS: Record<Role, Check[]> = {
	worker: [checkSerena],
	coordinator: [
		checkDeskSection,
		checkLabels,
		checkPinnedMachine,
		checkCoordinatorLock,
		checkWorkerMachines,
		checkPingConfigured,
	],
}

export async function runChecks(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const facts = createFacts(environment)
	const results: CheckResult[] = []

	for (const check of [...SHARED_CHECKS, ...ROLE_CHECKS[environment.role]]) {
		try {
			results.push(...(await check(environment, facts)))
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error)
			results.push(fail(check.name, `${check.name} crashed: ${detail}`, "report this to the kit"))
		}
	}

	return results
}

export function formatResult(result: CheckResult): string {
	if (result.skipped) return `skip  ${result.detail} · fix: ${result.fix}`
	if (result.ok) return `ok    ${result.detail}`

	return `FAIL  ${result.detail} · fix: ${result.fix}`
}

export function toJson(
	results: CheckResult[],
): Array<{ check: string; ok: boolean; detail: string; fix: string | null; skipped: boolean }> {
	return results.map((result) => ({
		check: result.check,
		ok: result.ok,
		detail: result.detail,
		fix: result.fix ?? null,
		skipped: result.skipped,
	}))
}
