import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { FakeGithub } from "./github/testing/fake-gh.ts"
import { main } from "./main.ts"

describe("main", () => {
	test("an unknown command exits 2", async () => {
		expect(await main(["frobnicate"], new FakeGithub().gh)).toBe(2)
	})

	test("a command name that tries to leave the commands directory exits 2", async () => {
		expect(await main(["../main"], new FakeGithub().gh)).toBe(2)
	})

	test("routes to the command, honouring --repo and --json", async () => {
		const fake = new FakeGithub()
		fake.addIssue({ number: 12 })

		expect(await main(["status", "12", "--repo", "milkyskies/kit", "--json"], fake.gh)).toBe(0)
	})

	test("a failed gh call exits 3", async () => {
		expect(await main(["status", "99", "--repo", "milkyskies/kit"], new FakeGithub().gh)).toBe(3)
	})

	test("a refused command exits 1", async () => {
		const fake = new FakeGithub()
		fake.addIssue({ number: 12 })

		expect(
			await main(["release", "12", "--reason", "stopped", "--repo", "milkyskies/kit"], fake.gh),
		).toBe(1)
	})
})

describe("bin/frontdesk", () => {
	test("without bun on PATH it prints the mise fix and exits 127", async () => {
		const shim = join(import.meta.dir, "..", "..", "bin", "frontdesk")
		const child = Bun.spawn(["/bin/sh", shim, "status", "1"], {
			env: { PATH: "/usr/bin:/bin" },
			stdout: "pipe",
			stderr: "pipe",
		})

		const stderr = await new Response(child.stderr).text()

		expect(await child.exited).toBe(127)
		expect(stderr).toContain("frontdesk: bun is not installed on")
		expect(stderr).toContain("Fix: mise use -g bun")
	})
})
