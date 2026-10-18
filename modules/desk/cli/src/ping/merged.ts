import { type Gh, type Repo, repoSlug } from "../github/gh.ts"

export type MergedPing = {
	repo: Repo
	issue: number
	title: string
	summary: string
	pullRequest: number
}

export function mergedMessage(merged: MergedPing): string {
	const lines = [
		`${merged.repo.name}: merged #${merged.issue} ${merged.title}`,
		...(merged.summary === "" ? [] : [merged.summary]),
		`https://github.com/${repoSlug(merged.repo)}/pull/${merged.pullRequest}`,
	]

	return lines.join("\n")
}

const MERGE_PINGED_LINE = /^<!-- desk:merge-pinged at=(\S+) -->\s*$/m

export function mergePingedAt(body: string): Date | undefined {
	const time = Date.parse(MERGE_PINGED_LINE.exec(body)?.[1] ?? "")

	return Number.isNaN(time) ? undefined : new Date(time)
}

// The digest keys on desk:pinged, so this separate marker keeps the merge in the digest after its own ping.
export async function markMergePinged(
	gh: Gh,
	repo: Repo,
	comment: { databaseId: number; body: string },
	now: Date,
): Promise<void> {
	const body = `${comment.body.trimEnd()}\n<!-- desk:merge-pinged at=${now.toISOString().slice(0, 19)}Z -->\n`

	await gh(
		[
			"api",
			"-X",
			"PATCH",
			`repos/${repoSlug(repo)}/issues/comments/${comment.databaseId}`,
			"--input",
			"-",
		],
		JSON.stringify({ body }),
	)
}
