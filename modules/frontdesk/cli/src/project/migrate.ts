const OLD_RULE_NAME = "autopilot.md"
const NEW_RULE_NAME = "frontdesk.md"
const OLD_RULE_PATH = "modules/autopilot/rules/autopilot.md"
const NEW_RULE_PATH = "modules/frontdesk/rules/frontdesk.md"
const OLD_MARKER = /<!-- autopilot:/g
const OLD_AGENT_MARKER = "<!-- autopilot:agent -->"

export type ManifestPlan = { text: string; changed: boolean }

export function planManifest(text: string): ManifestPlan {
	const lines = text.split("\n")
	const hasNewRule = lines.some((line) => line.split("\t")[0] === NEW_RULE_NAME)
	const rewritten: string[] = []
	let changed = false

	for (const line of lines) {
		const [name, path] = line.split("\t")
		if (name !== OLD_RULE_NAME || path !== OLD_RULE_PATH) {
			rewritten.push(line)
			continue
		}

		changed = true
		if (!hasNewRule) rewritten.push(`${NEW_RULE_NAME}\t${NEW_RULE_PATH}`)
	}

	return { text: rewritten.join("\n"), changed }
}

export function countOldMarkers(body: string): number {
	return body.match(OLD_MARKER)?.length ?? 0
}

export function rewriteMarkers(body: string): string {
	return body.replaceAll(OLD_MARKER, "<!-- frontdesk:")
}

export function isOldAgentComment(body: string): boolean {
	return body.includes(OLD_AGENT_MARKER)
}
