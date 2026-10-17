import type { IssueState } from "../github/issue.ts"
import type { WorktreeRow } from "../orca/cleanup.ts"
import type { Host } from "../orca/hosts.ts"
import type { Task } from "../orca/tasks.ts"
import type { Worker } from "../orca/workers.ts"
import type { DeskSection } from "../project/section.ts"

export const MISMATCH_CODES = [
	"dispatch",
	"intake",
	"escalate",
	"orphan-claim",
	"unclaimed-worker",
	"unrecorded-result",
	"parked-worker",
	"looks-good",
	"auto-land",
	"rejected",
	"conversation",
	"merged",
	"check-red",
	"stray-worker",
	"bad-labels",
	"human-claimed",
	"remote-claim-unseen",
] as const

export const STARTS_WORKER: readonly string[] = ["dispatch", "intake", "escalate"]

export type MismatchCode = (typeof MISMATCH_CODES)[number]

export type Mismatch = {
	issue: number
	code: MismatchCode
	detail: string
	claim?: string
	worker?: string
	machine?: string
	attempts?: number
	terminalGone?: boolean
	workerStart?: string[]
}

export type ReconcileInput = {
	issues: IssueState[]
	workers: Worker[]
	tasks: Task[]
	worktrees: WorktreeRow[]
	hosts: Host[]
	section: DeskSection
	now: Date
}
