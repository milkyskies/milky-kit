import { parseNumber } from "../args.ts"
import { type Command, type Context, emit } from "../context.ts"
import { DeskError, EXIT, refusal } from "../errors.ts"
import { owningClaim } from "../github/derive.ts"
import { repoSlug } from "../github/gh.ts"
import { readIssue, stageOf } from "../github/issue.ts"
import { AGENT_MARKER } from "../github/markers.ts"
import { editLabels, postComment } from "../github/writes.ts"
import { verifyStage } from "../guards.ts"
import type { Shell } from "../merge/shell.ts"
import { spawnShell } from "../merge/shell.ts"
import {
	inspectWorktree,
	isDirtyWorktreeRefusal,
	listWorktrees,
	releaseWorker,
	removeWorktree,
} from "../orca/cleanup.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { listHosts, machineOfHost } from "../orca/hosts.ts"
import { OrcaError } from "../orca/runner.ts"
import { requireRun } from "../orca/runs.ts"
import { listWorkers } from "../orca/workers.ts"
import { worktreesOfIssue } from "../orca/worktrees.ts"
import { landedPullRequest } from "../reconcile/landed.ts"

export type LandDeps = Pick<OrcaDeps, "orca"> & { shell: Shell }

export type KeptWorktree = { path: string; reason: string }

export type LandReport = { removedUntracked: string[]; kept: KeptWorktree[] }

type Cleanup = { failures: string[]; report: LandReport }

async function cleanUpWorker(deps: LandDeps, runId: string, dispatch: string): Promise<Cleanup> {
	const cleanup: Cleanup = { failures: [], report: { removedUntracked: [], kept: [] } }
	const workers = await listWorkers(deps.orca, { run: runId, includeRemote: true })
	const worker = workers.find((candidate) => candidate.dispatchId === dispatch)
	if (!worker) return cleanup

	const run = async (step: () => Promise<void>) => {
		try {
			await step()
		} catch (error) {
			cleanup.failures.push(error instanceof Error ? error.message : String(error))
		}
	}

	if (worker.terminalState !== "released") await run(() => releaseWorker(deps.orca, dispatch))

	const path = worker.worktreePath
	if (path === undefined) return cleanup

	if (worker.hostKind === "local") {
		const row = (await listWorktrees(deps.orca)).find((candidate) => candidate.path === path)
		if (row && !row.isMain) await run(() => removeLocalWorktree(deps, path, cleanup.report))

		return cleanup
	}

	const machine = machineOfHost(await listHosts(deps.orca), worker.hostKind, worker.hostId)
	await run(async () => {
		try {
			await removeWorktree(deps.orca, path, { environment: machine })
		} catch (error) {
			if (!(error instanceof OrcaError)) throw error
			if (error.message.includes("selector_not_found")) return
			if (!isDirtyWorktreeRefusal(error.message)) throw error

			// Git cannot run on the remote machine from here, so Orca's own refusal to delete is the only evidence the worktree holds changes.
			cleanup.report.kept.push({
				path,
				reason: `the worktree is on ${machine} and Orca refused to remove it: ${error.message}`,
			})
		}
	})

	return cleanup
}

async function removeLocalWorktree(
	deps: LandDeps,
	path: string,
	report: LandReport,
): Promise<void> {
	const verdict = await inspectWorktree(deps.shell, path)

	switch (verdict.kind) {
		case "clean":
			await removeWorktree(deps.orca, path)
			return
		case "untracked":
			await removeWorktree(deps.orca, path, { force: true })
			report.removedUntracked = verdict.paths
			return
		case "keep":
			report.kept.push({ path, reason: verdict.reason })
			return
		default: {
			const _exhaustive: never = verdict

			return _exhaustive
		}
	}
}

async function removeIssueWorktrees(
	deps: LandDeps,
	number: number,
	cleanup: Cleanup,
): Promise<void> {
	const alreadyKept = new Set(cleanup.report.kept.map((kept) => kept.path))

	for (const row of worktreesOfIssue(await listWorktrees(deps.orca), number)) {
		if (alreadyKept.has(row.path)) continue

		try {
			await removeLocalWorktree(deps, row.path, cleanup.report)
		} catch (error) {
			cleanup.failures.push(error instanceof Error ? error.message : String(error))
		}
	}
}

export async function landIssue(
	deps: LandDeps,
	context: Context,
	number: number,
): Promise<LandReport> {
	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	if (landedPullRequest(before) === undefined) {
		throw refusal(
			"land",
			number,
			"the pull request named by the newest result is not merged, or the request was reopened since",
			"a merged result pull request",
		)
	}

	const runId = await requireRun(deps.orca, repoSlug(repo))

	const stage = stageOf(before)
	const staleStages = (stage.kind === "one" ? [stage.label] : stage.labels).filter(
		(label) => label !== "stage:done",
	)
	const hasDone = before.labels.includes("stage:done")

	if (!hasDone || staleStages.length > 0) {
		await editLabels(gh, repo, number, {
			add: hasDone ? [] : ["stage:done"],
			remove: staleStages,
		})
	}

	if (before.open) {
		await gh(["issue", "close", String(number), "--repo", repoSlug(repo), "--comment", "Merged."])
	}

	const after = await readIssue(gh, repo, number)
	verifyStage("land", before, after, "stage:done")
	if (after.open) {
		throw new DeskError(
			EXIT.mismatch,
			`desk: land #${number} closed the issue, but the second read shows it open`,
		)
	}

	const claim = owningClaim(after.comments)
	const cleanup: Cleanup =
		claim === undefined
			? { failures: [], report: { removedUntracked: [], kept: [] } }
			: await cleanUpWorker(deps, runId, claim.dispatch)
	await removeIssueWorktrees(deps, number, cleanup)
	if (cleanup.failures.length > 0) {
		throw new DeskError(
			EXIT.external,
			`desk: land #${number} is done on GitHub, but the Orca cleanup failed: ${cleanup.failures.join("; ")}. The next pass retries it`,
		)
	}

	const { kept, removedUntracked } = cleanup.report
	if (removedUntracked.length > 0) {
		await postComment(
			context.gh,
			context.repo,
			number,
			`Landed. Removed the worktree together with these untracked files: ${removedUntracked.map((path) => `\`${path}\``).join(", ")}.\n\n${AGENT_MARKER}\n`,
		)
	}

	for (const worktree of kept) {
		const prefix = `worktree-kept: ${worktree.path}`
		if (after.comments.some((comment) => comment.body.includes(prefix))) continue

		await postComment(
			context.gh,
			context.repo,
			number,
			`${prefix} stays on disk because ${worktree.reason}. Land does not retry it.\n\n${AGENT_MARKER}\n`,
		)
	}

	return cleanup.report
}

export const run: Command = async (args, context) => {
	const number = parseNumber("land", args[0], "the issue number")

	const report = await landIssue({ ...realOrcaDeps(), shell: spawnShell }, context, number)

	const lines = [`#${number} → stage:done (landed)`]
	if (report.removedUntracked.length > 0) {
		lines.push(`removed untracked files with the worktree: ${report.removedUntracked.join(", ")}`)
	}

	for (const kept of report.kept) lines.push(`worktree-kept ${kept.path}: ${kept.reason}`)

	emit(context, lines.join("\n"), {
		issue: number,
		stage: "stage:done",
		removedUntracked: report.removedUntracked,
		kept: report.kept,
	})
}
