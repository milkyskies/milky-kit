import type { ParsedComment } from "../github/derive.ts"

// A blocked attempt is final for its result, except a review block: the standing reviewer reports after the result, so a review comment newer than the attempt earns one more try.
export function autolandHeld(comments: readonly ParsedComment[], resultIndex: number): boolean {
	const blockedIndex = comments.findLastIndex((comment) => comment.marker?.kind === "autoland")
	if (blockedIndex === -1 || blockedIndex < resultIndex) return false

	if (comments[blockedIndex]?.marker?.attrs.blocked !== "review") return true

	return !comments.slice(blockedIndex + 1).some((comment) => comment.marker?.kind === "review")
}
