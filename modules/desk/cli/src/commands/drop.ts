import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { mismatch } from "../errors.ts"
import { hasStage, readIssue } from "../github/issue.ts"
import { closeNotPlanned, editLabels } from "../github/writes.ts"
import { describeState, requireProposal } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { positionals } = parseOrUsage("drop", () =>
		parseArgs({ args, allowPositionals: true, options: {} }),
	)
	const number = parseNumber("drop", positionals[0], "the issue number")

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireProposal("drop", before)

	await editLabels(gh, repo, number, {
		add: ["stage:done"],
		remove: ["stage:intake", "proposed"],
	})
	await closeNotPlanned(gh, repo, number)

	const after = await readIssue(gh, repo, number)
	if (after.open || !hasStage(after, "stage:done") || after.labels.includes("proposed")) {
		throw mismatch(
			"drop",
			number,
			describeState(before),
			`${after.open ? "open" : "closed"} at ${describeState(after)}`,
			"closed at stage:done with no proposed label",
		)
	}

	emit(context, `#${number} dropped (closed as not planned)`, {
		issue: number,
		stage: "stage:done",
	})
}
