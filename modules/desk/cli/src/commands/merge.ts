import { readdir } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage } from "../args.ts"
import { type Command, type Context, emit } from "../context.ts"
import { DeskError, EXIT, refusal } from "../errors.ts"
import { repoSlug } from "../github/gh.ts"
import { type IssueState, readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { postComment } from "../github/writes.ts"
import { requireStage } from "../guards.ts"
import { parseJson, readString } from "../json.ts"
import { type CiStatus, ciStatus } from "../merge/ci.ts"
import { firstFailingLine, type Shell, spawnShell } from "../merge/shell.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { type DeskSection, landingOf } from "../project/section.ts"
import { parseDuration } from "../watch/loop.ts"
import { landIssue } from "./land.ts"

const LOOKS_GOOD = /^looks good/i

type BlockedCheck = "merge" | "check" | "review" | "ci"

class Blocked extends Error {
	constructor(
		readonly check: BlockedCheck,
		readonly got: string,
		readonly expected: string,
	) {
		super(got)
	}
}

type Approval = { prNumber: number; resultIndex: number; by: "human" | "auto" }

export type MergeDeps = OrcaDeps & {
	shell: Shell
	hasWorkflows: (directory: string) => Promise<boolean>
	sleep: (milliseconds: number) => Promise<void>
	nowMs: () => number
}

const CI_POLL_MS = 20_000
const DEFAULT_CI_TIMEOUT = "20m"
const NO_RUNS_GRACE_MS = 2 * 60_000

export function realMergeDeps(): MergeDeps {
	return {
		...realOrcaDeps(),
		shell: spawnShell,
		sleep: (milliseconds) => Bun.sleep(milliseconds),
		nowMs: () => Date.now(),
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
			return {
				marker: "none",
				text: status.reason === "no-runs" ? "no CI ran for this change" : "no CI configured",
			}
		case "blocked":
			return { marker: "blocked", text: `CI blocked (${status.detail})` }
		case "pending":
			return { marker: "pending", text: "CI did not finish" }
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

function requireApproval(issue: IssueState, number: number, section: DeskSection): Approval {
	requireStage("merge", issue, "stage:check")

	const resultIndex = issue.comments.findLastIndex((comment) => comment.marker?.kind === "result")
	const resultComment = issue.comments[resultIndex]
	if (!resultComment) {
		throw refusal("merge", number, "there is no result comment", "a desk:result comment")
	}

	const prNumber = Number(resultComment.marker?.attrs.pr)
	if (!Number.isInteger(prNumber)) {
		throw refusal("merge", number, "the result comment names no pull request", "pr=<number>")
	}

	const humanIndex = issue.comments.findLastIndex((comment) => !comment.agent)
	const human = issue.comments[humanIndex]
	const answered = human !== undefined && humanIndex > resultIndex
	if (answered && LOOKS_GOOD.test(human.body.trim())) return { prNumber, resultIndex, by: "human" }

	if (!answered && landingOf(issue.labels, section) === "land:auto")
		return { prNumber, resultIndex, by: "auto" }

	throw refusal(
		"merge",
		number,
		"the newest human comment is not a looks good newer than the result",
		'a human comment starting "looks good" after the result',
	)
}

function requireCleanReview(
	issue: IssueState,
	approval: Approval,
	changedFiles: readonly string[],
	reviewPaths: readonly string[],
): void {
	const globs = reviewPaths.map((glob) => new Bun.Glob(glob))
	const touched = changedFiles.find((file) => globs.some((glob) => glob.match(file)))
	if (touched === undefined) return

	const review = issue.comments
		.slice(approval.resultIndex + 1)
		.findLast(
			(comment) =>
				comment.marker?.kind === "review" && comment.marker.attrs.pr === String(approval.prNumber),
		)

	if (review?.marker?.attrs.verdict === "clean") return

	throw new Blocked(
		"review",
		review === undefined
			? `\`${touched}\` is on a review path and the standing reviewer has not reported on this result`
			: "the standing reviewer reported a blocking finding",
		"a clean review newer than the result",
	)
}

async function waitForCi(
	deps: MergeDeps,
	context: Context,
	sha: string,
	hasWorkflows: boolean,
	timeoutMs: number,
): Promise<CiStatus> {
	const start = deps.nowMs()
	const deadline = start + timeoutMs

	for (;;) {
		const status = await ciStatus(context.gh, context.repo, sha, hasWorkflows)
		if (status.kind === "failing") {
			throw new Blocked("ci", describeCi(status).text, "no failing check")
		}
		if (status.kind !== "pending") return status

		if (status.noRuns && deps.nowMs() - start >= NO_RUNS_GRACE_MS) {
			return { kind: "none", reason: "no-runs" }
		}

		if (deps.nowMs() >= deadline) {
			throw new Blocked(
				"ci",
				`CI on ${sha.slice(0, 7)} did not finish within ${Math.round(timeoutMs / 60_000)} minutes`,
				"CI finished and passing",
			)
		}

		await deps.sleep(CI_POLL_MS)
	}
}

type Verified = { ci: CiStatus; checkedSha: string }

async function verifyInWorktree(
	deps: MergeDeps,
	context: Context,
	input: {
		number: number
		headRef: string
		worktree: string
		issue: IssueState
		approval: Approval
		section: DeskSection
		ciTimeout: string
	},
): Promise<Verified> {
	const { number, headRef, worktree, issue, approval, section } = input
	const { check } = section.coordinator

	const merged = await deps.shell(
		["git", "merge", "origin/main", "-m", `Merge origin/main into ${headRef}`],
		worktree,
	)
	if (merged.code !== 0) {
		const conflicts = await deps.shell(["git", "diff", "--name-only", "--diff-filter=U"], worktree)
		await deps.shell(["git", "merge", "--abort"], worktree)
		const files = conflicts.stdout.split("\n").filter((line) => line.trim() !== "")

		throw new Blocked(
			"merge",
			`merging origin/main conflicts in ${files.join(", ") || "the pull request branch"}`,
			"a clean merge",
		)
	}

	if (approval.by === "auto") {
		const diff = await git(deps, number, ["diff", "--name-only", "origin/main", "HEAD"], worktree)
		requireCleanReview(issue, approval, diff.split("\n"), section.reviewPaths)
	}

	const checked = await deps.shell(["sh", "-c", check], worktree)
	if (checked.code !== 0) {
		throw new Blocked(
			"check",
			`the check \`${check}\` failed: ${firstFailingLine(checked)}`,
			"a passing check",
		)
	}

	await git(deps, number, ["push", "origin", `HEAD:${headRef}`], worktree)
	const checkedSha = await git(deps, number, ["rev-parse", "HEAD"], worktree)

	const timeout = parseDuration(input.ciTimeout)
	const ci = await waitForCi(deps, context, checkedSha, await deps.hasWorkflows(worktree), timeout)

	return { ci, checkedSha }
}

export async function runWith(deps: MergeDeps, args: string[], context: Context): Promise<void> {
	const { values, positionals } = parseOrUsage("merge", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { "worktree-dir": { type: "string" }, "ci-timeout": { type: "string" } },
		}),
	)
	const number = parseNumber("merge", positionals[0], "the issue number")
	const { gh, repo } = context

	const section = await deps.loadSection()
	const before = await readIssue(gh, repo, number)
	const approval = requireApproval(before, number, section)
	const { prNumber } = approval

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

	const { check } = section.coordinator
	const topLevel = await git(deps, number, ["rev-parse", "--show-toplevel"])
	const worktreeDir =
		values["worktree-dir"] ?? join(dirname(topLevel), `${basename(topLevel)}-worktrees`)
	const worktree = join(worktreeDir, `merge-${number}`)

	await git(deps, number, ["fetch", "origin", "main", headRef])
	await deps.shell(["git", "worktree", "remove", "--force", worktree])
	await git(deps, number, ["worktree", "add", "--detach", worktree, `origin/${headRef}`])

	let verified: Verified
	try {
		verified = await verifyInWorktree(deps, context, {
			number,
			headRef,
			worktree,
			issue: before,
			approval,
			section,
			ciTimeout: values["ci-timeout"] ?? DEFAULT_CI_TIMEOUT,
		})
	} catch (error) {
		if (!(error instanceof Blocked)) throw error
		if (approval.by === "human") throw refusal("merge", number, error.got, error.expected)

		await postComment(
			gh,
			repo,
			number,
			composeComment(
				"autoland",
				{ pr: String(prNumber), blocked: error.check },
				`Not landed automatically: ${error.got}.\n\nThe request stays at \`stage:check\` for a human. Comment \`looks good\` to merge it anyway.`,
			),
		)
		emit(context, `#${number} waits for a human: ${error.got}`, {
			issue: number,
			pr: prNumber,
			blocked: error.check,
		})

		return
	} finally {
		await deps.shell(["git", "worktree", "remove", "--force", worktree])
	}

	const { ci, checkedSha } = verified
	requireApproval(await readIssue(gh, repo, number), number, section)

	await gh([
		"pr",
		"merge",
		String(prNumber),
		"--repo",
		repoSlug(repo),
		"--merge",
		"--match-head-commit",
		checkedSha,
	])

	const described = describeCi(ci)
	await postComment(
		gh,
		repo,
		number,
		composeComment(
			"merge",
			{
				pr: String(prNumber),
				ci: described.marker,
				check: "passed",
				...(approval.by === "auto" ? { by: "auto" } : {}),
			},
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
