import { parseArgs } from "node:util"
import { parseNumber, parseOrUsage } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { mismatch } from "../errors.ts"
import { readIssue } from "../github/issue.ts"
import { editLabels } from "../github/writes.ts"
import { describeState, requireProposal } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { positionals } = parseOrUsage("accept", () =>
		parseArgs({ args, allowPositionals: true, options: {} }),
	)
	const number = parseNumber("accept", positionals[0], "the issue number")

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireProposal("accept", before)

	await editLabels(gh, repo, number, { remove: ["proposed"] })

	const after = await readIssue(gh, repo, number)
	if (after.labels.includes("proposed")) {
		throw mismatch(
			"accept",
			number,
			describeState(before),
			"the proposed label still on the issue",
			"no proposed label",
		)
	}

	emit(context, `#${number} accepted (stage:intake)`, { issue: number, stage: "stage:intake" })
}
