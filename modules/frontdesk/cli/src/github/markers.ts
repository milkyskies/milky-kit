export const AGENT_MARKER = "<!-- frontdesk:agent -->"
export const AGENT_LINE = "**Agent:**"

export type Marker = { kind: string; attrs: Record<string, string> }

const MARKER_LINE = /^<!-- frontdesk:([a-z-]+)((?: [a-z]+=\S+)*) -->\s*$/
const ATTRIBUTE = /([a-z]+)=(\S+)/g

export function formatMarker(kind: string, attrs: Record<string, string> = {}): string {
	const pairs = Object.entries(attrs).map(([key, value]) => {
		if (/\s/.test(value) || value === "") {
			throw new Error(`marker value for "${key}" must be non-empty and hold no spaces`)
		}

		return ` ${key}=${value}`
	})

	return `<!-- frontdesk:${kind}${pairs.join("")} -->`
}

export function parseMarker(body: string): Marker | undefined {
	const firstLine = body.split("\n", 1)[0] ?? ""
	const match = MARKER_LINE.exec(firstLine)
	if (!match) return undefined

	const kind = match[1]
	if (kind === undefined) return undefined

	const attrs: Record<string, string> = {}
	for (const pair of (match[2] ?? "").matchAll(ATTRIBUTE)) {
		const [, key, value] = pair
		if (key !== undefined && value !== undefined) attrs[key] = value
	}

	return { kind, attrs }
}

export function isAgentBody(body: string): boolean {
	return body.split("\n").some((line) => line.trim() === AGENT_MARKER)
}

export function composeComment(kind: string, attrs: Record<string, string>, text: string): string {
	return `${formatMarker(kind, attrs)}\n${AGENT_LINE}\n${text.trim()}\n\n${AGENT_MARKER}\n`
}

export function linesAfterMarker(body: string): string[] {
	return body
		.split("\n")
		.slice(1)
		.filter((line) => line.trim() !== AGENT_LINE)
}
