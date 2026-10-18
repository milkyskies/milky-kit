const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/

function unquote(value: string): string {
	const quote = value[0]
	if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
		return value.slice(1, -1)
	}

	return value
}

export function parseEnvironmentFile(text: string): Record<string, string> {
	const values: Record<string, string> = {}

	for (const line of text.split("\n")) {
		if (line.trimStart().startsWith("#")) continue

		const match = ASSIGNMENT.exec(line)
		const key = match?.[1]
		const value = match?.[2]
		if (key === undefined || value === undefined) continue

		values[key] = unquote(value)
	}

	return values
}
