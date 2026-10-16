import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, isoDay } from "../context.ts"
import { mismatch, refusal } from "../errors.ts"
import { appendToSection, sectionLines } from "../github/body.ts"
import { readIssue } from "../github/issue.ts"
import { editBody } from "../github/writes.ts"
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
	await editBody(gh, repo, number, appendToSection(before.body, "Small calls", entry))

	const after = await readIssue(gh, repo, number)
	if (!sectionLines(after.body, "Small calls").includes(entry)) {
		throw mismatch(
			"note",
			number,
			"body without the entry",
			"body without the entry",
			`## Small calls holding "${entry}"`,
		)
	}

	emit(context, `#${number} noted: ${line}`, { issue: number, note: entry })
}
