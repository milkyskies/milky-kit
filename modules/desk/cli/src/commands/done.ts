import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { refusal, usageError } from "../errors.ts"
import { sectionLines } from "../github/body.ts"
import { type Gh, type Repo, repoSlug } from "../github/gh.ts"
import { readIssue, readPullRequest } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { moveStage, postComment } from "../github/writes.ts"
import { requireOwnedClaim, requireStage, verifyCommentCount, verifyStage } from "../guards.ts"
import { parseJson, readField, readNumber, readString } from "../json.ts"

export function renderPicture(url: string): string {
	return `![picture](${url})`
}

async function describeBase(gh: Gh, repo: Repo, baseRef: string, headSha: string): Promise<string> {
	const raw = await gh(["api", `repos/${repoSlug(repo)}/compare/${baseRef}...${headSha}`])
	const compare = parseJson(raw)
	const behindBy = readNumber(compare, "behind_by")
	const baseSha = readString(readField(compare, "base_commit"), "sha").slice(0, 7)

	return behindBy === 0
		? `its head contains ${baseRef} at ${baseSha} (behind_by 0)`
		: `its head is behind ${baseRef} at ${baseSha} by ${behindBy} commits`
}

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("done", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: {
				dispatch: { type: "string" },
				pr: { type: "string" },
				summary: { type: "string" },
				picture: { type: "string", multiple: true },
				"no-picture": { type: "string" },
				checked: { type: "string" },
				see: { type: "string" },
			},
		}),
	)
	const number = parseNumber("done", positionals[0], "the issue number")
	const dispatch = requireFlag("done", values.dispatch, "--dispatch")
	const prNumber = parseNumber("done", values.pr, "--pr")
	const summary = requireFlag("done", values.summary, "--summary")
	const checked = requireFlag("done", values.checked, "--checked")
	const pictures = values.picture ?? []
	const noPicture = values["no-picture"]

	if (pictures.length === 0 && noPicture === undefined) {
		throw usageError("done", 'give --picture <url> or --no-picture "<why>"')
	}
	if (pictures.length > 0 && noPicture !== undefined) {
		throw usageError("done", "--picture and --no-picture exclude each other")
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("done", before, "stage:working")
	const claim = requireOwnedClaim("done", before, dispatch)

	const pr = await readPullRequest(gh, repo, prNumber)
	const firstLine = pr.body.split("\n", 1)[0]?.trim()
	const problem = !pr.open
		? "the pull request is not open"
		: pr.isDraft
			? "the pull request is still a draft"
			: firstLine !== `closes #${number}`
				? `the pull request body starts with "${firstLine ?? ""}"`
				: pr.mergeable === "CONFLICTING"
					? "GitHub reports the pull request CONFLICTING"
					: undefined
	if (problem !== undefined) {
		throw refusal(
			"done",
			number,
			problem,
			`pull request #${prNumber} open, ready, starting "closes #${number}", not CONFLICTING`,
		)
	}

	const decisions = sectionLines(before.body, "Decisions")
	const smallCalls = sectionLines(before.body, "Small calls").length
	const proposed = before.comments
		.filter((comment) => comment.marker?.kind === "proposed-request")
		.filter((comment) => comment.databaseId > claim.comment.databaseId)
		.map((comment) => `#${comment.marker?.attrs.issue ?? "?"}`)
	const baseText = await describeBase(gh, repo, pr.baseRef, pr.headSha)

	const lines = [
		"## Done, check it",
		"",
		summary,
		"",
		pictures.length > 0 ? pictures.map(renderPicture).join("\n") : `No picture: ${noPicture}`,
		"",
		...(values.see === undefined ? [] : [`**See it yourself:** ${values.see}`]),
		`**Pull request:** #${prNumber}`,
		decisions.length === 0
			? "**Decisions used:** none"
			: `**Decisions used:**\n${decisions.join("\n")}`,
		`**Small calls:** ${smallCalls === 0 ? "none" : `${smallCalls}, listed under \`## Small calls\` in the description`}`,
		`**Verified by desk:** the pull request is not CONFLICTING (GitHub says ${pr.mergeable}), and ${baseText}.`,
		`**Worker says:** ${checked}`,
		...(proposed.length === 0 ? [] : [`**Proposed requests:** ${proposed.join(", ")}`]),
		"",
		"Reply `looks good` to merge, or `no, because …` to send it back.",
	]

	await postComment(
		gh,
		repo,
		number,
		composeComment("result", { claim: claim.id, pr: String(prNumber) }, lines.join("\n")),
	)
	await moveStage(gh, repo, number, "stage:working", "stage:check")

	const after = await readIssue(gh, repo, number)
	verifyCommentCount("done", before, after, 1)
	verifyStage("done", before, after, "stage:check")

	emit(context, `#${number} → stage:check (pull request #${prNumber})`, {
		issue: number,
		stage: "stage:check",
		pr: prNumber,
	})
}
