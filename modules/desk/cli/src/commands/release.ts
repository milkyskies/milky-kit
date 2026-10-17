import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { mismatch, refusal, usageError } from "../errors.ts"
import { activeClaims, owningClaim, returnStage } from "../github/derive.ts"
import { hasStage, readIssue } from "../github/issue.ts"
import { moveStage, releaseClaims } from "../github/writes.ts"
import { describeState, requireStage, verifyStage } from "../guards.ts"

const REASONS = ["silent-machine", "no-worker", "stopped", "lost-race"]

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("release", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: { reason: { type: "string" }, claim: { type: "string" } },
		}),
	)
	const number = parseNumber("release", positionals[0], "the issue number")
	const reason = requireFlag("release", values.reason, "--reason")
	if (!REASONS.includes(reason)) {
		throw usageError("release", `--reason must be one of ${REASONS.join(", ")}, got ${reason}`)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)
	const active = activeClaims(before.comments)

	const target =
		values.claim === undefined
			? requireWorkingClaim(before, number)
			: active.find((claim) => claim.id === values.claim)
	if (!target) {
		throw refusal(
			"release",
			number,
			`claim ${values.claim} is not an unreleased claim (${describeState(before)})`,
			"an unreleased claim",
		)
	}

	const laterClaims = target.id === active[0]?.id ? active.slice(1) : []

	await releaseClaims(gh, repo, number, [target], reason)
	await releaseClaims(gh, repo, number, laterClaims, "lost-race")

	const remaining = active.filter(
		(claim) => claim.id !== target.id && !laterClaims.some((later) => later.id === claim.id),
	)
	const returnsToReady = hasStage(before, "stage:working") && remaining.length === 0
	const next = returnStage(target)
	if (returnsToReady) await moveStage(gh, repo, number, "stage:working", next)

	const after = await readIssue(gh, repo, number)
	if (
		activeClaims(after.comments).some((claim) =>
			[target, ...laterClaims].some((closed) => closed.id === claim.id),
		)
	) {
		throw mismatch(
			"release",
			number,
			describeState(before),
			describeState(after),
			`claim ${target.id} released`,
		)
	}
	if (returnsToReady) verifyStage("release", before, after, next)

	emit(context, `#${number} released ${target.id}: ${reason}`, {
		issue: number,
		stage: returnsToReady ? next : describeState(after),
		claim: target.id,
		reason,
	})
}

function requireWorkingClaim(issue: Parameters<typeof describeState>[0], number: number) {
	requireStage("release", issue, "stage:working")

	const claim = owningClaim(issue.comments)
	if (!claim) {
		throw refusal(
			"release",
			number,
			`there is no claim to release (${describeState(issue)})`,
			"an owning claim",
		)
	}

	return claim
}
