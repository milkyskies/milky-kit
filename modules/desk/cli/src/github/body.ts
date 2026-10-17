function headingPattern(heading: string): RegExp {
	return new RegExp(`^## ${heading}\\s*$`, "m")
}

function sectionBounds(body: string, heading: string): { start: number; end: number } | undefined {
	const match = headingPattern(heading).exec(body)
	if (!match) return undefined

	const start = match.index + match[0].length
	const next = /^## /m.exec(body.slice(start))
	const end = next ? start + next.index : body.length

	return { start, end }
}

export function sectionLines(body: string, heading: string): string[] {
	const bounds = sectionBounds(body, heading)
	if (!bounds) return []

	return body
		.slice(bounds.start, bounds.end)
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.trim() !== "")
}

export function sectionText(body: string, heading: string): string | undefined {
	const bounds = sectionBounds(body, heading)

	return bounds ? body.slice(bounds.start, bounds.end).trim() : undefined
}

export function bodyRewriteProblems(oldBody: string, newBody: string): string[] {
	const kept = sectionText(oldBody, "Your words") === undefined ? "Problem" : "Your words"
	const original = sectionText(oldBody, kept)
	const problems =
		original !== undefined && sectionText(newBody, kept) !== original
			? [`## ${kept} must stay byte for byte`]
			: []

	return [
		...problems,
		...lostProgramLines(oldBody, newBody).map((line) => `dropped the line "${line}"`),
	]
}

export function appendToSection(body: string, heading: string, line: string): string {
	const bounds = sectionBounds(body, heading)
	if (!bounds) {
		const trimmed = body.trimEnd()
		const separator = trimmed === "" ? "" : "\n\n"

		return `${trimmed}${separator}## ${heading}\n\n${line}\n`
	}

	const before = body.slice(0, bounds.end).trimEnd()
	const after = body.slice(bounds.end)
	const gap = after === "" ? "\n" : "\n\n"

	return `${before}\n${line}${gap}${after}`
}

export function lostProgramLines(freshBody: string, afterBody: string): string[] {
	const kept = new Set([
		...sectionLines(afterBody, "Small calls"),
		...sectionLines(afterBody, "Decisions"),
	])

	return [
		...sectionLines(freshBody, "Small calls"),
		...sectionLines(freshBody, "Decisions"),
	].filter((line) => !kept.has(line))
}
