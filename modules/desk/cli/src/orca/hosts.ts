import { readArray, readField, readString } from "../json.ts"
import { type Orca, OrcaError } from "./runner.ts"

export type Host = { kind: "local" | "environment"; id: string; name: string }

export async function listHosts(orca: Orca): Promise<Host[]> {
	const result = await orca(["host", "list"])
	const hosts: Host[] = []

	for (const row of readArray(result, "hosts")) {
		const kind = readString(row, "kind")
		const id = readString(row, "id")
		if (kind === "local") {
			const machineName = readField(row, "machineName")
			hosts.push({
				kind: "local",
				id,
				name: typeof machineName === "string" ? machineName : readString(row, "name"),
			})
		} else if (kind === "environment") {
			hosts.push({ kind: "environment", id, name: readString(row, "name") })
		}
	}

	return hosts
}

export function machineOfHost(hosts: readonly Host[], hostKind: string, hostId: string): string {
	const match = hosts.find((host) => host.id === hostId)
	if (match) return match.name

	return hostKind === "local"
		? (hosts.find((host) => host.kind === "local")?.name ?? hostId)
		: hostId
}

export type Reachability = "reachable" | "unreachable" | "unknown"

async function runtimeReachable(orca: Orca, args: string[]): Promise<boolean> {
	const result = await orca(args)

	return readField(readField(result, "runtime"), "reachable") === true
}

export async function machineReachability(orca: Orca, environment: string): Promise<Reachability> {
	try {
		if (!(await runtimeReachable(orca, ["status"]))) return "unknown"
	} catch (error) {
		if (error instanceof OrcaError) return "unknown"

		throw error
	}

	try {
		return (await runtimeReachable(orca, ["status", "--environment", environment]))
			? "reachable"
			: "unreachable"
	} catch (error) {
		if (error instanceof OrcaError) return "unreachable"

		throw error
	}
}
