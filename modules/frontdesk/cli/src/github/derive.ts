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
	role: string | undefined
	comment: ParsedComment
}

export type OpenCard = { id: string; claim: string | undefined; comment: ParsedComment }

export const FRONTMAN_ROLE = "frontman"

const NON_ATTEMPT_REASONS = ["answered", "reopened", "lost-race", "ready"]

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

	const { id, machine, task, dispatch, at, role } = marker.attrs
	if (!id || !machine || !task || !dispatch || !at) return undefined

	return { id, machine, task, dispatch, at, role, comment }
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

export function answeredCardIds(comments: readonly ParsedComment[]): Set<string> {
	const ids = comments.flatMap((comment) =>
		comment.marker?.kind === "answer" && comment.marker.attrs.card !== undefined
			? [comment.marker.attrs.card]
			: [],
	)

	return new Set(ids)
}

export function claimReleasedForReady(
	comments: readonly ParsedComment[],
	dispatch: string,
): Claim | undefined {
	const claim = comments
		.map(claimFrom)
		.findLast((candidate) => candidate?.dispatch === dispatch && candidate.role === FRONTMAN_ROLE)
	if (claim === undefined) return undefined

	const released = comments.some(
		(comment) =>
			comment.marker?.kind === "release" &&
			comment.marker.attrs.claim === claim.id &&
			comment.marker.attrs.reason === "ready",
	)

	return released ? claim : undefined
}

export function returnStage(claim: Claim | undefined): "stage:intake" | "stage:ready" {
	return claim?.role === FRONTMAN_ROLE ? "stage:intake" : "stage:ready"
}

export function parkingClaim(comments: readonly ParsedComment[]): Claim | undefined {
	const parked = comments.findLast((comment) => comment.marker?.kind === "decision")
	const claimId = parked?.marker?.attrs.claim
	if (claimId === undefined) return owningClaim(comments)

	const claim = comments
		.map(claimFrom)
		.find((candidate) => candidate !== undefined && candidate.id === claimId)

	return claim ?? owningClaim(comments)
}

export function newestPark(comments: readonly ParsedComment[]): OpenCard[] {
	const cards = comments.flatMap((comment) =>
		comment.marker?.kind === "decision"
			? [
					{
						id: comment.marker.attrs.card ?? `legacy-${comment.databaseId}`,
						claim: comment.marker.attrs.claim,
						comment,
					},
				]
			: [],
	)
	const newest = cards.at(-1)
	if (newest === undefined) return []

	return cards.filter((card) => card.claim === newest.claim)
}

export function openCards(comments: readonly ParsedComment[]): OpenCard[] {
	const answered = answeredCardIds(comments)

	return newestPark(comments).filter((card) => !answered.has(card.id))
}

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
