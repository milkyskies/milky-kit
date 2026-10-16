import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, readInputFile } from "../context.ts"
import { mismatch, usageError } from "../errors.ts"
import { repoSlug } from "../github/gh.ts"
import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { postComment } from "../github/writes.ts"

const TYPES = ["feature", "change", "fix", "chore", "docs", "refactor"]
const ISSUE_URL = /\/issues\/(\d+)\s*$/

export const run: Command = async (args, context) => {
	const { values } = parseOrUsage("propose", () =>
		parseArgs({
			args,
			options: {
				from: { type: "string" },
				title: { type: "string" },
				type: { type: "string" },
				body: { type: "string" },
			},
		}),
	)
	const from = parseNumber("propose", values.from, "--from")
	const title = requireFlag("propose", values.title, "--title")
	const type = requireFlag("propose", values.type, "--type")
	const bodyPath = requireFlag("propose", values.body, "--body")

	if (!TYPES.includes(type)) {
		throw usageError("propose", `--type must be one of ${TYPES.join(", ")}, got ${type}`)
	}

	const body = await readInputFile("propose", context, bodyPath)
	if (!/^## Problem\s*$/m.test(body)) {
		throw usageError("propose", "the body must contain a ## Problem section")
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, from)

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
			`request,proposed,stage:intake,priority:P2,type:${type}`,
		],
		body,
	)
	const proposed = Number(ISSUE_URL.exec(created)?.[1])
	if (!Number.isInteger(proposed)) {
		throw mismatch(
			"propose",
			from,
			"no new issue",
			`unreadable output "${created.trim()}"`,
			"the new issue's URL",
		)
	}

	await postComment(
		gh,
		repo,
		from,
		composeComment(
			"proposed-request",
			{ issue: String(proposed) },
			`Filed a proposed request: #${proposed}.`,
		),
	)

	const after = await readIssue(gh, repo, from)
	const recorded = after.comments.some(
		(comment) =>
			comment.marker?.kind === "proposed-request" &&
			comment.marker.attrs.issue === String(proposed),
	)
	if (!recorded) {
		throw mismatch(
			"propose",
			from,
			`${before.comments.length} comments`,
			"no proposed-request comment",
			`a comment naming #${proposed}`,
		)
	}

	emit(context, String(proposed), { issue: proposed, from })
}
