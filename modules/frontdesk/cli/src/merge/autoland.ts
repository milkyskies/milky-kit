import type { ParsedComment } from "../github/derive.ts"
import type { IssueState } from "../github/issue.ts"

export function resultHead(issue: IssueState, prNumber: number): string | undefined {
	return issue.pullRequests.find((pr) => pr.number === prNumber)?.headSha
}

// A blocked attempt is final for its result and the pull request head it tested, so a pass never repeats a failure nothing has changed.
// A new push to the pull request is something new to test, so a head that differs from the recorded one earns another try.
// A block written before heads were recorded cannot tell a push apart, so it keeps holding.
// A review block also yields to a clean review newer than the attempt, because the standing reviewer reports after the result.
export function autolandHeld(
	comments: readonly ParsedComment[],
	resultIndex: number,
	headSha: string | undefined,
): boolean {
	const blockedIndex = comments.findLastIndex((comment) => comment.marker?.kind === "autoland")
	if (blockedIndex === -1 || blockedIndex < resultIndex) return false

	const blocked = comments[blockedIndex]?.marker?.attrs
	const testedHead = blocked?.head
	if (testedHead !== undefined && headSha !== undefined && testedHead !== headSha) return false

	if (blocked?.blocked !== "review") return true

	return !comments
		.slice(blockedIndex + 1)
		.some(
			(comment) => comment.marker?.kind === "review" && comment.marker.attrs.verdict === "clean",
		)
}
