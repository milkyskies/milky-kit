import { readFile } from "node:fs/promises"
import { homedir } from "node:os"

import { userEnvironmentPath } from "../project/paths.ts"

export type Environment = Record<string, string | undefined>

export type NtfySettings = { url: string; topic: string; token: string | undefined }

export function parseEnvFile(text: string): Record<string, string> {
	const values: Record<string, string> = {}

	for (const line of text.split("\n")) {
		const trimmed = line.trim()
		if (trimmed === "" || trimmed.startsWith("#")) continue

		const separator = trimmed.indexOf("=")
		if (separator === -1) continue

		const key = trimmed.slice(0, separator).trim()
		const value = trimmed
			.slice(separator + 1)
			.trim()
			.replace(/^(["'])(.*)\1$/, "$2")
		if (key !== "" && value !== "") values[key] = value
	}

	return values
}

export async function loadUserEnvironment(
	home: string = homedir(),
	processEnvironment: Environment = process.env,
): Promise<Environment> {
	let fromFile: Record<string, string> = {}

	try {
		fromFile = parseEnvFile(await readFile(userEnvironmentPath(home), "utf8"))
	} catch {
		fromFile = {}
	}

	return { ...fromFile, ...processEnvironment }
}

export function ntfySettings(environment: Environment): NtfySettings | undefined {
	const url = environment.FRONTDESK_NTFY_URL
	const topic = environment.FRONTDESK_NTFY_TOPIC
	if (!url || !topic) return undefined

	return {
		url: url.replace(/\/+$/, ""),
		topic,
		token: environment.FRONTDESK_NTFY_TOKEN || undefined,
	}
}
