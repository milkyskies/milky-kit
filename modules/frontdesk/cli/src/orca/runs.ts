import { FrontdeskError, EXIT } from "../errors.ts"
import { readArray, readField, readString } from "../json.ts"
import type { Orca } from "./runner.ts"

export type Run = { id: string; objective: string }

export function runObjective(repoSlug: string): string {
	return `frontdesk ${repoSlug}`
}

export async function listRuns(orca: Orca): Promise<Run[]> {
	const runs: Run[] = []
	let cursor: string | undefined

	do {
		const args = ["orchestration", "run-list"]
		if (cursor !== undefined) args.push("--cursor", cursor)

		const result = await orca(args)
		runs.push(
			...readArray(result, "runs").map((row) => ({
				id: readString(row, "id"),
				objective: readString(row, "objective"),
			})),
		)

		const next = readField(result, "nextCursor")
		cursor = typeof next === "string" ? next : undefined
	} while (cursor !== undefined)

	return runs
}

export async function requireRun(orca: Orca, repoSlug: string): Promise<string> {
	const objective = runObjective(repoSlug)
	const existing = (await listRuns(orca)).find((run) => run.objective === objective)
	if (existing) return existing.id

	throw new FrontdeskError(
		EXIT.refused,
		`frontdesk: no Orca Run is named "${objective}". Fix: run frontdesk run in the coordinator terminal`,
	)
}

export async function bindRun(
	orca: Orca,
	repoSlug: string,
): Promise<{ id: string; created: boolean }> {
	const objective = runObjective(repoSlug)
	const existing = (await listRuns(orca)).find((run) => run.objective === objective)

	if (existing) {
		await orca(["orchestration", "run-use", "--id", existing.id])

		return { id: existing.id, created: false }
	}

	const created = await orca(["orchestration", "run-create", "--objective", objective])
	const run = readField(created, "run")

	return { id: readString(run ?? created, "id"), created: true }
}
