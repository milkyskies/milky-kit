import { mismatch, refusal } from "./errors.ts"
import { type Claim, describeClaim, newestClaim } from "./github/derive.ts"
import { hasStage, type IssueState, stageText } from "./github/issue.ts"

export function describeState(issue: IssueState): string {
	const claim = newestClaim(issue.comments)

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
	const claim = newestClaim(issue.comments)
	if (!claim) {
		throw refusal(
			command,
			issue.number,
			"there is no newest claim",
			`a claim by dispatch ${dispatch}`,
		)
	}

	if (claim.dispatch !== dispatch) {
		throw refusal(
			command,
			issue.number,
			`the newest claim ${claim.id} belongs to dispatch ${claim.dispatch}`,
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

export function verifyCommentCount(
	command: string,
	before: IssueState,
	after: IssueState,
	added: number,
): void {
	if (after.comments.length >= before.comments.length + added) return

	throw mismatch(
		command,
		after.number,
		`${before.comments.length} comments`,
		`${after.comments.length} comments`,
		`at least ${before.comments.length + added} comments`,
	)
}
