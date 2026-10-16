import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename } from "node:path"
import { parseArgs } from "node:util"

import { parseOrUsage, requireFlag } from "../args.ts"
import type { RepoFreeCommand, RepoFreeContext } from "../context.ts"
import { DeskError, EXIT, usageError } from "../errors.ts"
import { type Repo, repoSlug } from "../github/gh.ts"
import { createFacts } from "../preflight/facts.ts"
import {
	composePingMessage,
	deskPingSender,
	failedChecks,
	failureKey,
	type PingSender,
	pingedRecently,
	recordPing,
} from "../preflight/ping.ts"
import { formatResult, runChecks, toJson } from "../preflight/run.ts"
import { spawnRunner } from "../preflight/runner.ts"
import type { PreflightEnvironment, Role, Runner } from "../preflight/types.ts"
import { parseEnvironmentFile } from "../project/environment-file.ts"
import { processIsAlive } from "../project/lock.ts"
import { preflightPingRecordPath, userEnvironmentPath } from "../project/paths.ts"

export type PreflightDependencies = {
	run: Runner
	home: string
	cwd: string
	processVariables: Record<string, string | undefined>
	startPid: number
	isAlive: (pid: number) => boolean
	sendPing: (slug: string | undefined) => PingSender
}

function realDependencies(): PreflightDependencies {
	return {
		run: spawnRunner,
		home: homedir(),
		cwd: process.cwd(),
		processVariables: process.env,
		startPid: process.pid,
		isAlive: processIsAlive,
		sendPing: deskPingSender,
	}
}

function parseRole(value: string | undefined): Role {
	const role = requireFlag("preflight", value, "--role")
	if (role === "coordinator" || role === "worker") return role

	throw usageError("preflight", `--role must be coordinator or worker, got ${role}`)
}

async function userVariables(home: string): Promise<Record<string, string>> {
	try {
		return parseEnvironmentFile(await readFile(userEnvironmentPath(home), "utf8"))
	} catch {
		return {}
	}
}

async function projectRootOf(dependencies: PreflightDependencies): Promise<string> {
	const result = await dependencies.run("git", ["rev-parse", "--show-toplevel"], {
		cwd: dependencies.cwd,
	})

	return result.status === 0 ? result.stdout.trim() : dependencies.cwd
}

export async function runPreflight(
	args: string[],
	context: RepoFreeContext,
	dependencies: PreflightDependencies,
): Promise<void> {
	const { values } = parseOrUsage("preflight", () =>
		parseArgs({
			args,
			options: { role: { type: "string" }, ping: { type: "boolean" } },
		}),
	)
	const role = parseRole(values.role)

	const resolved = await resolveOrExplain(context)

	const environment: PreflightEnvironment = {
		role,
		run: dependencies.run,
		repo: resolved.repo,
		repositoryError: resolved.error,
		home: dependencies.home,
		projectRoot: await projectRootOf(dependencies),
		variables: { ...(await userVariables(dependencies.home)), ...dependencies.processVariables },
		startPid: dependencies.startPid,
		isAlive: dependencies.isAlive,
		now: context.now,
	}

	const results = await runChecks(environment)
	const failures = failedChecks(results)

	if (context.json) context.out(JSON.stringify(toJson(results)))
	else for (const result of results) context.out(formatResult(result))

	if (failures.length === 0) return

	if (values.ping) await pingOnce(context, dependencies, environment, failures)

	const names = failures.map((failure) => failure.check).join(", ")
	throw new DeskError(
		EXIT.refused,
		`desk: preflight --role ${role} failed ${failures.length} ${failures.length === 1 ? "check" : "checks"}: ${names}`,
	)
}

async function resolveOrExplain(
	context: RepoFreeContext,
): Promise<{ repo: Repo | undefined; error: string | undefined }> {
	try {
		return { repo: await context.resolveRepo(), error: undefined }
	} catch (error) {
		return { repo: undefined, error: error instanceof Error ? error.message : String(error) }
	}
}

async function pingOnce(
	context: RepoFreeContext,
	dependencies: PreflightDependencies,
	environment: PreflightEnvironment,
	failures: ReturnType<typeof failedChecks>,
): Promise<void> {
	const machine = await createFacts(environment).localMachineName()
	const key = failureKey(machine, failures)
	const repo = environment.repo ?? { owner: "unknown", name: basename(environment.projectRoot) }
	const recordPath = preflightPingRecordPath(environment.home, repo)
	const now = context.now()

	if (await pingedRecently(recordPath, key, now)) return

	const message = composePingMessage({ project: repo.name, machine }, failures)

	try {
		await dependencies.sendPing(environment.repo && repoSlug(environment.repo))(message)
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		process.stderr.write(`desk: preflight: the ping was not sent: ${detail}\n`)

		return
	}

	await recordPing(recordPath, key, now)
}

export const runWithoutRepo: RepoFreeCommand = (args, context) =>
	runPreflight(args, context, realDependencies())
