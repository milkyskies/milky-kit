import type { Gh, Repo } from "../github/gh.ts"
import { listWorktrees } from "../orca/cleanup.ts"
import { listHosts } from "../orca/hosts.ts"
import type { Orca } from "../orca/runner.ts"
import { issueNumberOfTitle, listTasks } from "../orca/tasks.ts"
import { listWorkers } from "../orca/workers.ts"
import type { DeskSection } from "../project/section.ts"
import { loadIssues } from "./load.ts"
import type { ReconcileInput } from "./types.ts"

export async function gatherInput(
	gh: Gh,
	repo: Repo,
	orca: Orca,
	section: DeskSection,
	now: Date,
	run: string,
): Promise<ReconcileInput> {
	const workers = await listWorkers(orca, { run, includeRemote: true })
	const tasks = await listTasks(orca, run)
	const hosts = await listHosts(orca)
	const worktrees = await listWorktrees(orca)

	const workerTaskIds = new Set(workers.map((worker) => worker.taskId))
	const numbers = tasks
		.filter((task) => workerTaskIds.has(task.id))
		.map((task) => issueNumberOfTitle(task.title))
		.filter((number) => number !== undefined)

	const issues = await loadIssues(gh, repo, numbers)

	return { issues, workers, tasks, worktrees, hosts, section, now }
}
