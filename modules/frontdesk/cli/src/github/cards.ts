import { AGENT_MARKER, formatMarker, parseMarker } from "./markers.ts"

const KIND_LINE = /^\*\*Kind:\*\*\s*(code-detail|design)\s*$/m
const CHECKED_LINE = /^\*\*Already checked:\*\*\s*\S/m
const OPTIONS_HEADING = /^\*\*Proposals:\*\*/
const SECTION_END = /^(\*\*|_Stopped|<details>)/
const OPTION_START = /^\s*\d+\.\s+\S/
const SAY_BACK = /→[ \t]*(\S.*)$/m
const OPTIONS_NOT_ENUMERABLE = /cannot be enumerated/i
const RECOMMENDATION_LINE = /^\*\*Recommendation:\*\*/m
const PICK_BLOCK = /<details>\s*<summary>What would I pick\?<\/summary>/

function optionLines(card: string): string[] {
	const lines = card.split("\n")
	const start = lines.findIndex((line) => OPTIONS_HEADING.test(line))
	if (start === -1) return lines

	const rest = lines.slice(start + 1)
	const end = rest.findIndex((line) => SECTION_END.test(line))

	return end === -1 ? rest : rest.slice(0, end)
}

function optionBlocks(card: string): string[] {
	const blocks: string[] = []
	let current: string[] | undefined

	for (const line of optionLines(card)) {
		if (OPTION_START.test(line)) {
			if (current) blocks.push(current.join("\n"))
			current = [line]
		} else if (line.trim() === "") {
			if (current) blocks.push(current.join("\n"))
			current = undefined
		} else {
			current?.push(line)
		}
	}

	if (current) blocks.push(current.join("\n"))

	return blocks
}

export function sayBackLines(card: string): string[] {
	return optionBlocks(card).flatMap((block) => {
		const line = SAY_BACK.exec(block)?.[1]?.trim()

		return line === undefined || line === "" ? [] : [line]
	})
}

export function cardProblems(card: string): string[] {
	const problems: string[] = []

	if (parseMarker(card)?.kind !== "decision") {
		problems.push("the first line must be the decision marker `<!-- frontdesk:decision -->`")
	}

	const kind = KIND_LINE.exec(card)?.[1]
	if (kind === undefined) {
		problems.push("missing a `**Kind:** code-detail` or `**Kind:** design` line")
	}

	if (!CHECKED_LINE.test(card)) problems.push("missing an `**Already checked:**` line")

	const blocks = optionBlocks(card)
	if (blocks.length < 2 && !OPTIONS_NOT_ENUMERABLE.test(card)) {
		problems.push(
			"needs at least two numbered options, or a line saying the options cannot be enumerated",
		)
	}

	if (!OPTIONS_NOT_ENUMERABLE.test(card)) {
		blocks.forEach((block, index) => {
			if (!SAY_BACK.test(block)) {
				problems.push(
					`option ${index + 1} needs a say-back line after its consequence: \`→ <the answer said back in one line>\``,
				)
			}
		})
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

export function cardIdFor(claimId: string, position: number): string {
	return `${claimId}-${position}`
}

export function canonicalCard(card: string, claimId: string, position: number): string {
	const rest = card
		.split("\n")
		.slice(1)
		.filter((line) => line.trim() !== AGENT_MARKER)
		.join("\n")
		.trim()

	return `${formatMarker("decision", { claim: claimId, card: cardIdFor(claimId, position) })}\n${rest}\n\n${AGENT_MARKER}\n`
}
