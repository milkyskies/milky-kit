import { describe, expect, test } from "bun:test"

import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { run } from "./picture.ts"

const URL = "https://github.com/milkyskies/kit/blob/desk-pictures/12/after.png?raw=true"

describe("desk picture", () => {
	test("creates the orphan branch on first use and returns the link", async () => {
		const { fake, context, output } = makeHarness()
		fake.files.set("shots/after.png", "pixels")

		await run(["12", "shots/after.png"], context)

		expect(output).toEqual([URL])
		expect(fake.branches.get("desk-pictures")?.has("12/after.png")).toBe(true)

		const commit = fake.callsMatching(["api", "-X", "POST", "repos/milkyskies/kit/git/commits"])
		expect(commit).toHaveLength(1)
	})

	test("reuses the branch on the second use and replaces a file of the same name", async () => {
		const { fake, context, output } = makeHarness()
		fake.files.set("after.png", "one")

		await run(["12", "after.png"], context)
		fake.files.set("after.png", "two")
		await run(["12", "after.png"], context)

		expect(output).toEqual([URL, URL])
		expect(fake.callsMatching(["api", "-X", "POST", "repos/milkyskies/kit/git/refs"])).toHaveLength(
			1,
		)
	})

	test("a file that cannot be read is a usage error", async () => {
		const { context } = makeHarness()

		expect((await failureOf(run(["12", "missing.png"], context))).code).toBe(2)
	})
})
