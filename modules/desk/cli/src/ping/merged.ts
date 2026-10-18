import { type Repo, repoSlug } from "../github/gh.ts"

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
