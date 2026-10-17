#!/usr/bin/env bun
import { existsSync } from "node:fs"
import { join } from "node:path"

import type { BaseContext, Command, RepoFreeCommand } from "./context.ts"
import { DeskError, EXIT } from "./errors.ts"
import { type Gh, GhError, resolveRepo, spawnGh } from "./github/gh.ts"

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

type LoadedCommand = { kind: "repo"; run: Command } | { kind: "repo-free"; run: RepoFreeCommand }

function exportedFunction(loaded: unknown, key: string): unknown {
	return typeof loaded === "object" && loaded !== null && key in loaded
		? Reflect.get(loaded, key)
		: undefined
}

function isCommand(value: unknown): value is Command {
	return typeof value === "function"
}

async function loadCommand(name: string | undefined, directory: string): Promise<LoadedCommand> {
	if (name === undefined || !COMMAND_NAME.test(name)) {
		throw new DeskError(
			EXIT.usage,
			`desk: usage: desk <command> [flags]; got ${name ?? "no command"}`,
		)
	}

	const path = join(directory, `${name}.ts`)
	if (!existsSync(path)) throw new DeskError(EXIT.usage, `desk: unknown command "${name}"`)

	const loaded: unknown = await import(path)
	const repoFree = exportedFunction(loaded, "runWithoutRepo")
	if (isRepoFree(repoFree)) return { kind: "repo-free", run: repoFree }

	const run = exportedFunction(loaded, "run")
	if (isCommand(run)) return { kind: "repo", run }

	throw new DeskError(EXIT.usage, `desk: command "${name}" exports no run function`)
}

function isRepoFree(value: unknown): value is RepoFreeCommand {
	return typeof value === "function"
}

function isWrite(args: readonly string[]): boolean {
	if (args[0] === "issue") return ["edit", "create", "close"].includes(args[1] ?? "")

	const method = args[args.indexOf("-X") + 1]

	return args.includes("-X") && method !== undefined && method !== "GET"
}

const COMMANDS_DIRECTORY = join(import.meta.dir, "commands")

export async function main(
	argv: string[],
	baseGh: Gh = spawnGh,
	commandsDirectory: string = COMMANDS_DIRECTORY,
): Promise<number> {
	let wrote = false
	const gh: Gh = (args, input) => {
		if (isWrite(args)) wrote = true

		return baseGh(args, input)
	}

	const { repo: repoFlag, json, rest } = splitGlobals(argv)
	const [name, ...args] = rest

	try {
		const command = await loadCommand(name, commandsDirectory)
		const base: BaseContext = {
			gh,
			json,
			now: () => new Date(),
			newId: () => crypto.randomUUID().replaceAll("-", "").slice(0, 6),
			out: (line) => process.stdout.write(`${line}\n`),
			readText: (path) => Bun.file(path).text(),
			readBytes: async (path) => new Uint8Array(await Bun.file(path).arrayBuffer()),
		}

		if (command.kind === "repo-free") {
			await command.run(args, { ...base, resolveRepo: () => resolveRepo(gh, repoFlag) })
		} else {
			await command.run(args, { ...base, repo: await resolveRepo(gh, repoFlag) })
		}

		return 0
	} catch (error) {
		if (error instanceof DeskError) {
			process.stderr.write(`${error.message}\n`)

			return error.exitCode
		}

		if (error instanceof GhError) {
			process.stderr.write(`desk: ${name ?? ""}: ${error.message}\n`)

			return EXIT.external
		}

		const detail = error instanceof Error ? error.message : String(error)
		const code = wrote ? EXIT.mismatch : EXIT.external
		const note = wrote ? " (writes already made; read the issue before retrying)" : ""
		process.stderr.write(`desk: ${name ?? ""}: unexpected failure: ${detail}${note}\n`)

		return code
	}
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)))
