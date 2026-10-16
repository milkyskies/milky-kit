import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, isoDay } from "../context.ts"
import { refusal } from "../errors.ts"
import { appendProgramLine } from "../github/body-edit.ts"
import { readIssue } from "../github/issue.ts"
import { requireOwnedClaim } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("note", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { dispatch: { type: "string" } },
		}),
	)
	const number = parseNumber("note", positionals[0], "the issue number")
	const dispatch = requireFlag("note", values.dispatch, "--dispatch")
	const line = requireFlag("note", positionals[1], "the Auto-decided line")

	if (
		!line.startsWith("Auto-decided:") ||
		!line.includes(" over ") ||
		!line.includes(" because ")
	) {
		throw refusal(
			"note",
			number,
			`the line "${line}" does not match the shape`,
			'"Auto-decided: X over Y because Z"',
		)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireOwnedClaim("note", before, dispatch)

	const entry = `- ${isoDay(context.now())}: ${line}`
	await appendProgramLine(gh, repo, number, "note", "Small calls", entry)

	emit(context, `#${number} noted: ${line}`, { issue: number, note: entry })
}
