import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { refusal, usageError } from "../errors.ts"
import { activeClaims, FRONTMAN_ROLE } from "../github/derive.ts"
import { readIssue } from "../github/issue.ts"
import { editLabels, releaseClaims } from "../github/writes.ts"
import { requireOwnedClaim, requireStage, verifyClaimReleased, verifyStage } from "../guards.ts"

const POINTS = [1, 2, 3, 5, 8, 13]

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("ready", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { dispatch: { type: "string" }, points: { type: "string" } },
		}),
	)
	const number = parseNumber("ready", positionals[0], "the issue number")
	const dispatch = requireFlag("ready", values.dispatch, "--dispatch")
	const points = Number(requireFlag("ready", values.points, "--points"))
	if (!POINTS.includes(points)) {
		throw usageError("ready", `--points must be one of ${POINTS.join(", ")}, got ${values.points}`)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("ready", before, "stage:working")
	const claim = requireOwnedClaim("ready", before, dispatch)
	if (claim.role !== FRONTMAN_ROLE) {
		throw refusal(
			"ready",
			number,
			`claim ${claim.id} is a builder's`,
			"a frontman's claim",
			"a builder ends with desk done, desk park or desk fail",
		)
	}

	await releaseClaims(gh, repo, number, activeClaims(before.comments), "ready")

	const stalePoints = before.labels.filter((label) => label.startsWith("points:"))
	await editLabels(gh, repo, number, {
		add: ["autopilot", `points:${points}`, "stage:ready"],
		remove: ["stage:working", ...stalePoints],
	})

	const after = await readIssue(gh, repo, number)
	verifyStage("ready", before, after, "stage:ready")
	verifyClaimReleased("ready", before, after)

	emit(context, `#${number} → stage:ready (${points} points)`, {
		issue: number,
		stage: "stage:ready",
		points,
	})
}
