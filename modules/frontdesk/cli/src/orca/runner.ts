import { isRecord, parseJson, readBoolean, readField } from "../json.ts"

export type Orca = (args: readonly string[]) => Promise<unknown>

export class OrcaError extends Error {
	readonly args: readonly string[]

	constructor(args: readonly string[], detail: string) {
		super(`orca ${args.slice(0, 3).join(" ")} failed: ${detail.trim()}`)
		this.args = args
	}
}

function errorDetail(envelope: unknown): string {
	const error = readField(envelope, "error")
	const message = isRecord(error) ? error.message : undefined

	return typeof message === "string" ? message : "no error message"
}

export const spawnOrca: Orca = async (args) => {
	const child = Bun.spawn(["orca", ...args, "--json"], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	})
	const [stdout, stderr, status] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	])

	let envelope: unknown
	try {
		envelope = parseJson(stdout)
	} catch {
		throw new OrcaError(args, stderr || stdout || `exit ${status}`)
	}

	if (!isRecord(envelope)) throw new OrcaError(args, "the reply is not a JSON object")
	if (!readBoolean(envelope, "ok")) throw new OrcaError(args, errorDetail(envelope))

	return envelope.result
}
