import { mismatch } from "../errors.ts"
import { appendToSection, lostProgramLines, sectionLines } from "./body.ts"
import type { Gh, Repo } from "./gh.ts"
import { readIssue } from "./issue.ts"
import { editBody } from "./writes.ts"

export async function appendProgramLine(
	gh: Gh,
	repo: Repo,
	number: number,
	command: string,
	heading: string,
	entry: string,
): Promise<void> {
	const fresh = await readIssue(gh, repo, number)
	await editBody(gh, repo, number, appendToSection(fresh.body, heading, entry))

	const after = await readIssue(gh, repo, number)
	const lost = lostProgramLines(fresh.body, after.body)
	const edits = after.bodyEdits - fresh.bodyEdits
	if (sectionLines(after.body, heading).includes(entry) && lost.length === 0 && edits === 1) return

	const saw =
		edits === 1
			? `a body ${lost.length > 0 ? `missing ${lost.join(" | ")}` : "without the entry"}`
			: `${edits} body edits since the fresh read, so another writer's line may be lost`

	throw mismatch(
		command,
		number,
		"body as read before the edit",
		saw,
		`## ${heading} holding "${entry}" after exactly one edit`,
	)
}
