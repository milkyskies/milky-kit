import { readArray, readBoolean, readString } from "../json.ts"
import type { Orca } from "./runner.ts"

export type WorktreeRow = { path: string; isMain: boolean }

export async function listWorktrees(orca: Orca): Promise<WorktreeRow[]> {
	const result = await orca(["worktree", "ps"])

	return readArray(result, "worktrees").map((row) => ({
		path: readString(row, "path"),
		isMain: readBoolean(row, "isMainWorktree"),
	}))
}

export async function releaseWorker(orca: Orca, dispatchId: string): Promise<void> {
	await orca(["orchestration", "worker-release", "--dispatch", dispatchId])
}

export async function stopWorker(orca: Orca, dispatchId: string): Promise<void> {
	await orca(["orchestration", "worker-stop", "--dispatch", dispatchId])
}

export async function removeWorktree(
	orca: Orca,
	path: string,
	environment?: string,
): Promise<void> {
	const args = ["worktree", "rm", "--worktree", `path:${path}`]
	if (environment !== undefined) args.push("--environment", environment)

	await orca(args)
}
