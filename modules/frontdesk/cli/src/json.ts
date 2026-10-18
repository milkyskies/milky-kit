export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

export class ShapeError extends Error {}

export function readField(value: unknown, key: string): unknown {
	if (!isRecord(value)) throw new ShapeError(`expected an object holding "${key}"`)

	return value[key]
}

export function readString(value: unknown, key: string): string {
	const field = readField(value, key)
	if (typeof field !== "string") throw new ShapeError(`"${key}" is not a string`)

	return field
}

export function readNumber(value: unknown, key: string): number {
	const field = readField(value, key)
	if (typeof field !== "number") throw new ShapeError(`"${key}" is not a number`)

	return field
}

export function readBoolean(value: unknown, key: string): boolean {
	const field = readField(value, key)
	if (typeof field !== "boolean") throw new ShapeError(`"${key}" is not a boolean`)

	return field
}

export function readArray(value: unknown, key: string): unknown[] {
	const field = readField(value, key)
	if (!Array.isArray(field)) throw new ShapeError(`"${key}" is not an array`)

	return field
}

export function parseJson(text: string): unknown {
	try {
		return JSON.parse(text)
	} catch {
		throw new ShapeError(`expected JSON, got "${text.trim().slice(0, 80)}"`)
	}
}
