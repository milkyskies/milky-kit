import type { Repo } from "../github/gh.ts"

export type Role = "coordinator" | "worker"

export type RunResult = { status: number; stdout: string; stderr: string }

export type Runner = (
	command: string,
	args: readonly string[],
	options?: { cwd?: string },
) => Promise<RunResult>

export type CheckResult = {
	check: string
	ok: boolean
	detail: string
	fix: string | undefined
	skipped: boolean
}

export type PreflightEnvironment = {
	role: Role
	run: Runner
	repo: Repo | undefined
	repositoryError: string | undefined
	home: string
	projectRoot: string
	variables: Record<string, string | undefined>
	startPid: number
	platform: NodeJS.Platform
	isAlive: (pid: number) => boolean
	now: () => Date
}

export function pass(check: string, detail: string): CheckResult {
	return { check, ok: true, detail, fix: undefined, skipped: false }
}

export function fail(check: string, detail: string, fix: string): CheckResult {
	return { check, ok: false, detail, fix, skipped: false }
}

export function skip(check: string, detail: string, fix: string): CheckResult {
	return { check, ok: true, detail, fix, skipped: true }
}
