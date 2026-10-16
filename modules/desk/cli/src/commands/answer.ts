import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, isoDay, readInputFile } from "../context.ts"
import { mismatch, usageError } from "../errors.ts"
import { appendToSection, lostProgramLines, sectionLines } from "../github/body.ts"
import { activeClaims, owningClaim } from "../github/derive.ts"
import { readIssue } from "../github/issue.ts"
import { AGENT_MARKER, composeComment } from "../github/markers.ts"
import { editBody, moveStage, postComment } from "../github/writes.ts"
import { requireStage, verifyStage } from "../guards.ts"

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
	const claim = owningClaim(before.comments)

	await postComment(gh, repo, number, answer)
	const fresh = await readIssue(gh, repo, number)
	await editBody(gh, repo, number, appendToSection(fresh.body, "Decisions", entry))

	if (claim) {
		await postComment(
			gh,
			repo,
			number,
			composeComment(
				"release",
				{ claim: claim.id, reason: "answered" },
				`Released claim ${claim.id}: answered.`,
			),
		)
	}

	await moveStage(gh, repo, number, "stage:needs-you", "stage:ready")

	const after = await readIssue(gh, repo, number)
	verifyStage("answer", before, after, "stage:ready")

	if (
		!sectionLines(after.body, "Decisions").includes(entry) ||
		lostProgramLines(fresh.body, after.body).length > 0 ||
		activeClaims(after.comments).length > 0
	) {
		throw mismatch(
			"answer",
			number,
			"decision not recorded",
			"decision or claim not as written",
			`## Decisions holding "${entry}" and no unreleased claim`,
		)
	}

	emit(context, `#${number} → stage:ready (answered)`, {
		issue: number,
		stage: "stage:ready",
		decision: entry,
	})
}
