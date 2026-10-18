import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { GhError } from "../github/gh.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { failed, makeWorld, ok, START_PID, type World } from "../preflight/testing/world.ts"
import { type PreflightDependencies, runPreflight } from "./preflight.ts"

const worlds: World[] = []

afterEach(async () => {
	await Promise.all(worlds.splice(0).map((made) => made.cleanup()))
})

async function setup(now = new Date("2026-10-16T14:00:00Z")) {
	const made = await makeWorld()
	worlds.push(made)
	made.script.set("git rev-parse --show-toplevel", ok(`${made.projectRoot}\n`))

	const { context, output } = makeHarness()
	const clock = { current: now }
	const pings: string[] = []
	const dependencies: PreflightDependencies = {
		run: made.run,
		home: made.home,
		cwd: made.projectRoot,
		processVariables: { FRONTDESK_NTFY_URL: "http://zeus:8090", FRONTDESK_NTFY_TOPIC: "abc123" },
		startPid: START_PID,
		isAlive: (pid) => made.liveProcesses.has(pid),
		sendPing: () => async (message) => {
			pings.push(message)
		},
	}

	const { repo, ...base } = context

	return {
		made,
		context: { ...base, now: () => clock.current, resolveRepo: async () => repo },
		output,
		dependencies,
		pings,
		clock,
	}
}

