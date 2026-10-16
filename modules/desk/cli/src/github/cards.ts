import { AGENT_MARKER, formatMarker, parseMarker } from "./markers.ts"

const KIND_LINE = /^\*\*Kind:\*\*\s*(code-detail|design)\s*$/m
const CHECKED_LINE = /^\*\*Already checked:\*\*\s*\S/m
const NUMBERED_OPTION = /^\s*\d+\.\s+\S/gm
const OPTIONS_NOT_ENUMERABLE = /cannot be enumerated/i
const RECOMMENDATION_LINE = /^\*\*Recommendation:\*\*/m
const PICK_BLOCK = /<details>\s*<summary>What would I pick\?<\/summary>/

export function cardProblems(card: string): string[] {
	const problems: string[] = []

	if (parseMarker(card)?.kind !== "decision") {
		problems.push("the first line must be the decision marker `<!-- desk:decision -->`")
	}

	const kind = KIND_LINE.exec(card)?.[1]
	if (kind === undefined) {
		problems.push("missing a `**Kind:** code-detail` or `**Kind:** design` line")
	}

	if (!CHECKED_LINE.test(card)) problems.push("missing an `**Already checked:**` line")

	const optionCount = card.match(NUMBERED_OPTION)?.length ?? 0
	if (optionCount < 2 && !OPTIONS_NOT_ENUMERABLE.test(card)) {
		problems.push(
			"needs at least two numbered options, or a line saying the options cannot be enumerated",
		)
	}

	if (kind === "code-detail" && !RECOMMENDATION_LINE.test(card)) {
		problems.push("a code-detail card needs a `**Recommendation:**` line")
	}

	if (kind === "design") {
		if (RECOMMENDATION_LINE.test(card)) {
			problems.push("a design card must not carry a `**Recommendation:**` line")
		}
		if (!PICK_BLOCK.test(card)) {
			problems.push("a design card needs a `<details><summary>What would I pick?</summary>` block")
		}
	}

	return problems
}

export function canonicalCard(card: string, claimId: string): string {
	const rest = card
		.split("\n")
		.slice(1)
		.filter((line) => line.trim() !== AGENT_MARKER)
		.join("\n")
		.trim()

	return `${formatMarker("decision", { claim: claimId })}\n${rest}\n\n${AGENT_MARKER}\n`
}
