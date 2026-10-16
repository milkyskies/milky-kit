import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, readInputFile } from "../context.ts"
import { activeClaims, attemptCount } from "../github/derive.ts"
import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { moveStage, postComment, releaseClaims } from "../github/writes.ts"
import { requireOwnedClaim, requireStage, verifyClaimReleased, verifyStage } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("fail", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { dispatch: { type: "string" }, reason: { type: "string" } },
		}),
	)
	const number = parseNumber("fail", positionals[0], "the issue number")
	const dispatch = requireFlag("fail", values.dispatch, "--dispatch")
	const reasonPath = requireFlag("fail", values.reason, "--reason")

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("fail", before, "stage:working")
	const claim = requireOwnedClaim("fail", before, dispatch)

	const reason = await readInputFile("fail", context, reasonPath)
	const attempt = attemptCount(before.comments) + 1

	await postComment(
		gh,
		repo,
		number,
		composeComment("failed", { claim: claim.id, attempt: String(attempt) }, reason),
	)
	await releaseClaims(
		gh,
		repo,
		number,
		activeClaims(before.comments).filter((other) => other.id !== claim.id),
		"lost-race",
	)
	await moveStage(gh, repo, number, "stage:working", "stage:ready")

	const after = await readIssue(gh, repo, number)
	verifyStage("fail", before, after, "stage:ready")
	verifyClaimReleased("fail", before, after)

	emit(context, `#${number} → stage:ready (attempt ${attempt} failed)`, {
		issue: number,
		stage: "stage:ready",
		attempt,
	})
}
