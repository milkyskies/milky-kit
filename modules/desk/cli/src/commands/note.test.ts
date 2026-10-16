import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf, seedWorking } from "../github/testing/seed.ts"
import { run } from "./note.ts"

const LINE = "Auto-decided: retry three times over five because the server allows three"

describe("desk note", () => {
	test("creates the Small calls section and touches no other part of the body", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		const original = fake.issue(12).body

		await run(["12", "--dispatch", "ctx_y", LINE], context)

		expect(fake.issue(12).body).toBe(
			`${original.trimEnd()}\n\n## Small calls\n\n- 2026-10-16: ${LINE}\n`,
		)
	})

	test("appends to an existing Small calls section", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).body =
			"## Small calls\n\n- 2026-10-15: Auto-decided: a over b because c\n"

		await run(["12", "--dispatch", "ctx_y", LINE], context)

		expect(fake.issue(12).body).toBe(
			`## Small calls\n\n- 2026-10-15: Auto-decided: a over b because c\n- 2026-10-16: ${LINE}\n`,
		)
	})

	test("refuses a line that does not have the Auto-decided shape", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)

		for (const line of [
			"Decided: a over b because c",
			"Auto-decided: a because c",
			"Auto-decided: a over b",
		]) {
			expect((await failureOf(run(["12", "--dispatch", "ctx_y", line], context))).code).toBe(1)
		}
	})

	test("refuses when the newest claim belongs to another dispatch", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12, "ctx_other")
		const original = fake.issue(12).body

		const result = await failureOf(run(["12", "--dispatch", "ctx_y", LINE], context))

		expect(result.code).toBe(1)
		expect(fake.issue(12).body).toBe(original)
	})
})
