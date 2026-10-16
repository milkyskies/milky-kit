import { readArray, readBoolean, readString } from "../json.ts"
import type { Shell } from "../merge/shell.ts"
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
	options: { environment?: string; force?: boolean } = {},
): Promise<void> {
	const args = ["worktree", "rm", "--worktree", `path:${path}`]
	if (options.force) args.push("--force")
	if (options.environment !== undefined) args.push("--environment", options.environment)

	await orca(args)
}

export type WorktreeVerdict =
	| { kind: "clean" }
	| { kind: "untracked"; paths: string[] }
	| { kind: "keep"; reason: string }

const UNTRACKED_PREFIX = "?? "

async function gitOutput(shell: Shell, path: string, args: string[]): Promise<string | undefined> {
	const result = await shell(["git", "-C", path, ...args])

	return result.code === 0 ? result.stdout : undefined
}

async function unpushedCommitCount(shell: Shell, path: string): Promise<number | undefined> {
	// Without an upstream the branch was never pushed, so origin/main is the closest bound on what the remote already holds.
	const against =
		(await gitOutput(shell, path, ["rev-list", "--count", "@{upstream}..HEAD"])) ??
		(await gitOutput(shell, path, ["rev-list", "--count", "origin/main..HEAD"]))
	if (against === undefined) return undefined

	const trimmed = against.trim()
	if (trimmed === "") return undefined

	const count = Number(trimmed)

	return Number.isInteger(count) ? count : undefined
}

export async function inspectWorktree(shell: Shell, path: string): Promise<WorktreeVerdict> {
	const status = await gitOutput(shell, path, ["status", "--porcelain"])
	if (status === undefined) return { kind: "keep", reason: "git status failed in the worktree" }

	const lines = status.split("\n").filter((line) => line !== "")
	const modified = lines.filter((line) => !line.startsWith(UNTRACKED_PREFIX))
	if (modified.length > 0) {
		return {
			kind: "keep",
			reason: `modified tracked files: ${modified.map((line) => line.slice(3)).join(", ")}`,
		}
	}

	const unpushed = await unpushedCommitCount(shell, path)
	if (unpushed === undefined) {
		return { kind: "keep", reason: "cannot tell whether the branch has unpushed commits" }
	}

	if (unpushed > 0) {
		return { kind: "keep", reason: `${unpushed} unpushed commit${unpushed === 1 ? "" : "s"}` }
	}

	if (lines.length === 0) return { kind: "clean" }

	return { kind: "untracked", paths: lines.map((line) => line.slice(UNTRACKED_PREFIX.length)) }
}

const DIRTY_REFUSAL_MARKERS = [
	"Worktree has uncommitted or untracked changes",
	"contains modified or untracked files",
]

// Orca reports no error code for a dirty-worktree refusal, so this matches the same wording Orca's own force-delete classifier does.
const FORMATTED_DIRTY_REFUSAL =
	/Failed to delete worktree at [^\n]*\.\s*(?:(?:[MADRCUT][ MADRCUT]| [MADRCUT]|\?\?)\s+\S)/

export function isDirtyWorktreeRefusal(message: string): boolean {
	return (
		DIRTY_REFUSAL_MARKERS.some((marker) => message.includes(marker)) ||
		FORMATTED_DIRTY_REFUSAL.test(message)
	)
}
