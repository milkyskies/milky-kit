import { parseNumber } from "../args.ts"
import { type Command, type Context, emit } from "../context.ts"
import { DeskError, EXIT, refusal } from "../errors.ts"
import { owningClaim } from "../github/derive.ts"
import { repoSlug } from "../github/gh.ts"
import { readIssue, stageOf } from "../github/issue.ts"
import { editLabels } from "../github/writes.ts"
import { verifyStage } from "../guards.ts"
import { listWorktrees, releaseWorker, removeWorktree } from "../orca/cleanup.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { listHosts, machineOfHost } from "../orca/hosts.ts"
import { OrcaError } from "../orca/runner.ts"
import { requireRun } from "../orca/runs.ts"
import { listWorkers } from "../orca/workers.ts"
import { landedPullRequest } from "../reconcile/landed.ts"

export type LandDeps = Pick<OrcaDeps, "orca">

async function cleanUpWorker(deps: LandDeps, runId: string, dispatch: string): Promise<string[]> {
	const failures: string[] = []
	const workers = await listWorkers(deps.orca, { run: runId, includeRemote: true })
	const worker = workers.find((candidate) => candidate.dispatchId === dispatch)
	if (!worker) return failures

	const run = async (step: () => Promise<void>) => {
		try {
			await step()
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error))
		}
	}

	if (worker.terminalState !== "released") await run(() => releaseWorker(deps.orca, dispatch))

	const path = worker.worktreePath
	if (path === undefined) return failures

	if (worker.hostKind === "local") {
		const row = (await listWorktrees(deps.orca)).find((candidate) => candidate.path === path)
		if (row && !row.isMain) await run(() => removeWorktree(deps.orca, path))

		return failures
	}

	const machine = machineOfHost(await listHosts(deps.orca), worker.hostKind, worker.hostId)
	await run(async () => {
		try {
			await removeWorktree(deps.orca, path, machine)
		} catch (error) {
			if (!(error instanceof OrcaError && error.message.includes("selector_not_found"))) throw error
		}
	})

	return failures
}

export async function landIssue(deps: LandDeps, context: Context, number: number): Promise<void> {
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
	const failures =
		claim === undefined
			? []
			: await cleanUpWorker(deps, runId, claim.dispatch)
	if (failures.length > 0) {
		throw new DeskError(
			EXIT.external,
			`desk: land #${number} is done on GitHub, but the Orca cleanup failed: ${failures.join("; ")}. The next pass retries it`,
		)
	}
}

export const run: Command = async (args, context) => {
	const number = parseNumber("land", args[0], "the issue number")

	await landIssue(realOrcaDeps(), context, number)

	emit(context, `#${number} → stage:done (landed)`, { issue: number, stage: "stage:done" })
}
