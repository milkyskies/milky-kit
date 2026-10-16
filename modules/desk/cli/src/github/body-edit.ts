import { mismatch } from "../errors.ts"
import { appendToSection, lostProgramLines, sectionLines } from "./body.ts"
import type { Gh, Repo } from "./gh.ts"
import { readIssue } from "./issue.ts"
import { editBody } from "./writes.ts"

export function expectedEditDelta(editsBefore: number): number {
	return editsBefore === 0 ? 2 : 1
}

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
	const expected = expectedEditDelta(fresh.bodyEdits)
	if (sectionLines(after.body, heading).includes(entry) && lost.length === 0 && edits === expected)
		return

	const saw =
		edits === expected
			? `a body ${lost.length > 0 ? `missing ${lost.join(" | ")}` : "without the entry"}`
			: `${edits} body edit records since the fresh read (expected ${expected}), so another writer's line may be lost`

	throw mismatch(
		command,
		number,
		"body as read before the edit",
		saw,
		`## ${heading} holding "${entry}" after exactly our own edit`,
	)
}
