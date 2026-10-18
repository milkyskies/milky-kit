import type { ParsedComment } from "./derive.ts"
import { linesAfterMarker } from "./markers.ts"

export type ParsedResult = {
	pr: number | undefined
	summary: string
	pictures: string[]
	noPicture: string | undefined
	see: string | undefined
	decisionsUsed: string[]
	workerSays: string | undefined
	proposedRequests: number[]
}

const PICTURE = /!\[picture\]\((\S+)\)/g
const LABELLED_LINE = /^\*\*([^*]+):\*\*\s*(.*)$/

function labelled(lines: readonly string[], label: string): string | undefined {
	for (const line of lines) {
		const match = LABELLED_LINE.exec(line)
		if (match?.[1] === label) return match[2]?.trim()
	}

	return undefined
}

function decisionLines(lines: readonly string[]): string[] {
	const start = lines.findIndex((line) => line.startsWith("**Decisions used:**"))
	if (start === -1) return []

	const following = lines.slice(start + 1)
	const end = following.findIndex((line) => line.startsWith("**"))

	return (end === -1 ? following : following.slice(0, end)).filter((line) => line.startsWith("- "))
}

export function parseResult(comment: ParsedComment): ParsedResult | undefined {
	if (comment.marker?.kind !== "result") return undefined

	const lines = linesAfterMarker(comment.body)
	const heading = lines.findIndex((line) => line.startsWith("## "))
	const afterHeading = lines.slice(heading + 1)
	const summary = afterHeading.find((line) => line.trim() !== "")?.trim() ?? ""
	const pr = Number(comment.marker.attrs.pr)
	const proposed = labelled(lines, "Proposed requests") ?? ""

	return {
		pr: Number.isInteger(pr) ? pr : undefined,
		summary,
		pictures: [...comment.body.matchAll(PICTURE)].flatMap((match) => (match[1] ? [match[1]] : [])),
		noPicture: lines.find((line) => line.startsWith("No picture: "))?.slice("No picture: ".length),
		see: labelled(lines, "See it yourself"),
		decisionsUsed: decisionLines(lines),
		workerSays: labelled(lines, "Worker says"),
		proposedRequests: [...proposed.matchAll(/#(\d+)/g)].map((match) => Number(match[1])),
	}
}
