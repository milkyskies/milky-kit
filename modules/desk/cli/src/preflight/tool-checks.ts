import { access, constants } from "node:fs/promises"
import { join } from "node:path"

import { repoSlug } from "../github/gh.ts"
import type { Facts } from "./facts.ts"
import { type CheckResult, fail, type PreflightEnvironment, pass } from "./types.ts"

const KIT_DIRECTORY = ".claude/kit"
const WRITE_PERMISSIONS = ["WRITE", "MAINTAIN", "ADMIN"]

export const KIT_CLONE_FIX =
	"git clone https://github.com/milkyskies/milky-kit ~/Code/Projects/milky-kit && ln -s ~/Code/Projects/milky-kit ~/.claude/kit"

export const SERENA_FIX =
	"claude mcp add serena -- serena start-mcp-server --context=claude-code --project-from-cwd"

export async function checkBun(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const result = await environment.run("bun", ["--version"])
	if (result.status === 0) return [pass("bun", `bun ${result.stdout.trim()}`)]

	return [fail("bun", "bun is not installed", "mise use -g bun")]
}

export async function checkKitPresent(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const shim = join(environment.home, KIT_DIRECTORY, "modules", "desk", "bin", "desk")
	const present = await access(shim, constants.X_OK).then(
		() => true,
		() => false,
	)
	if (present) return [pass("kit present", "kit present")]

	return [fail("kit present", `the kit is missing: ${shim} does not resolve`, KIT_CLONE_FIX)]
}

export async function checkKitCurrent(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const kit = join(environment.home, KIT_DIRECTORY)
	const fix = `git -C ${kit} pull`

	const fetched = await environment.run("git", ["-C", kit, "fetch", "-q"])
	if (fetched.status !== 0) {
		return [fail("kit current", `git fetch in the kit failed: ${fetched.stderr.trim()}`, fix)]
	}

	const behind = await environment.run("git", [
		"-C",
		kit,
		"rev-list",
		"--count",
		"HEAD..origin/main",
	])
	const count = Number(behind.stdout.trim())
	if (behind.status !== 0 || !Number.isInteger(count)) {
		return [
			fail("kit current", `cannot compare the kit with origin/main: ${behind.stderr.trim()}`, fix),
		]
	}

	if (count > 0) return [fail("kit current", `the kit is ${count} commits behind origin/main`, fix)]

	return [pass("kit current", "kit is up to date")]
}

export async function checkOrcaRunning(
	_: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	const status = await facts.statusOf()
	if (status?.reachable) return [pass("Orca running", "Orca is running")]

	return [
		fail(
			"Orca running",
			"Orca is not running or not reachable",
			"orca open (or start the Orca app)",
		),
	]
}

export async function checkGhLoggedIn(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const result = await environment.run("gh", ["auth", "status"])
	if (result.status === 0) return [pass("gh logged in", "gh logged in")]

	return [fail("gh logged in", "gh is not logged in", "gh auth login")]
}

export async function checkRepositoryWritable(
	environment: PreflightEnvironment,
): Promise<CheckResult[]> {
	const slug = repoSlug(environment.repo)
	const result = await environment.run("gh", [
		"repo",
		"view",
		slug,
		"--json",
		"viewerPermission",
		"--jq",
		".viewerPermission",
	])

	const permission = result.stdout.trim()
	if (result.status === 0 && WRITE_PERMISSIONS.includes(permission)) {
		return [pass("repository writable", `${slug} writable (${permission})`)]
	}

	const seen = result.status === 0 ? permission || "none" : "unreadable"

	return [
		fail(
			"repository writable",
			`${slug} permission is ${seen}, need WRITE, MAINTAIN or ADMIN`,
			`ask for write access to ${slug} (permission seen: ${seen})`,
		),
	]
}

export async function checkMiseTools(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const result = await environment.run("mise", ["ls", "--missing"], {
		cwd: environment.projectRoot,
	})
	const missing = result.stdout.trim()
	if (result.status === 0 && missing === "") return [pass("mise tools", "mise tools installed")]

	const detail =
		result.status === 0
			? `mise tools are missing: ${missing.split("\n").join("; ")}`
			: `mise failed: ${result.stderr.trim()}`

	return [fail("mise tools", detail, "mise install")]
}

export async function checkSerena(_: PreflightEnvironment, facts: Facts): Promise<CheckResult[]> {
	const servers = await facts.mcpServers()
	if (servers.kind === "listed" && servers.connected.has("serena")) {
		return [pass("Serena connected", "serena connected")]
	}

	return [fail("Serena connected", "serena not connected", SERENA_FIX)]
}
