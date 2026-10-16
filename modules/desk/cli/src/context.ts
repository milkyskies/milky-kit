import { usageError } from "./errors.ts"
import type { Gh, Repo } from "./github/gh.ts"

export type Context = {
	gh: Gh
	repo: Repo
	json: boolean
	now: () => Date
	newId: () => string
	out: (line: string) => void
	readText: (path: string) => Promise<string>
	readBytes: (path: string) => Promise<Uint8Array>
}

export type Command = (args: string[], context: Context) => Promise<void>

export function emit(context: Context, text: string, data: Record<string, unknown>): void {
	context.out(context.json ? JSON.stringify(data) : text)
}

export async function readInputFile(
	command: string,
	context: Context,
	path: string,
): Promise<string> {
	try {
		return await context.readText(path)
	} catch {
		throw usageError(command, `cannot read file ${path}`)
	}
}

export function isoSeconds(date: Date): string {
	return `${date.toISOString().slice(0, 19)}Z`
}

export function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10)
}
