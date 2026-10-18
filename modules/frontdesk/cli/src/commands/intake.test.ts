import { describe, expect, test } from "bun:test"

import { sectionLines } from "../github/body.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { run } from "./intake.ts"

describe("frontdesk intake", () => {
	test("files a request at intake with the words verbatim and no autopilot label", async () => {
		const { fake, context, output } = makeHarness()
		fake.files.set("words.md", "Make the counter accents follow 三時.\n")

		await run(["--words", "words.md", "--ask", "ask:choices"], context)

		const issue = fake.issue(101)
		expect([...issue.labels].sort()).toEqual(
			["ask:choices", "priority:P2", "request", "stage:intake"].sort(),
		)
		expect(issue.body).toBe(
			"## Your words\n\nMake the counter accents follow 三時.\n\n## Decisions\n\n## Small calls\n",
		)
		expect(sectionLines(issue.body, "Your words")).toEqual([
			"Make the counter accents follow 三時.",
		])
		expect(output).toEqual(["101"])
	})

	test("titles the issue with the first 60 characters of the line", async () => {
		const { fake, context } = makeHarness()
		const line = "あ".repeat(80)
		fake.files.set("words.md", line)

		await run(["--words", "words.md", "--ask", "ask:everything"], context)

		const create = fake.callsMatching(["issue", "create"])[0] ?? []
		expect(create[create.indexOf("--title") + 1]).toBe("あ".repeat(60))
	})

	test("an ask value that is not an ask label is a usage error and files nothing", async () => {
		const { fake, context } = makeHarness()
		fake.files.set("words.md", "Anything.")

		const result = await failureOf(run(["--words", "words.md", "--ask", "choices"], context))

		expect(result.code).toBe(2)
		expect(fake.callsMatching(["issue", "create"])).toHaveLength(0)
	})

	test("an empty line files nothing", async () => {
		const { fake, context } = makeHarness()
		fake.files.set("words.md", "  \n")

		const result = await failureOf(run(["--words", "words.md", "--ask", "ask:choices"], context))

		expect(result.code).toBe(2)
		expect(fake.callsMatching(["issue", "create"])).toHaveLength(0)
	})
})
