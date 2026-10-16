import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit, readInputFile } from "../context.ts"
import { refusal } from "../errors.ts"
import { canonicalCard, cardProblems } from "../github/cards.ts"
import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { moveStage, postComment } from "../github/writes.ts"
import { requireOwnedClaim, requireStage, verifyCommentCount, verifyStage } from "../guards.ts"

export const run: Command = async (args, context) => {
	const { values, positionals } = parseOrUsage("park", () =>
		parseArgs({
			args,
			allowPositionals: true,
			options: {
				dispatch: { type: "string" },
				card: { type: "string", multiple: true },
				"proposed-body": { type: "string" },
			},
		}),
	)
	const number = parseNumber("park", positionals[0], "the issue number")
	const dispatch = requireFlag("park", values.dispatch, "--dispatch")
	const cardPaths = values.card ?? []
	if (cardPaths.length === 0) requireFlag("park", undefined, "--card")

	const { gh, repo } = context
	const before = await readIssue(gh, repo, number)

	requireStage("park", before, "stage:working")
	const claim = requireOwnedClaim("park", before, dispatch)

	const cards = await Promise.all(cardPaths.map((path) => readInputFile("park", context, path)))
	const rejected = cards.flatMap((card, index) =>
		cardProblems(card).map((problem) => `${cardPaths[index]}: ${problem}`),
	)
	if (rejected.length > 0) {
		throw refusal(
			"park",
			number,
			`invalid card: ${rejected.join("; ")}`,
			"a card that follows the cards rule",
		)
	}

	const proposedBodyPath = values["proposed-body"]
	const proposedBody =
		proposedBodyPath === undefined
			? undefined
			: await readInputFile("park", context, proposedBodyPath)

	for (const card of cards) {
		await postComment(gh, repo, number, canonicalCard(card, claim.id))
	}

	if (proposedBody !== undefined) {
		await postComment(
			gh,
			repo,
			number,
			composeComment("proposed-body", { claim: claim.id }, proposedBody),
		)
	}

	await moveStage(gh, repo, number, "stage:working", "stage:needs-you")

	const after = await readIssue(gh, repo, number)
	verifyCommentCount("park", before, after, cards.length + (proposedBody === undefined ? 0 : 1))
	verifyStage("park", before, after, "stage:needs-you")

	emit(
		context,
		`#${number} → stage:needs-you (${cards.length} card${cards.length === 1 ? "" : "s"})`,
		{
			issue: number,
			stage: "stage:needs-you",
			cards: cards.length,
		},
	)
}
