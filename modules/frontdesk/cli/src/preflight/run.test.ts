import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { FAKE_REPO } from "../github/testing/fake-gh.ts"
import { formatResult, runChecks } from "./run.ts"
import {
	FRONTDESK_SECTION,
	failed,
	hostListJson,
	makeWorld,
	ok,
	orcaStatusJson,
	type World,
} from "./testing/world.ts"
import type { CheckResult } from "./types.ts"

const worlds: World[] = []

async function world(options: { section?: string } = {}): Promise<World> {
	const made = await makeWorld(options)
	worlds.push(made)

	return made
}

afterEach(async () => {
	await Promise.all(worlds.splice(0).map((made) => made.cleanup()))
})

function only(results: CheckResult[], check: string): CheckResult {
	const found = results.find((result) => result.check === check)
	if (!found)
		throw new Error(`no check named ${check} in ${results.map((r) => r.check).join(", ")}`)

	return found
}

describe("preflight checks", () => {
	test("a healthy machine passes every check for both roles", async () => {
		const made = await world()

		for (const role of ["worker", "coordinator"] as const) {
			const results = await runChecks(made.environment(role))

			expect(results.filter((result) => !result.ok)).toEqual([])
		}
	})

	test("bun missing fails with the mise fix", async () => {
		const made = await world()
		made.script.set("bun --version", failed("not found", 127))

		const result = only(await runChecks(made.environment("worker")), "bun")

		expect(result.ok).toBe(false)
		expect(formatResult(result)).toBe("FAIL  bun is not installed · fix: mise use -g bun")
	})

	test("kit missing fails with the clone fix", async () => {
		const made = await world()
		await chmod(join(made.home, ".claude", "kit", "modules", "frontdesk", "bin", "frontdesk"), 0o644)

		const result = only(await runChecks(made.environment("worker")), "kit present")

		expect(result.ok).toBe(false)
		expect(result.fix).toContain("git clone https://github.com/milkyskies/milky-kit")
	})

	test("a kit behind origin/main fails with the pull fix", async () => {
		const made = await world()
		const kit = join(made.home, ".claude", "kit")
		made.script.set(`git -C ${kit} rev-list --count HEAD..origin/main`, ok("3\n"))

		const result = only(await runChecks(made.environment("worker")), "kit current")

		expect(result.ok).toBe(false)
		expect(result.detail).toContain("3 commits behind")
		expect(result.fix).toBe(`git -C ${kit} pull`)
	})

	test("Orca unreachable fails with orca open", async () => {
		const made = await world()
		made.script.set("orca status --json", ok(orcaStatusJson(undefined, false)))

		const result = only(await runChecks(made.environment("worker")), "Orca running")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("orca open (or start the Orca app)")
	})

	test("gh logged out fails with gh auth login", async () => {
		const made = await world()
		made.script.set("gh auth status", failed("not logged in"))

		expect(only(await runChecks(made.environment("worker")), "gh logged in").fix).toBe(
			"gh auth login",
		)
	})

	test("a read-only repository names the permission seen", async () => {
		const made = await world()
		made.script.set(
			`gh repo view ${FAKE_REPO} --json viewerPermission --jq .viewerPermission`,
			ok("READ\n"),
		)

		const result = only(await runChecks(made.environment("worker")), "repository writable")

		expect(result.ok).toBe(false)
		expect(result.fix).toContain("permission seen: READ")
	})

	test("a dangling rule symlink fails with rules:link", async () => {
		const made = await world()
		await rm(join(made.home, ".claude", "kit", "modules", "frontdesk", "rules", "frontdesk.md"))

		const result = only(await runChecks(made.environment("worker")), "rules linked")

		expect(result.ok).toBe(false)
		expect(result.detail).toContain("frontdesk.md")
		expect(result.fix).toBe("mise run rules:link")
	})

	test("a project without .claude/rules fails rules linked", async () => {
		const made = await world()
		await rm(join(made.projectRoot, ".claude"), { recursive: true })

		expect(only(await runChecks(made.environment("worker")), "rules linked").ok).toBe(false)
	})

	test("Serena disconnected fails a worker with the mcp add line", async () => {
		const made = await world()
		made.script.set(
			"claude mcp list",
			ok("serena: serena start-mcp-server - ✘ Failed to connect\n"),
		)

		const result = only(await runChecks(made.environment("worker")), "Serena connected")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe(
			"claude mcp add serena -- serena start-mcp-server --context=claude-code --project-from-cwd",
		)
	})

	test("Serena is not a coordinator check", async () => {
		const made = await world()

		const results = await runChecks(made.environment("coordinator"))

		expect(results.some((result) => result.check === "Serena connected")).toBe(false)
	})

	test("a missing project mcp server fails with its own fix", async () => {
		const made = await world()
		made.script.set("claude mcp list", ok("serena: x - ✔ Connected\n"))

		const result = only(await runChecks(made.environment("worker")), "mcp blender")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("claude mcp list and connect blender")
	})

	test("serena listed under mcp is checked once for a worker", async () => {
		const made = await world()

		const results = await runChecks(made.environment("worker"))

		expect(results.filter((result) => result.detail.includes("serena"))).toHaveLength(1)
	})

	test("missing mise tools fail with mise install", async () => {
		const made = await world()
		made.script.set("mise ls --missing", ok("node  24  ~/.config/mise\n"))

		const result = only(await runChecks(made.environment("worker")), "mise tools")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("mise install")
	})

	test("a failing project need prints the fix written beside it", async () => {
		const made = await world()
		made.script.set("sh -c pg_isready -h localhost -p 5432", failed("no response", 2))

		const result = only(
			await runChecks(made.environment("worker")),
			"project need pg_isready -h localhost -p 5432",
		)

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("docker compose up -d db")
	})

	test("an invalid ## frontdesk section names the bad line", async () => {
		const made = await world({ section: FRONTDESK_SECTION.replace("- check:", "- chek:") })

		const result = only(await runChecks(made.environment("coordinator")), "## frontdesk section")

		expect(result.ok).toBe(false)
		expect(result.detail).toContain('CLAUDE.md line 8: unknown key "chek" in ### Coordinator')
		expect(result.fix).toContain("CLAUDE.md line 8")
	})

	test("a project with no ## frontdesk section fails with the template fix", async () => {
		const made = await world()
		await writeFile(join(made.projectRoot, "CLAUDE.md"), "# project\n")

		const result = only(await runChecks(made.environment("coordinator")), "## frontdesk section")

		expect(result.ok).toBe(false)
		expect(result.fix).toContain("frontdesk-section.md")
	})

	test("a label the setup script creates but the repository lacks fails with the script", async () => {
		const made = await world()
		made.script.set(
			`gh label list --repo ${FAKE_REPO} --limit 200 --json name --jq .[].name`,
			ok("request\nstage:ready\n"),
		)

		const result = only(await runChecks(made.environment("coordinator")), "labels")

		expect(result.ok).toBe(false)
		expect(result.detail).toContain("points:1, points:2, points:3")
		expect(result.fix).toBe("bash .github/scripts/setup-labels.sh")
	})

	test("a coordinator on the wrong machine names the pinned machine", async () => {
		const made = await world()
		made.script.set("orca host list --json", ok(hostListJson("Hera")))

		const result = only(await runChecks(made.environment("coordinator")), "pinned machine")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("start the coordinator on Minerva")
	})

	test("an unreachable worker machine is skipped with a connect line, not failed", async () => {
		const made = await world()
		made.script.set("orca status --environment zeus --json", failed("no route"))

		const result = only(await runChecks(made.environment("coordinator")), "worker machine zeus")

		expect(result.ok).toBe(true)
		expect(result.skipped).toBe(true)
		expect(formatResult(result)).toBe(
			"skip  zeus unreachable, skipped this pass · fix: connect zeus in Orca",
		)
	})

	test("an unset ntfy target fails with the setup step", async () => {
		const made = await world()
		const environment = {
			...made.environment("coordinator"),
			variables: { FRONTDESK_NTFY_URL: "http://zeus:8090" },
		}

		const result = only(await runChecks(environment), "ping configured")

		expect(result.ok).toBe(false)
		expect(result.detail).toBe("FRONTDESK_NTFY_TOPIC not set")
		expect(result.fix).toContain("~/.config/frontdesk/.env")
	})

	test("every check runs even after earlier ones fail", async () => {
		const healthy = await world()
		const expected = (await runChecks(healthy.environment("coordinator"))).map(
			(result) => result.check,
		)
		const broken = await world()
		broken.script.set("bun --version", failed("nope", 127))
		broken.script.set("gh auth status", failed("nope"))
		broken.script.set("mise ls --missing", ok("node\n"))
		broken.script.set("orca status --json", failed("down"))

		const results = await runChecks(broken.environment("coordinator"))

		expect(results.map((result) => result.check)).toEqual(expected)
		expect(results.filter((result) => !result.ok).map((result) => result.check)).toEqual([
			"bun",
			"Orca running",
			"gh logged in",
			"mise tools",
		])
	})

	test("a check that throws is reported as a failure and the rest still run", async () => {
		const made = await world()
		made.script.delete("mise ls --missing")

		const results = await runChecks(made.environment("worker"))

		expect(results.some((result) => !result.ok && result.detail.includes("crashed"))).toBe(true)
		expect(results.some((result) => result.check === "Serena connected")).toBe(true)
	})
})

