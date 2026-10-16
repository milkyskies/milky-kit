import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { refusal, usageError } from "../errors.ts"
import { newestClaim } from "../github/derive.ts"
import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { moveStage, postComment } from "../github/writes.ts"
import { describeState, requireStage, verifyStage } from "../guards.ts"

const REASONS = ["silent-machine", "no-worker", "stopped", "lost-race"]

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("release", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { reason: { type: "string" }, claim: { type: "string" } },
		}),
	)
	const number = parseNumber("release", positionals[0], "the issue number")
	const reason = requireFlag("release", values.reason, "--reason")
	if (!REASONS.includes(reason)) {
		throw usageError("release", `--reason must be one of ${REASONS.join(", ")}, got ${reason}`)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("release", before, "stage:working")

	const claim = newestClaim(before.comments)
	if (!claim) {
		throw refusal(
			"release",
			number,
			`there is no claim to release (${describeState(before)})`,
			"a newest claim",
		)
	}

	if (values.claim !== undefined && claim.id !== values.claim) {
		throw refusal("release", number, `the newest claim is ${claim.id}`, `claim ${values.claim}`)
	}

	await postComment(
		gh,
		repo,
		number,
		composeComment(
			"release",
			{ claim: claim.id, reason },
			`Released claim ${claim.id}: ${reason}.`,
		),
	)
	await moveStage(gh, repo, number, "stage:working", "stage:ready")

	const after = await readIssue(gh, repo, number)
	verifyStage("release", before, after, "stage:ready")

	emit(context, `#${number} → stage:ready (released ${claim.id}: ${reason})`, {
		issue: number,
		stage: "stage:ready",
		claim: claim.id,
		reason,
	})
}
