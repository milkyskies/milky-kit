import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { refusal } from "../errors.ts"
import { owningClaim } from "../github/derive.ts"
import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { moveStage, postComment } from "../github/writes.ts"
import { requireStage, verifyStage } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("reopen", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { comment: { type: "string" } },
		}),
	)
	const number = parseNumber("reopen", positionals[0], "the issue number")
	const commentId = parseNumber(
		"reopen",
		requireFlag("reopen", values.comment, "--comment"),
		"--comment",
	)

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("reopen", before, "stage:check")

	const reason = before.comments.find((comment) => comment.databaseId === commentId)
	if (!reason || reason.agent) {
		throw refusal(
			"reopen",
			number,
			`comment ${commentId} is not a human comment on this issue`,
			"Milky's reason comment",
		)
	}

	const quoted = reason.body
		.trim()
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n")

	const claim = owningClaim(before.comments)

	await postComment(
		gh,
		repo,
		number,
		composeComment("reopen", { comment: String(commentId) }, `Sent back. Reason:\n\n${quoted}`),
	)

	if (claim) {
		await postComment(
			gh,
			repo,
			number,
			composeComment(
				"release",
				{ claim: claim.id, reason: "reopened" },
				`Released claim ${claim.id}: reopened.`,
			),
		)
	}

	await moveStage(gh, repo, number, "stage:check", "stage:ready")

	const after = await readIssue(gh, repo, number)
	verifyStage("reopen", before, after, "stage:ready")

	emit(context, `#${number} → stage:ready (reopened)`, {
		issue: number,
		stage: "stage:ready",
		comment: commentId,
	})
}
