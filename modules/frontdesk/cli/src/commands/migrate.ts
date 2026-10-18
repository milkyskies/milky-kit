import { lstat, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"

import { parseOrUsage } from "../args.ts"
import type { Command, Context } from "../context.ts"
import { EXIT, FrontdeskError, mismatch } from "../errors.ts"
import { type Gh, type Repo, repoSlug } from "../github/gh.ts"
import { readIssue } from "../github/issue.ts"
import { parseJson, readNumber, ShapeError } from "../json.ts"
import { spawnRunner } from "../preflight/runner.ts"
import type { Runner } from "../preflight/types.ts"
import {
	countOldMarkers,
	isOldAgentComment,
	planManifest,
	rewriteMarkers,
} from "../project/migrate.ts"

const OPEN_ISSUE_LIMIT = "1000"

export type MigrateDependencies = { run: Runner; cwd: string }

type CommentChange = { issue: number; comment: number; markers: number }

type Report = {
	dryRun: boolean
	manifest: string | undefined
	staleLink: string | undefined
	comments: CommentChange[]
}

async function projectRootOf(dependencies: MigrateDependencies): Promise<string> {
	const result = await dependencies.run("git", ["rev-parse", "--show-toplevel"], {
		cwd: dependencies.cwd,
	})

	return result.status === 0 ? result.stdout.trim() : dependencies.cwd
}

async function openIssueNumbers(gh: Gh, repo: Repo): Promise<number[]> {
	const raw = await gh([
		"issue",
		"list",
		"--repo",
		repoSlug(repo),
		"--state",
		"open",
		"--limit",
		OPEN_ISSUE_LIMIT,
		"--json",
		"number",
	])

	const issues = parseJson(raw)
	if (!Array.isArray(issues)) throw new ShapeError("gh issue list did not return an array")

	return issues.map((issue) => readNumber(issue, "number"))
}

async function editComment(gh: Gh, repo: Repo, commentId: number, body: string): Promise<void> {
	await gh(
		["api", "-X", "PATCH", `repos/${repoSlug(repo)}/issues/comments/${commentId}`, "--input", "-"],
		JSON.stringify({ body }),
	)
}

async function migrateComments(context: Context, dryRun: boolean): Promise<CommentChange[]> {
	const { gh, repo } = context
	const changes: CommentChange[] = []

	for (const number of await openIssueNumbers(gh, repo)) {
		const before = await readIssue(gh, repo, number)
		const stale = before.comments.filter((comment) => isOldAgentComment(comment.body))

		for (const comment of stale) {
			changes.push({
				issue: number,
				comment: comment.databaseId,
				markers: countOldMarkers(comment.body),
			})
			if (!dryRun) await editComment(gh, repo, comment.databaseId, rewriteMarkers(comment.body))
		}

		if (dryRun || stale.length === 0) continue

		const after = await readIssue(gh, repo, number)
		const remaining = after.comments.filter((comment) => isOldAgentComment(comment.body)).length
		if (remaining > 0) {
			throw mismatch(
				"migrate",
				number,
				`${stale.length} comments with autopilot markers`,
				`${remaining} comments still with autopilot markers`,
				"no autopilot markers",
			)
		}
	}

	return changes
}

async function migrateManifest(
	dependencies: MigrateDependencies,
	root: string,
	dryRun: boolean,
): Promise<Pick<Report, "manifest" | "staleLink">> {
	const manifestPath = join(root, ".claude", "rules.manifest")
	const linkPath = join(root, ".claude", "rules", "autopilot.md")

	let text: string
	try {
		text = await readFile(manifestPath, "utf8")
	} catch {
		return { manifest: undefined, staleLink: undefined }
	}

	const plan = planManifest(text)
	if (!plan.changed) return { manifest: undefined, staleLink: undefined }

	const isLink = await lstat(linkPath).then(
		(entry) => entry.isSymbolicLink(),
		() => false,
	)

	if (!dryRun) {
		await writeFile(manifestPath, plan.text)
		if (isLink) await rm(linkPath)

		const linked = await dependencies.run("mise", ["run", "rules:link"], { cwd: root })
		if (linked.status !== 0) {
			throw new FrontdeskError(
				EXIT.external,
				`frontdesk: migrate: mise run rules:link failed: ${linked.stderr.trim() || `exit ${linked.status}`}`,
			)
		}
	}

	return {
		manifest: "autopilot.md → frontdesk.md in .claude/rules.manifest",
		staleLink: isLink ? ".claude/rules/autopilot.md" : undefined,
	}
}

function describe(report: Report): string[] {
	const verb = report.dryRun ? "would " : ""
	const lines: string[] = []

	if (report.manifest) lines.push(`${verb}rewrite ${report.manifest}`)
	if (report.staleLink) lines.push(`${verb}remove the stale link ${report.staleLink}`)
	if (report.manifest) lines.push(`${verb}run mise run rules:link`)

	for (const change of report.comments) {
		lines.push(
			`${verb}rewrite ${change.markers} autopilot ${change.markers === 1 ? "marker" : "markers"} to frontdesk in #${change.issue} comment ${change.comment}`,
		)
	}

	const total = report.comments.length
	lines.push(
		lines.length === 0
			? "nothing to migrate"
			: `${report.dryRun ? "dry run: nothing changed. " : ""}${total} ${total === 1 ? "comment" : "comments"} across open issues`,
	)

	return lines
}

export async function runMigrate(
	args: string[],
	context: Context,
	dependencies: MigrateDependencies,
): Promise<void> {
	const { values } = parseOrUsage("migrate", () =>
		parseArgs({ args, options: { "dry-run": { type: "boolean" } } }),
	)
	const dryRun = values["dry-run"] === true
	const root = await projectRootOf(dependencies)

	const files = await migrateManifest(dependencies, root, dryRun)
	const comments = await migrateComments(context, dryRun)
	const report: Report = { dryRun, ...files, comments }

	if (context.json) context.out(JSON.stringify(report))
	else for (const line of describe(report)) context.out(line)
}

export const run: Command = (args, context) =>
	runMigrate(args, context, { run: spawnRunner, cwd: process.cwd() })
