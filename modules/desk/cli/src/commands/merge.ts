import { readdir } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage } from "../args.ts"
import { type Command, type Context, emit } from "../context.ts"
import { DeskError, EXIT, refusal } from "../errors.ts"
import { repoSlug } from "../github/gh.ts"
import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { postComment } from "../github/writes.ts"
import { requireStage } from "../guards.ts"
import { parseJson, readString } from "../json.ts"
import { type CiStatus, ciStatus } from "../merge/ci.ts"
import { firstFailingLine, type Shell, spawnShell } from "../merge/shell.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { landIssue } from "./land.ts"

const LOOKS_GOOD = /^looks good/i

export type MergeDeps = OrcaDeps & {
	shell: Shell
	hasWorkflows: (directory: string) => Promise<boolean>
}

export function realMergeDeps(): MergeDeps {
	return {
		...realOrcaDeps(),
		shell: spawnShell,
		hasWorkflows: async (directory) => {
			try {
				const names = await readdir(join(directory, ".github", "workflows"))

				return names.some((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
			} catch {
				return false
			}
		},
	}
}

function describeCi(status: CiStatus): { marker: string; text: string } {
	switch (status.kind) {
		case "none":
			return { marker: "none", text: "no CI configured" }
		case "blocked":
			return { marker: "blocked", text: `CI blocked (${status.detail})` }
		case "pending":
			return { marker: "pending", text: "CI still running when merged" }
		case "passed":
			return { marker: "passed", text: "CI passed" }
		case "failing":
			return { marker: "failing", text: `CI failing (${status.names.join(", ")})` }
		default: {
			const _exhaustive: never = status

			return _exhaustive
		}
	}
}

async function git(deps: MergeDeps, number: number, args: string[], cwd?: string): Promise<string> {
	const result = await deps.shell(["git", ...args], cwd)
	if (result.code !== 0) {
		throw new DeskError(
			EXIT.external,
			`desk: merge #${number}: git ${args.slice(0, 2).join(" ")} failed: ${firstFailingLine(result)}`,
		)
	}

	return result.stdout.trim()
}

export async function runWith(deps: MergeDeps, args: string[], context: Context): Promise<void> {
	const { values, positionals } = parseOrUsage("merge", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { "worktree-dir": { type: "string" } },
		}),
	)
	const number = parseNumber("merge", positionals[0], "the issue number")
	const { gh, repo } = context

	const before = await readIssue(gh, repo, number)
	requireStage("merge", before, "stage:check")

	const resultIndex = before.comments.findLastIndex((comment) => comment.marker?.kind === "result")
	const resultComment = before.comments[resultIndex]
	if (!resultComment) {
		throw refusal("merge", number, "there is no result comment", "a desk:result comment")
	}

	const humanIndex = before.comments.findLastIndex((comment) => !comment.agent)
	const human = before.comments[humanIndex]
	if (!human || humanIndex < resultIndex || !LOOKS_GOOD.test(human.body.trim())) {
		throw refusal(
			"merge",
			number,
			"the newest human comment is not a looks good newer than the result",
			'a human comment starting "looks good" after the result',
		)
	}

	const prNumber = Number(resultComment.marker?.attrs.pr)
	if (!Number.isInteger(prNumber)) {
		throw refusal("merge", number, "the result comment names no pull request", "pr=<number>")
	}

	const pr = parseJson(
		await gh([
			"pr",
			"view",
			String(prNumber),
			"--repo",
			repoSlug(repo),
			"--json",
			"state,headRefName",
		]),
	)
	const headRef = readString(pr, "headRefName")
	if (readString(pr, "state") !== "OPEN") {
		throw refusal("merge", number, `pull request #${prNumber} is not open`, "an open pull request")
	}

	const { check } = (await deps.loadSection()).coordinator
	const topLevel = await git(deps, number, ["rev-parse", "--show-toplevel"])
	const worktreeDir =
		values["worktree-dir"] ?? join(dirname(topLevel), `${basename(topLevel)}-worktrees`)
	const worktree = join(worktreeDir, `merge-${number}`)

	await git(deps, number, ["fetch", "origin", "main", headRef])
	await deps.shell(["git", "worktree", "remove", "--force", worktree])
	await git(deps, number, ["worktree", "add", "--detach", worktree, `origin/${headRef}`])

	let ci: CiStatus
	try {
		const merged = await deps.shell(
			["git", "merge", "origin/main", "-m", `Merge origin/main into ${headRef}`],
			worktree,
		)
		if (merged.code !== 0) {
			const conflicts = await deps.shell(
				["git", "diff", "--name-only", "--diff-filter=U"],
				worktree,
			)
			await deps.shell(["git", "merge", "--abort"], worktree)
			const files = conflicts.stdout.split("\n").filter((line) => line.trim() !== "")

			throw refusal(
				"merge",
				number,
				`merging origin/main conflicts in ${files.join(", ") || "the pull request branch"}`,
				"a clean merge",
			)
		}

		const checked = await deps.shell(["sh", "-c", check], worktree)
		if (checked.code !== 0) {
			throw refusal(
				"merge",
				number,
				`the check \`${check}\` failed: ${firstFailingLine(checked)}`,
				"a passing check",
			)
		}

		await git(deps, number, ["push", "origin", `HEAD:${headRef}`], worktree)
		const sha = await git(deps, number, ["rev-parse", "HEAD"], worktree)

		ci = await ciStatus(gh, repo, sha, await deps.hasWorkflows(worktree))
		if (ci.kind === "failing") {
			throw refusal("merge", number, describeCi(ci).text, "no failing check")
		}
	} finally {
		await deps.shell(["git", "worktree", "remove", "--force", worktree])
	}

	await gh(["pr", "merge", String(prNumber), "--repo", repoSlug(repo), "--merge"])

	const described = describeCi(ci)
	await postComment(
		gh,
		repo,
		number,
		composeComment(
			"merge",
			{ pr: String(prNumber), ci: described.marker, check: "passed" },
			`Merged pull request #${prNumber} with a merge commit.\n\n**CI:** ${described.text}\n**Local check:** passed (\`${check}\`)`,
		),
	)

	await landIssue(deps, context, number)

	emit(
		context,
		`#${number} merged pull request #${prNumber}: ${described.text}; local check passed`,
		{
			issue: number,
			pr: prNumber,
			ci: described.marker,
			check: "passed",
		},
	)
}

export const run: Command = (args, context) => runWith(realMergeDeps(), args, context)
