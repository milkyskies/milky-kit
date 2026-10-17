import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, isoSeconds } from "../context.ts"
import { mismatch, refusal, usageError } from "../errors.ts"
import { activeClaims, owningClaim } from "../github/derive.ts"
import { hasStage, type IssueState, readIssue, stageText } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { moveStage, postComment } from "../github/writes.ts"
import { describeState, requireStage } from "../guards.ts"

const FRONTMAN = "frontman"

function requireFrontmanEligible(issue: IssueState): void {
	if (!issue.labels.includes("request")) {
		throw refusal("claim", issue.number, "the issue has no request label", "a request")
	}

	if (issue.labels.includes("proposed")) {
		throw refusal(
			"claim",
			issue.number,
			"the request is a proposal Milky has not accepted",
			"no proposed label",
			"run desk accept first",
		)
	}
}

function requireBuilderEligible(issue: IssueState): void {
	const number = issue.number

	if (!issue.labels.includes("autopilot")) {
		throw refusal("claim", number, "the issue has no autopilot label", "the autopilot label")
	}

	if (issue.openBlockers.length > 0) {
		throw refusal(
			"claim",
			number,
			`blocked by open #${issue.openBlockers.join(", #")}`,
			"no open blocker",
		)
	}

	if (issue.openSubIssues.length > 0) {
		throw refusal(
			"claim",
			number,
			`open sub-issues #${issue.openSubIssues.join(", #")}`,
			"no open sub-issue (claim a sub-issue instead)",
		)
	}
}

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("claim", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: {
				machine: { type: "string" },
				task: { type: "string" },
				dispatch: { type: "string" },
				role: { type: "string" },
			},
		}),
	)
	const number = parseNumber("claim", positionals[0], "the issue number")
	const machine = requireFlag("claim", values.machine, "--machine")
	const task = requireFlag("claim", values.task, "--task")
	const dispatch = requireFlag("claim", values.dispatch, "--dispatch")

	const role = values.role
	if (role !== undefined && role !== FRONTMAN) {
		throw usageError("claim", `--role must be ${FRONTMAN}, got ${role}`)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	const from = role === FRONTMAN ? "stage:intake" : "stage:ready"
	requireStage("claim", before, from)

	if (role === FRONTMAN) requireFrontmanEligible(before)
	else requireBuilderEligible(before)

	if (activeClaims(before.comments).length > 0) {
		throw refusal(
			"claim",
			number,
			`an unreleased claim exists: ${describeState(before)}`,
			"no newest claim",
		)
	}

	const id = `c_${context.newId()}`
	const comment = composeComment(
		"claim",
		{ id, machine, task, dispatch, at: isoSeconds(context.now()), ...(role ? { role } : {}) },
		`Claimed by a worker on **${machine}** (Orca task \`${task}\`, dispatch \`${dispatch}\`).`,
	)

	await postComment(gh, repo, number, comment)
	await moveStage(gh, repo, number, from, "stage:working", true)

	const after = await readIssue(gh, repo, number)
	const winner = owningClaim(after.comments)

	if (winner?.id !== id) {
		const mine = activeClaims(after.comments).some((claim) => claim.id === id)
		if (!mine)
			throw mismatch(
				"claim",
				number,
				stageText(before),
				`no claim ${id} on the issue`,
				`claim ${id}`,
			)

		await postComment(
			gh,
			repo,
			number,
			composeComment(
				"release",
				{ claim: id, reason: "lost-race" },
				`Lost the claim race to ${winner?.id ?? "another worker"}.`,
			),
		)

		throw refusal(
			"claim",
			number,
			`lost the race to ${winner ? winner.id : "another claim"}`,
			`claim ${id} to be earliest`,
		)
	}

	if (!hasStage(after, "stage:working")) {
		throw mismatch("claim", number, describeState(before), describeState(after), "stage:working")
	}

	emit(context, id, { claim: id, issue: number, stage: "stage:working" })
}
