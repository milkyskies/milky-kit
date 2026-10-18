import { parseComments } from "../../github/derive.ts"
import type { IssueState } from "../../github/issue.ts"
import { composeComment } from "../../github/markers.ts"
import type { WorktreeRow } from "../../orca/cleanup.ts"
import type { Host } from "../../orca/hosts.ts"
import type { Task } from "../../orca/tasks.ts"
import type { Worker } from "../../orca/workers.ts"
import type { FrontdeskSection } from "../../project/section.ts"
import type { ReconcileInput } from "../types.ts"

export const NOW = new Date("2026-10-16T15:00:00Z")

export const SECTION: FrontdeskSection = {
	coordinator: {
		machine: "Minerva",
		ask: "ask:choices",
		check: "mise run check",
		land: "land:check",
	},
	reviewPaths: [],
	machines: [{ name: "Minerva", workers: 3, repo: undefined }],
	preflight: { needs: [], mcp: [] },
}

export const HOSTS: Host[] = [
	{ kind: "local", id: "local", name: "Minerva" },
	{ kind: "environment", id: "env-zeus", name: "zeus" },
]

export function worktreeRow(path: string, overrides: Partial<WorktreeRow> = {}): WorktreeRow {
	return {
		path,
		isMain: false,
		repoId: "repo_kit",
		hostId: "local",
		branch: `refs/heads/milkyskies/${path.split("/").at(-1)}`,
		liveTerminalCount: 0,
		...overrides,
	}
}

export function minutesAgo(minutes: number): string {
	return new Date(NOW.getTime() - minutes * 60_000).toISOString().slice(0, 19).concat("Z")
}

export function issue(
	number: number,
	labels: string[],
	bodies: string[] = [],
	overrides: Partial<IssueState> = {},
): IssueState {
	return {
		number,
		title: `Request ${number}`,
		open: true,
		body: "## Problem\n\nSomething is missing.\n",
		bodyEdits: 0,
		labels,
		assignees: [],
		comments: parseComments(
			bodies.map((body, index) => ({
				id: `IC_${number}_${index}`,
				databaseId: 1000 + index,
				body,
				createdAt: minutesAgo(100 - index),
			})),
		),
		openBlockers: [],
		openSubIssues: [],
		pullRequests: [],
		...overrides,
	}
}

export function claim(
	id: string,
	dispatch: string,
	at = minutesAgo(30),
	machine = "Minerva",
): string {
	return composeComment("claim", { id, machine, task: "task_x", dispatch, at }, "Claimed.")
}

export function release(claimId: string, reason: string): string {
	return composeComment("release", { claim: claimId, reason }, `Released: ${reason}.`)
}

export function result(claimId: string, pr = "45"): string {
	return composeComment("result", { claim: claimId, pr }, "## Done, check it")
}

export function decision(): string {
	return composeComment("decision", {}, "## Decision needed")
}

export function worker(overrides: Partial<Worker> = {}): Worker {
	return {
		dispatchId: "ctx_y",
		taskId: "task_y",
		terminalHandle: "term_y",
		workerState: "ready",
		terminalState: "active",
		activity: "working",
		verdict: "live",
		hostKind: "local",
		hostId: "local",
		worktreePath: "/work/12",
		...overrides,
	}
}

export function task(id: string, title: string, minutes = 30): Task {
	return { id, title, createdAt: new Date(NOW.getTime() - minutes * 60_000) }
}

export function input(overrides: Partial<ReconcileInput> = {}): ReconcileInput {
	return {
		issues: [],
		workers: [],
		tasks: [],
		worktrees: [],
		hosts: HOSTS,
		section: SECTION,
		login: "milkyskies",
		now: NOW,
		...overrides,
	}
}
