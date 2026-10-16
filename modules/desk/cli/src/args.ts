import { usageError } from "./errors.ts"

export function parseOrUsage<T>(command: string, parse: () => T): T {
	try {
		return parse()
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		throw usageError(command, detail)
	}
}

export function requireFlag(command: string, value: string | undefined, flag: string): string {
	if (value === undefined || value === "") throw usageError(command, `missing ${flag}`)

	return value
}

export function parseNumber(command: string, raw: string | undefined, what: string): number {
	const value = Number(raw)
	if (raw === undefined || !Number.isInteger(value) || value <= 0) {
		throw usageError(command, `${what} must be a positive whole number, got ${raw ?? "nothing"}`)
	}

	return value
}
