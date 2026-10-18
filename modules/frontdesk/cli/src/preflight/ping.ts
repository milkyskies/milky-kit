import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { isRecord, parseJson } from "../json.ts"
import type { CheckResult } from "./types.ts"

export const PING_INTERVAL_MS = 6 * 60 * 60 * 1000
export const PING_LIMIT = 200

export type PingTarget = { project: string; machine: string }

export function failedChecks(results: readonly CheckResult[]): CheckResult[] {
	return results.filter((result) => !result.ok)
}

export function composePingMessage(target: PingTarget, failures: readonly CheckResult[]): string {
	const fixes = [
		...new Set(failures.map((failure) => failure.fix).filter((fix) => fix !== undefined)),
	]
	const count = failures.length
	const message = `${target.project} on ${target.machine}: ${count} ${count === 1 ? "fix" : "fixes"} · ${fixes.join(" · ")}`

	return message.length <= PING_LIMIT ? message : `${message.slice(0, PING_LIMIT - 1)}…`
}

export function failureKey(machine: string, failures: readonly CheckResult[]): string {
	return `${machine}|${failures
		.map((failure) => failure.check)
		.sort()
		.join(",")}`
}

async function readRecord(path: string): Promise<Record<string, number>> {
	try {
		const parsed = parseJson(await readFile(path, "utf8"))
		if (!isRecord(parsed)) return {}

		return Object.fromEntries(
			Object.entries(parsed).filter(
				(entry): entry is [string, number] => typeof entry[1] === "number",
			),
		)
	} catch {
		return {}
	}
}

export async function pingedRecently(path: string, key: string, now: Date): Promise<boolean> {
	const sentAt = (await readRecord(path))[key]

	return sentAt !== undefined && now.getTime() - sentAt < PING_INTERVAL_MS
}

export async function recordPing(path: string, key: string, now: Date): Promise<void> {
	const record = await readRecord(path)
	const fresh = Object.entries(record).filter(
		([, sentAt]) => now.getTime() - sentAt < PING_INTERVAL_MS,
	)

	await mkdir(dirname(path), { recursive: true })
	await writeFile(
		path,
		`${JSON.stringify({ ...Object.fromEntries(fresh), [key]: now.getTime() })}\n`,
	)
}

export type PingSender = (message: string) => Promise<void>

export function frontdeskPingSender(slug: string | undefined): PingSender {
	return async (message) => {
		const main = new URL("../main.ts", import.meta.url).pathname
		const child = Bun.spawn(
			[process.execPath, main, "ping", message, ...(slug ? ["--repo", slug] : [])],
			{
				stdout: "pipe",
				stderr: "pipe",
			},
		)

		const [stderr, status] = await Promise.all([new Response(child.stderr).text(), child.exited])
		if (status !== 0) throw new Error(stderr.trim() || `frontdesk ping exited ${status}`)
	}
}
