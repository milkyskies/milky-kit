import type { IssueState } from "../github/issue.ts"
import type { Host } from "../orca/hosts.ts"
import type { Task } from "../orca/tasks.ts"
import type { Worker } from "../orca/workers.ts"
import type { DeskSection } from "../project/section.ts"

export const MISMATCH_CODES = [
	"dispatch",
	"escalate",
	"orphan-claim",
	"unclaimed-worker",
	"unrecorded-result",
	"parked-worker",
	"looks-good",
	"rejected",
	"conversation",
	"merged",
	"check-red",
	"stray-worker",
	"bad-labels",
	"human-claimed",
] as const

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
}

export type ReconcileInput = {
	issues: IssueState[]
	workers: Worker[]
	tasks: Task[]
	hosts: Host[]
	section: DeskSection
	now: Date
}
