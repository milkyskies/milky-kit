import { isAgentBody, type Marker, parseMarker } from "./markers.ts"

export type Comment = {
	id: string
	databaseId: number
	body: string
	createdAt: string
}

export type ParsedComment = Comment & {
	marker: Marker | undefined
	agent: boolean
}

export type Claim = {
	id: string
	machine: string
	task: string
	dispatch: string
	at: string
	comment: ParsedComment
}

const NON_ATTEMPT_REASONS = ["answered", "reopened", "lost-race"]

export function parseComments(comments: readonly Comment[]): ParsedComment[] {
	return comments.map((comment) => ({
		...comment,
		marker: parseMarker(comment.body),
		agent: isAgentBody(comment.body),
	}))
}

function claimFrom(comment: ParsedComment): Claim | undefined {
	const { marker } = comment
	if (marker?.kind !== "claim") return undefined

	const { id, machine, task, dispatch, at } = marker.attrs
	if (!id || !machine || !task || !dispatch || !at) return undefined

	return { id, machine, task, dispatch, at, comment }
}

export function activeClaims(comments: readonly ParsedComment[]): Claim[] {
	const active: Claim[] = []

	comments.forEach((comment, index) => {
		const claim = claimFrom(comment)
		if (!claim) return

		const closed = comments.slice(index + 1).some((later) => {
			const kind = later.marker?.kind

			return (kind === "release" || kind === "failed") && later.marker?.attrs.claim === claim.id
		})
		if (!closed) active.push(claim)
	})

	return active
}

export function owningClaim(comments: readonly ParsedComment[]): Claim | undefined {
	return activeClaims(comments)[0]
}

export const newestClaim = owningClaim

export const earliestClaim = owningClaim

export function lastHumanComment(comments: readonly ParsedComment[]): ParsedComment | undefined {
	return comments.findLast((comment) => !comment.agent)
}

export function attemptCount(comments: readonly ParsedComment[]): number {
	const lastHuman = comments.findLastIndex((comment) => !comment.agent)

	return comments.slice(lastHuman + 1).filter((comment) => {
		const marker = comment.marker
		if (marker?.kind === "failed") return true

		return marker?.kind === "release" && !NON_ATTEMPT_REASONS.includes(marker.attrs.reason ?? "")
	}).length
}

export function describeClaim(claim: Claim): string {
	return `claim ${claim.id} on ${claim.machine}, ${claim.at.slice(0, 16)}Z`
}
