import { basename } from "node:path"

import type { WorktreeRow } from "./cleanup.ts"

// Orca names a second worktree for a taken name <n>-<digits>, so any other suffix is a hand-made worktree.
const ISSUE_NAME = /^(\d+)(?:-\d+)?$/

function issueNumberOfName(name: string): number | undefined {
	const match = ISSUE_NAME.exec(name)

	return match?.[1] === undefined ? undefined : Number(match[1])
}

function isRequestWorktree(row: WorktreeRow, number: number): boolean {
	const branchTail = row.branch.split("/").at(-1) ?? ""

	return (
		!row.isMain &&
		issueNumberOfName(basename(row.path)) === number &&
		issueNumberOfName(branchTail) === number
	)
}

// A worktree named exactly <n> comes first because the coordinator created it, and <n>-<digits> is a second copy Orca made beside it.
export function worktreesOfIssue(rows: WorktreeRow[], number: number): WorktreeRow[] {
	return rows
		.filter((row) => isRequestWorktree(row, number))
		.sort(
			(left, right) =>
				Number(basename(right.path) === String(number)) -
					Number(basename(left.path) === String(number)) || left.path.localeCompare(right.path),
		)
}
