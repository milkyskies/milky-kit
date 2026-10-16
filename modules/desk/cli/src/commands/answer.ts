import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, isoDay, readInputFile } from "../context.ts"
import { usageError } from "../errors.ts"
import { appendProgramLine } from "../github/body-edit.ts"
import { activeClaims } from "../github/derive.ts"
import { readIssue } from "../github/issue.ts"
import { AGENT_MARKER } from "../github/markers.ts"
import { moveStage, postComment, releaseClaims } from "../github/writes.ts"
import { requireStage, verifyClaimReleased, verifyStage } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("answer", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { body: { type: "string" }, decision: { type: "string" } },
		}),
	)
	const number = parseNumber("answer", positionals[0], "the issue number")
	const bodyPath = requireFlag("answer", values.body, "--body")
	const decision = requireFlag("answer", values.decision, "--decision")

	const answer = await readInputFile("answer", context, bodyPath)
	if (answer.includes(AGENT_MARKER)) {
		throw usageError(
			"answer",
			`the answer must not carry ${AGENT_MARKER}, because it is the human's comment`,
		)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("answer", before, "stage:needs-you")

	const entry = `- ${isoDay(context.now())}: ${decision}`
	const claims = activeClaims(before.comments)

	await postComment(gh, repo, number, answer)
	await appendProgramLine(gh, repo, number, "answer", "Decisions", entry)

	await releaseClaims(gh, repo, number, claims, "answered")

	await moveStage(gh, repo, number, "stage:needs-you", "stage:ready")

	const after = await readIssue(gh, repo, number)
	verifyStage("answer", before, after, "stage:ready")

	verifyClaimReleased("answer", before, after)

	emit(context, `#${number} → stage:ready (answered)`, {
		issue: number,
		stage: "stage:ready",
		decision: entry,
	})
}
