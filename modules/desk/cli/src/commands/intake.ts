import { parseArgs } from "node:util"

import { parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, readInputFile } from "../context.ts"
import { mismatch, usageError } from "../errors.ts"
import { repoSlug } from "../github/gh.ts"
import { hasStage, readIssue } from "../github/issue.ts"
import { ASK_SETTINGS } from "../project/section.ts"

const TITLE_LENGTH = 60
const ISSUE_URL = /\/issues\/(\d+)\s*$/

export const run: Command = async (args, context) => {
	const { values } = parseOrUsage("intake", () =>
		parseArgs({ args, options: { words: { type: "string" }, ask: { type: "string" } } }),
	)
	const wordsPath = requireFlag("intake", values.words, "--words")
	const ask = requireFlag("intake", values.ask, "--ask")
	if (!ASK_SETTINGS.includes(ask)) {
		throw usageError("intake", `--ask must be one of ${ASK_SETTINGS.join(", ")}, got ${ask}`)
	}

	const words = (await readInputFile("intake", context, wordsPath)).trim()
	if (words === "") throw usageError("intake", `${wordsPath} holds no words`)

	const title = Array.from(words.split("\n", 1)[0] ?? "")
		.slice(0, TITLE_LENGTH)
		.join("")
		.trim()
	const body = `## Your words\n\n${words}\n\n## Decisions\n\n## Small calls\n`

	const { gh, repo } = context
	const created = await gh(
		[
			"issue",
			"create",
			"--repo",
			repoSlug(repo),
			"--title",
			title,
			"--body-file",
			"-",
			"--label",
			`request,stage:intake,priority:P2,${ask}`,
		],
		body,
	)
	const number = Number(ISSUE_URL.exec(created)?.[1])
	if (!Number.isInteger(number)) {
		throw mismatch(
			"intake",
			0,
			"no new issue",
			`unreadable output "${created.trim()}"`,
			"the new issue's URL",
		)
	}

	const after = await readIssue(gh, repo, number)
	if (!hasStage(after, "stage:intake") || !after.body.includes(`## Your words\n\n${words}`)) {
		throw mismatch(
			"intake",
			number,
			"no issue",
			`stage ${after.labels.join(", ")} with a body that lacks the words`,
			"stage:intake holding the words verbatim",
		)
	}

	emit(context, String(number), { issue: number, stage: "stage:intake" })
}
