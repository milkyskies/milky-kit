import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { attemptCount, describeClaim, lastHumanComment, newestClaim } from "../github/derive.ts"
import { readIssue, stageText } from "../github/issue.ts"

export const run: Command = async (args, context) => {
	const { positionals } = parseOrUsage("status", () => parseArgs({ args, allowPositionals: true }))
	const number = parseNumber("status", positionals[0], "the issue number")

	const issue = await readIssue(context.gh, context.repo, number)
	const claim = newestClaim(issue.comments)
	const human = lastHumanComment(issue.comments)
	const pullRequest = issue.pullRequests[0]
	const attempts = attemptCount(issue.comments)

	const humanLine = human ? `${human.createdAt} (comment ${human.databaseId})` : "none"
	const pullRequestLine = pullRequest
		? `#${pullRequest.number} ${pullRequest.state}${pullRequest.isDraft ? " draft" : ""}, ${pullRequest.mergeable}`
		: "none"

	emit(
		context,
		[
			`#${number} ${issue.open ? "open" : "closed"}: ${stageText(issue)}`,
			`claim: ${claim ? `${describeClaim(claim)}, dispatch ${claim.dispatch}` : "none"}`,
			`attempts: ${attempts}`,
			`last human comment: ${humanLine}`,
			`pull request: ${pullRequestLine}`,
		].join("\n"),
		{
			issue: number,
			open: issue.open,
			stage: stageText(issue),
			claim: claim
				? { id: claim.id, machine: claim.machine, dispatch: claim.dispatch, at: claim.at }
				: null,
			attempts,
			lastHumanComment: human ? { id: human.databaseId, at: human.createdAt } : null,
			pullRequest: pullRequest ?? null,
		},
	)
}
