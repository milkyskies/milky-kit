import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, type Context, emit, isoDay, readInputFile } from "../context.ts"
import { refusal, usageError } from "../errors.ts"
import { sectionLines } from "../github/body.ts"
import { appendProgramLine } from "../github/body-edit.ts"
import {
	activeClaims,
	answeredCardIds,
	newestPark,
	type OpenCard,
	type ParsedComment,
} from "../github/derive.ts"
import { type IssueState, readIssue } from "../github/issue.ts"
import { AGENT_MARKER, formatMarker } from "../github/markers.ts"
import { moveStage, postComment, releaseClaims } from "../github/writes.ts"
import { requireStage, verifyClaimReleased, verifyStage } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("answer", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: {
				body: { type: "string" },
				decision: { type: "string" },
				card: { type: "string" },
			},
		}),
	)
	const number = parseNumber("answer", positionals[0], "the issue number")
	const bodyPath = requireFlag("answer", values.body, "--body")
	const decision = requireFlag("answer", values.decision, "--decision")

	const answer = await readInputFile("answer", context, bodyPath)
	if (answer.includes(AGENT_MARKER)) {
		throw usageError(
			"answer",
			`the answer must not carry ${AGENT_MARKER}, because it is the human's comment`,
		)
	}

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("answer", before, "stage:needs-you")

	const target = chooseCard(before, values.card)
	const posted = target === undefined ? undefined : answerTo(before.comments, target.id)
	if (posted !== undefined && posted.text !== answer.trim()) {
		throw refusal(
			"answer",
			number,
			`card ${target?.id} is already answered`,
			"an unanswered card",
			"answer one of the other open cards",
		)
	}

	const entry = `- ${isoDay(context.now())}: ${decision}`
	const alreadyAnswered =
		target === undefined ? answerAlreadyPosted(before, answer) : posted !== undefined

	if (!alreadyAnswered) await postComment(gh, repo, number, answerComment(target, answer))

	const decisionRecorded =
		alreadyAnswered &&
		sectionLines(before.body, "Decisions").some((line) => line.endsWith(`: ${decision}`))
	if (!decisionRecorded) await appendProgramLine(gh, repo, number, "answer", "Decisions", entry)

	const stillOpen = openCardIds(before, target)
	if (stillOpen.length > 0) {
		finishPartial(context, number, target, stillOpen, entry)

		return
	}

	const claims = activeClaims(before.comments)
	const next = claims[0]?.role === "frontman" ? "stage:intake" : "stage:ready"

	await releaseClaims(gh, repo, number, claims, "answered")

	await moveStage(gh, repo, number, "stage:needs-you", next)

	const after = await readIssue(gh, repo, number)
	verifyStage("answer", before, after, next)

	verifyClaimReleased("answer", before, after)

	emit(context, `#${number} → ${next} (answered)`, {
		issue: number,
		stage: next,
		decision: entry,
	})
}

function finishPartial(
	context: Context,
	number: number,
	target: OpenCard | undefined,
	stillOpen: string[],
	entry: string,
): void {
	const count = `${stillOpen.length} card${stillOpen.length === 1 ? "" : "s"} still open`
	emit(context, `#${number} card ${target?.id ?? ""} answered, ${count}: ${stillOpen.join(", ")}`, {
		issue: number,
		stage: "stage:needs-you",
		card: target?.id,
		open: stillOpen,
		decision: entry,
	})
}

function openCardIds(issue: IssueState, target: OpenCard | undefined): string[] {
	const answered = answeredCardIds(issue.comments)

	return newestPark(issue.comments)
		.filter((card) => !answered.has(card.id) && card.id !== target?.id)
		.map((card) => card.id)
}

function chooseCard(issue: IssueState, requested: string | undefined): OpenCard | undefined {
	const park = newestPark(issue.comments)
	const answered = answeredCardIds(issue.comments)

	if (requested !== undefined) {
		const card = park.find((candidate) => candidate.id === requested)
		if (card) return card

		throw refusal(
			"answer",
			issue.number,
			`the newest park holds no card ${requested}`,
			park.length === 0 ? "a parked card with an id" : `one of ${park.map((c) => c.id).join(", ")}`,
		)
	}

	const open = park.filter((card) => !answered.has(card.id))
	if (open.length <= 1) return open[0]

	throw refusal(
		"answer",
		issue.number,
		`${open.length} cards are open`,
		"--card naming one of them",
		`pass --card with one of ${open.map((card) => card.id).join(", ")}`,
	)
}

function answerTo(
	comments: readonly ParsedComment[],
	cardId: string,
): { text: string } | undefined {
	const posted = comments.find(
		(comment) => comment.marker?.kind === "answer" && comment.marker.attrs.card === cardId,
	)
	if (posted === undefined) return undefined

	return { text: posted.body.split("\n").slice(1).join("\n").trim() }
}

function answerComment(target: OpenCard | undefined, answer: string): string {
	if (target === undefined) return answer

	return `${formatMarker("answer", { card: target.id })}\n${answer.trim()}`
}

function answerAlreadyPosted(issue: IssueState, answer: string): boolean {
	const lastDecision = issue.comments.findLastIndex(
		(comment) => comment.marker?.kind === "decision",
	)
	const lastHuman = issue.comments.findLastIndex((comment) => !comment.agent)

	return lastHuman > lastDecision && issue.comments[lastHuman]?.body.trim() === answer.trim()
}
