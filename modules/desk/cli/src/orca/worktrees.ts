import { basename } from "node:path"

import type { WorktreeRow } from "./cleanup.ts"

const ISSUE_WORKTREE_NAME = /^(\d+)(?:-.+)?$/

export function issueNumberOfWorktree(path: string): number | undefined {
	const match = ISSUE_WORKTREE_NAME.exec(basename(path))

	return match?.[1] === undefined ? undefined : Number(match[1])
}

// A worktree named exactly <n> comes first because it is the one the coordinator created, and <n>-<suffix> is a second copy Orca made beside it.
export function worktreesOfIssue(rows: WorktreeRow[], number: number): WorktreeRow[] {
	return rows
		.filter((row) => !row.isMain && issueNumberOfWorktree(row.path) === number)
		.sort(
			(left, right) =>
				Number(basename(right.path) === String(number)) -
					Number(basename(left.path) === String(number)) || left.path.localeCompare(right.path),
		)
}
