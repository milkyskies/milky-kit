import type { IssueState, LinkedPullRequest } from "../github/issue.ts"

export function landedPullRequest(issue: IssueState): LinkedPullRequest | undefined {
	if (!issue.open) return issue.pullRequests.find((pr) => pr.state === "MERGED")

	const resultIndex = issue.comments.findLastIndex((comment) => comment.marker?.kind === "result")
	const result = issue.comments[resultIndex]
	if (!result) return undefined

	const reworked = issue.comments
		.slice(resultIndex + 1)
		.some((comment) => comment.marker?.kind === "reopen" || comment.marker?.kind === "claim")
	if (reworked) return undefined

	const named = Number(result.marker?.attrs.pr)

	return issue.pullRequests.find((pr) => pr.number === named && pr.state === "MERGED")
}
