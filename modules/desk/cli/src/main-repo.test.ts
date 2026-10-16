import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { GhError } from "./github/gh.ts"
import { FakeGithub } from "./github/testing/fake-gh.ts"
import { main } from "./main.ts"

function failingRepoView(fake: FakeGithub) {
	return async (args: readonly string[], input?: string) => {
		if (args[0] === "repo") throw new GhError(args, "gh: To use GitHub CLI, run: gh auth login")

		return fake.gh(args, input)
	}
}

describe("repository resolution is lazy", () => {
	test("a command that needs the repository exits 3 when gh repo view fails", async () => {
		const fake = new FakeGithub()
		fake.addIssue({ number: 12 })

		expect(await main(["status", "12"], failingRepoView(fake))).toBe(3)
	})

	test("--repo skips gh repo view entirely", async () => {
		const fake = new FakeGithub()
		fake.addIssue({ number: 12 })

		expect(await main(["status", "12", "--repo", "milkyskies/kit"], failingRepoView(fake))).toBe(0)
		expect(fake.callsMatching(["repo"])).toHaveLength(0)
	})

	test("a repository-free command runs and can report the resolution failure itself", async () => {
		const directory = mkdtempSync(join(tmpdir(), "desk-commands-"))
		writeFileSync(
			join(directory, "probe.ts"),
			`export const runWithoutRepo = async (_args, context) => {
	try {
		await context.resolveRepo()
		context.out("repo ok")
	} catch (error) {
		context.out("repo failed: " + error.message)
	}
}
`,
		)
		const fake = new FakeGithub()
		const lines: string[] = []
		const original = process.stdout.write.bind(process.stdout)
		process.stdout.write = (chunk: string | Uint8Array) => {
			lines.push(String(chunk))

			return true
		}

		try {
			const code = await main(["probe"], failingRepoView(fake), directory)
			expect(code).toBe(0)
		} finally {
			process.stdout.write = original
		}

		expect(lines.join("")).toContain("repo failed: gh repo view")
	})
})