describe("coordinator lock check", () => {
	const lockPath = (made: World) =>
		join(made.home, ".local", "state", "frontdesk", "milkyskies__kit", "coordinator.lock")

	test("a stale lock whose pid is dead is taken over", async () => {
		const made = await world()
		await mkdir(join(made.home, ".local", "state", "frontdesk", "milkyskies__kit"), { recursive: true })
		await writeFile(
			lockPath(made),
			JSON.stringify({
				pid: 999,
				orcaSessionId: "dead-session",
				startedAt: "2026-10-15T00:00:00Z",
			}),
		)

		const result = only(await runChecks(made.environment("coordinator")), "coordinator lock")

		expect(result.ok).toBe(true)
		expect(JSON.parse(await Bun.file(lockPath(made)).text())).toMatchObject({
			pid: 4000,
			orcaSessionId: "sess-me",
		})
	})

	test("a live lock refuses and names the holding session", async () => {
		const made = await world()
		await mkdir(join(made.home, ".local", "state", "frontdesk", "milkyskies__kit"), { recursive: true })
		await writeFile(
			lockPath(made),
			JSON.stringify({ pid: 999, orcaSessionId: "sess-first", startedAt: "2026-10-15T00:00:00Z" }),
		)
		made.liveProcesses.add(999)

		const result = only(await runChecks(made.environment("coordinator")), "coordinator lock")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("stop the coordinator in Orca session sess-first first")
		expect(JSON.parse(await Bun.file(lockPath(made)).text()).pid).toBe(999)
	})

	test("the session that already holds the lock passes on the next pass", async () => {
		const made = await world()

		await runChecks(made.environment("coordinator"))
		const second = only(await runChecks(made.environment("coordinator")), "coordinator lock")

		expect(second.ok).toBe(true)
		expect(second.detail).toContain("already held")
	})

	test("a worker never touches the lock", async () => {
		const made = await world()

		await runChecks(made.environment("worker"))

		expect(await Bun.file(lockPath(made)).exists()).toBe(false)
	})

	test("no claude process above the shell fails the check", async () => {
		const made = await world()
		made.script.set("ps -o ppid=,comm= -p 4000", ok("3000 zsh\n"))
		made.script.set("ps -o ppid=,comm= -p 3000", ok("1 launchd\n"))

		const result = only(await runChecks(made.environment("coordinator")), "coordinator lock")

		expect(result.ok).toBe(false)
		expect(result.fix).toBe("run the coordinator from a claude session")
	})
})