describe("frontdesk preflight", () => {
	test("prints one ok line per check and exits clean when everything passes", async () => {
		const { context, output, dependencies } = await setup()

		await runPreflight(["--role", "worker"], context, dependencies)

		expect(output[0]).toBe("ok    bun 1.3.0")
		expect(output.every((line) => line.startsWith("ok"))).toBe(true)
	})

	test("exits 1, lists every failure with its fix, and names the failed checks on stderr", async () => {
		const { made, context, output, dependencies } = await setup()
		made.script.set("gh auth status", failed("no"))
		made.script.set("mise ls --missing", ok("node\n"))

		const result = await failureOf(runPreflight(["--role", "worker"], context, dependencies))

		expect(result.code).toBe(1)
		expect(result.message).toBe(
			"frontdesk: preflight --role worker failed 2 checks: gh logged in, mise tools",
		)
		expect(output).toContain("FAIL  gh is not logged in · fix: gh auth login")
		expect(output).toContain("FAIL  mise tools are missing: node · fix: mise install")
	})

	test("--json prints the check, ok, detail and fix of every check", async () => {
		const { made, context, output, dependencies } = await setup()
		made.script.set("gh auth status", failed("no"))

		await failureOf(runPreflight(["--role", "worker"], { ...context, json: true }, dependencies))

		const rows = JSON.parse(output[0] ?? "[]")
		expect(rows.find((row: { check: string }) => row.check === "gh logged in")).toMatchObject({
			ok: false,
			fix: "gh auth login",
		})
		expect(rows.find((row: { check: string }) => row.check === "bun")).toMatchObject({
			ok: true,
			fix: null,
		})
	})

	test("--role is required and validated", async () => {
		const { context, dependencies } = await setup()

		expect((await failureOf(runPreflight([], context, dependencies))).code).toBe(2)
		expect((await failureOf(runPreflight(["--role", "boss"], context, dependencies))).code).toBe(2)
	})

	test("--ping sends one ping naming the project, machine, count and fixes", async () => {
		const { made, context, dependencies, pings } = await setup()
		made.script.set("mise ls --missing", ok("node\n"))

		await failureOf(runPreflight(["--role", "worker", "--ping"], context, dependencies))

		expect(pings).toEqual(["kit on Minerva: 1 fix · mise install"])
	})

	test("without --ping nothing is sent", async () => {
		const { made, context, dependencies, pings } = await setup()
		made.script.set("mise ls --missing", ok("node\n"))

		await failureOf(runPreflight(["--role", "worker"], context, dependencies))

		expect(pings).toEqual([])
	})

	test("the same failure set pings once in 6 hours and again after", async () => {
		const { made, context, dependencies, pings, clock } = await setup()
		made.script.set("mise ls --missing", ok("node\n"))
		const attempt = () =>
			failureOf(runPreflight(["--role", "worker", "--ping"], context, dependencies))

		await attempt()
		clock.current = new Date("2026-10-16T19:59:00Z")
		await attempt()

		expect(pings).toHaveLength(1)

		clock.current = new Date("2026-10-16T20:01:00Z")
		await attempt()

		expect(pings).toHaveLength(2)
	})

	test("a different failure set pings straight away", async () => {
		const { made, context, dependencies, pings } = await setup()
		made.script.set("mise ls --missing", ok("node\n"))
		await failureOf(runPreflight(["--role", "worker", "--ping"], context, dependencies))

		made.script.set("gh auth status", failed("no"))
		await failureOf(runPreflight(["--role", "worker", "--ping"], context, dependencies))

		expect(pings).toHaveLength(2)
		expect(pings[1]).toContain("2 fixes")
	})

	test("a ping that fails to send is not recorded, so the next run tries again", async () => {
		const { made, context, dependencies, pings } = await setup()
		made.script.set("mise ls --missing", ok("node\n"))
		let broken = true
		const flaky: PreflightDependencies = {
			...dependencies,
			sendPing: () => async (message) => {
				if (broken) throw new Error("ntfy refused")
				pings.push(message)
			},
		}

		await failureOf(runPreflight(["--role", "worker", "--ping"], context, flaky))
		broken = false
		await failureOf(runPreflight(["--role", "worker", "--ping"], context, flaky))

		expect(pings).toHaveLength(1)
	})

	test("a ping record file from a lost state directory costs one extra ping, never a crash", async () => {
		const { made, context, dependencies, pings } = await setup()
		made.script.set("mise ls --missing", ok("node\n"))
		const directory = join(made.home, ".local", "state", "frontdesk", "milkyskies__kit")
		await mkdir(directory, { recursive: true })
		await writeFile(join(directory, "preflight-pinged.json"), "not json")

		await failureOf(runPreflight(["--role", "worker", "--ping"], context, dependencies))

		expect(pings).toHaveLength(1)
		expect(JSON.parse(await readFile(join(directory, "preflight-pinged.json"), "utf8"))).toBeTypeOf(
			"object",
		)
	})

	test("ntfy settings are read from ~/.config/frontdesk/.env when the environment lacks them", async () => {
		const { made, context, output, dependencies } = await setup()
		await mkdir(join(made.home, ".config", "frontdesk"), { recursive: true })
		await writeFile(
			join(made.home, ".config", "frontdesk", ".env"),
			"FRONTDESK_NTFY_URL=http://zeus:8090\nFRONTDESK_NTFY_TOPIC=abc\n",
		)

		await runPreflight(["--role", "coordinator"], context, {
			...dependencies,
			processVariables: {},
		})

		expect(output).toContain("ok    ping configured")
	})

	test("a logged-out gh reports its own fix line instead of dying on the repository lookup", async () => {
		const { made, context, output, dependencies } = await setup()
		made.script.set("gh auth status", failed("not logged in"))
		const loggedOut = {
			...context,
			resolveRepo: async () => {
				throw new GhError(["repo", "view"], "gh: To use GitHub CLI, run: gh auth login")
			},
		}

		const result = await failureOf(runPreflight(["--role", "coordinator"], loggedOut, dependencies))

		expect(result.code).toBe(1)
		expect(output).toContain("FAIL  gh is not logged in · fix: gh auth login")
		expect(
			output.some(
				(line) =>
					line.startsWith("FAIL  no GitHub repository could be resolved") &&
					line.endsWith("fix: gh auth login"),
			),
		).toBe(true)
		expect(output.some((line) => line.includes("coordinator lock"))).toBe(false)
	})

	test("a directory outside any repository names --repo as the fix when gh is logged in", async () => {
		const { context, output, dependencies } = await setup()
		const outside = {
			...context,
			resolveRepo: async () => {
				throw new GhError(["repo", "view"], "no git remotes found")
			},
		}

		await failureOf(runPreflight(["--role", "worker"], outside, dependencies))

		expect(
			output.some(
				(line) =>
					line.includes("no git remotes found") && line.endsWith("or pass --repo owner/name"),
			),
		).toBe(true)
		expect(output).toContain("ok    gh logged in")
	})
})
