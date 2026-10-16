import { existsSync } from "node:fs"
import { join } from "node:path"

import type { Command, Context } from "./context.ts"
import { DeskError, EXIT } from "./errors.ts"
import { type Gh, GhError, resolveRepo, spawnGh } from "./github/gh.ts"
import { ShapeError } from "./json.ts"

const COMMAND_NAME = /^[a-z]+$/

type Globals = { repo: string | undefined; json: boolean; rest: string[] }

function splitGlobals(argv: string[]): Globals {
	const rest: string[] = []
	let repo: string | undefined
	let json = false

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		if (arg === undefined) continue

		if (arg === "--json") json = true
		else if (arg === "--repo") {
			repo = argv[index + 1]
			index += 1
		} else if (arg.startsWith("--repo=")) repo = arg.slice("--repo=".length)
		else rest.push(arg)
	}

	return { repo, json, rest }
}

function isCommand(value: unknown): value is Command {
	return typeof value === "function"
}

async function loadCommand(name: string | undefined): Promise<Command> {
	if (name === undefined || !COMMAND_NAME.test(name)) {
		throw new DeskError(
			EXIT.usage,
			`desk: usage: desk <command> [flags]; got ${name ?? "no command"}`,
		)
	}

	const path = join(import.meta.dir, "commands", `${name}.ts`)
	if (!existsSync(path)) throw new DeskError(EXIT.usage, `desk: unknown command "${name}"`)

	const loaded: unknown = await import(path)
	const run =
		typeof loaded === "object" && loaded !== null && "run" in loaded ? loaded.run : undefined
	if (!isCommand(run))
		throw new DeskError(EXIT.usage, `desk: command "${name}" exports no run function`)

	return run
}

export async function main(argv: string[], gh: Gh = spawnGh): Promise<number> {
	const { repo: repoFlag, json, rest } = splitGlobals(argv)
	const [name, ...args] = rest

	try {
		const command = await loadCommand(name)
		const context: Context = {
			gh,
			repo: await resolveRepo(gh, repoFlag),
			json,
			now: () => new Date(),
			newId: () => crypto.randomUUID().replaceAll("-", "").slice(0, 6),
			out: (line) => process.stdout.write(`${line}\n`),
			readText: (path) => Bun.file(path).text(),
			readBytes: async (path) => new Uint8Array(await Bun.file(path).arrayBuffer()),
		}

		await command(args, context)

		return 0
	} catch (error) {
		if (error instanceof DeskError) {
			process.stderr.write(`${error.message}\n`)

			return error.exitCode
		}

		if (error instanceof GhError || error instanceof ShapeError) {
			process.stderr.write(`desk: ${name ?? ""}: ${error.message}\n`)

			return EXIT.external
		}

		throw error
	}
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)))
