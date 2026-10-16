import { type Orca, OrcaError } from "../runner.ts"
import type { Worker } from "../workers.ts"

export type FakeTask = { id: string; title: string; createdAt: string }
export type FakeMessage = {
	id: string
	type: string
	from: string
	subject: string
	createdAt: string
	dispatchId?: string
}
export type FakeRun = { id: string; objective: string }

export function workerRow(worker: Worker) {
	return {
		dispatchId: worker.dispatchId,
		taskId: worker.taskId,
		runId: "run_1",
		workerState: worker.workerState,
		dispatchStatus: "dispatched",
		agentTerminalHandle: worker.terminalHandle ?? null,
		terminalState: worker.terminalState,
		resource: {
			worktreeId: worker.worktreePath === undefined ? null : `repo-id::${worker.worktreePath}`,
		},
		projection: {
			stage: { worker: worker.workerState, activity: worker.activity },
			liveness: { verdict: worker.verdict },
			host: { kind: worker.hostKind, id: worker.hostId },
		},
	}
}

export class FakeOrca {
	workers: Worker[] = []
	tasks: FakeTask[] = []
	messages: FakeMessage[] = []
	runs: FakeRun[] = []
	worktrees: { path: string; isMainWorktree: boolean }[] = []
	hosts = [
		{ kind: "local", id: "local", name: "this machine", machineName: "Minerva" },
		{ kind: "environment", id: "env-zeus", name: "zeus" },
	]
	reachable = new Map<string, boolean>()
	failing = new Set<string>()
	readonly calls: string[][] = []

	readonly orca: Orca = async (args) => {
		this.calls.push([...args])

		return this.handle(args)
	}

	called(...words: string[]): string[][] {
		return this.calls.filter((call) => words.every((word) => call.includes(word)))
	}

	private flag(args: readonly string[], name: string): string | undefined {
		const index = args.indexOf(name)

		return index === -1 ? undefined : args[index + 1]
	}

	private handle(args: readonly string[]): unknown {
		const key = args.slice(0, 2).join(" ")
		if (this.failing.has(key)) throw new OrcaError(args, `${key} was set to fail`)

		if (key === "orchestration worker-list") return this.workerList(args)

		if (key === "orchestration task-list") {
			return {
				tasks: this.tasks.map((task) => ({
					id: task.id,
					task_title: task.title,
					created_at: task.createdAt,
				})),
			}
		}

		if (key === "orchestration inbox") {
			return {
				messages: this.messages.map((message) => ({
					id: message.id,
					type: message.type,
					from_handle: message.from,
					subject: message.subject,
					created_at: message.createdAt,
					payload: JSON.stringify(
						message.dispatchId === undefined ? {} : { dispatchId: message.dispatchId },
					),
				})),
			}
		}

		if (key === "orchestration run-list") return { runs: this.runs, nextCursor: null }

		if (key === "orchestration run-create") {
			const run = { id: "run_new", objective: String(this.flag(args, "--objective")) }
			this.runs.push(run)

			return { run }
		}

		if (key === "orchestration run-use") return { run: { id: this.flag(args, "--id") } }
		if (key === "host list") return { hosts: this.hosts }
		if (key === "worktree ps") return { worktrees: this.worktrees }

		if (key === "worktree rm") {
			const path = String(this.flag(args, "--worktree")).replace("path:", "")
			this.worktrees = this.worktrees.filter((row) => row.path !== path)

			return {}
		}

		if (key === "orchestration worker-release" || key === "orchestration worker-stop") {
			const dispatch = this.flag(args, "--dispatch")
			const worker = this.workers.find((row) => row.dispatchId === dispatch)
			if (worker) {
				worker.terminalState = "released"
				worker.verdict = "exited"
			}

			return {}
		}

		if (args[0] === "status") {
			const environment = this.flag(args, "--environment") ?? "local"
			const reachable = this.reachable.get(environment) ?? true
			if (!reachable) throw new OrcaError(args, "the environment is unreachable")

			return { runtime: { reachable } }
		}

		throw new Error(`fake orca has no response for: orca ${args.join(" ")}`)
	}

	private workerList(args: readonly string[]): unknown {
		const remote = args.includes("--include-remote")
		const rows = this.workers.filter((worker) => remote || worker.hostKind === "local")

		return { workers: rows.map(workerRow), page: { nextCursor: null } }
	}
}
