import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export type Ledger = {
	read: (name: string) => Promise<unknown>
	write: (name: string, value: unknown) => Promise<void>
}

export function fileLedger(directory: string): Ledger {
	return {
		read: async (name) => {
			try {
				return JSON.parse(await readFile(join(directory, name), "utf8"))
			} catch {
				return undefined
			}
		},
		write: async (name, value) => {
			const path = join(directory, name)
			await mkdir(dirname(path), { recursive: true })
			await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
		},
	}
}

export function memoryLedger(): Ledger & { files: Map<string, unknown> } {
	const files = new Map<string, unknown>()

	return {
		files,
		read: async (name) => files.get(name),
		write: async (name, value) => {
			files.set(name, JSON.parse(JSON.stringify(value)))
		},
	}
}

export function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
}
