import { readFile } from "node:fs/promises"
import { hostname } from "node:os"
import { join } from "node:path"

import { isRecord, parseJson, readBoolean, readField, readString } from "../json.ts"
import { parseFrontdeskSection, type SectionResult } from "../project/section.ts"
import type { PreflightEnvironment } from "./types.ts"

export const PROJECT_FILE = "CLAUDE.md"

export type OrcaStatus = { reachable: boolean; sessionId: string | undefined }

export type HostEntry = { kind: string; name: string; machineName: string | undefined }

export type McpServers =
	| { kind: "listed"; connected: Set<string> }
	| { kind: "failed"; detail: string }

export type Facts = {
	section: () => Promise<SectionResult>
	mcpServers: () => Promise<McpServers>
	hosts: () => Promise<HostEntry[] | undefined>
	localMachineName: () => Promise<string>
	statusOf: (environmentName?: string) => Promise<OrcaStatus | undefined>
}

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
	let pending: Promise<T> | undefined

	return () => {
		pending ??= load()

		return pending
	}
}

export function parseMcpList(output: string): Set<string> {
	const connected = new Set<string>()

	for (const line of output.split("\n")) {
		const name = /^(.+?):\s/.exec(line)?.[1]
		if (name !== undefined && line.includes("Connected")) connected.add(name)
	}

	return connected
}

export function parseOrcaStatus(raw: string): OrcaStatus | undefined {
	try {
		const parsed = parseJson(raw)
		const result = readField(parsed, "result")
		const reachable = readBoolean(readField(result, "runtime"), "reachable")
		const caller = readField(result, "caller") ?? readField(parsed, "caller")
		const sessionId =
			isRecord(caller) && typeof caller.orcaSessionId === "string"
				? caller.orcaSessionId
				: undefined

		return { reachable, sessionId }
	} catch {
		return undefined
	}
}

export function parseHostList(raw: string): HostEntry[] | undefined {
	try {
		const hosts = readField(readField(parseJson(raw), "result"), "hosts")
		if (!Array.isArray(hosts)) return undefined

		return hosts.map((host) => ({
			kind: readString(host, "kind"),
			name: readString(host, "name"),
			machineName:
				typeof readField(host, "machineName") === "string"
					? readString(host, "machineName")
					: undefined,
		}))
	} catch {
		return undefined
	}
}

export function createFacts(environment: PreflightEnvironment): Facts {
	const { run } = environment

	const section = memoize(async (): Promise<SectionResult> => {
		try {
			return parseFrontdeskSection(
				await readFile(join(environment.projectRoot, PROJECT_FILE), "utf8"),
			)
		} catch {
			return { kind: "missing" }
		}
	})

	const mcpServers = memoize(async (): Promise<McpServers> => {
		const result = await run("claude", ["mcp", "list"])
		if (result.status !== 0) {
			return {
				kind: "failed",
				detail: result.stderr.trim() || `claude mcp list exited ${result.status}`,
			}
		}

		return { kind: "listed", connected: parseMcpList(result.stdout) }
	})

	const hosts = memoize(async () => {
		const result = await run("orca", ["host", "list", "--json"])

		return result.status === 0 ? parseHostList(result.stdout) : undefined
	})

	const localMachineName = memoize(async () => {
		const local = (await hosts())?.find((host) => host.kind === "local")
		if (local?.machineName) return local.machineName

		return hostname().split(".")[0] ?? hostname()
	})

	const statuses = new Map<string, Promise<OrcaStatus | undefined>>()
	const statusOf = (environmentName?: string) => {
		const key = environmentName ?? ""
		const known = statuses.get(key)
		if (known) return known

		const args = [
			"status",
			...(environmentName ? ["--environment", environmentName] : []),
			"--json",
		]
		const pending = run("orca", args).then((result) =>
			result.status === 0 ? parseOrcaStatus(result.stdout) : undefined,
		)
		statuses.set(key, pending)

		return pending
	}

	return { section, mcpServers, hosts, localMachineName, statusOf }
}
