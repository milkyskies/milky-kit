import { mismatch, refusal } from "./errors.ts"
import { type Claim, describeClaim, owningClaim } from "./github/derive.ts"
import { hasStage, type IssueState, stageText } from "./github/issue.ts"

export function describeState(issue: IssueState): string {
	const claim = owningClaim(issue.comments)

	return claim ? `${stageText(issue)} (${describeClaim(claim)})` : stageText(issue)
}

export function requireStage(command: string, issue: IssueState, stage: string): void {
	if (!issue.open) {
		throw refusal(command, issue.number, `the issue is closed (${describeState(issue)})`, stage)
	}

	if (!hasStage(issue, stage)) {
		throw refusal(command, issue.number, `stage is ${describeState(issue)}`, stage)
	}
}

export function requireOwnedClaim(command: string, issue: IssueState, dispatch: string): Claim {
	const claim = owningClaim(issue.comments)
	if (!claim) {
		throw refusal(
			command,
			issue.number,
			"there is no owning claim",
			`a claim by dispatch ${dispatch}`,
		)
	}

	if (claim.dispatch !== dispatch) {
		throw refusal(
			command,
			issue.number,
			`the owning claim ${claim.id} belongs to dispatch ${claim.dispatch}`,
			`dispatch ${dispatch}`,
		)
	}

	return claim
}

export function verifyStage(
	command: string,
	before: IssueState,
	after: IssueState,
	expected: string,
): void {
	if (hasStage(after, expected)) return

	throw mismatch(command, after.number, describeState(before), describeState(after), expected)
}

export function verifyCommentsPosted(
	command: string,
	before: IssueState,
	after: IssueState,
	ids: readonly number[],
): void {
	const present = new Set(after.comments.map((comment) => comment.databaseId))
	const missing = ids.filter((id) => !present.has(id))
	if (missing.length === 0) return

	throw mismatch(
		command,
		after.number,
		`${before.comments.length} comments`,
		`${after.comments.length} comments without ${missing.join(", ")}`,
		`comments ${ids.join(", ")} present`,
	)
}

export function verifyStillOwned(
	command: string,
	before: IssueState,
	after: IssueState,
	claimId: string,
): void {
	const owner = owningClaim(after.comments)
	if (owner?.id === claimId) return

	throw mismatch(
		command,
		after.number,
		describeState(before),
		describeState(after),
		`claim ${claimId} still owning the issue`,
	)
}

export function verifyClaimReleased(command: string, before: IssueState, after: IssueState): void {
	if (owningClaim(after.comments) === undefined) return

	throw mismatch(
		command,
		after.number,
		describeState(before),
		describeState(after),
		"no unreleased claim",
	)
}
