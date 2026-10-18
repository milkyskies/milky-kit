import { describe, expect, test } from "bun:test"

import { parseComments } from "../github/derive.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { decisionCard, failureOf, secondCard, seedWorking } from "../github/testing/seed.ts"
import { run } from "./park.ts"

const BASE = ["--dispatch", "ctx_y"]

describe("frontdesk park", () => {
	test("posts a valid code-detail card and a proposed body, then moves to needs-you", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("card.md", decisionCard("code-detail"))
		fake.files.set("body.md", "## Problem\n\nNew body.\n")

		await run(["12", ...BASE, "--card", "card.md", "--proposed-body", "body.md"], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:needs-you")
		expect(issue.labels).not.toContain("stage:working")

		const kinds = parseComments(issue.comments).map((comment) => comment.marker?.kind)
		expect(kinds).toEqual(["claim", "decision", "proposed-body"])
		expect(issue.comments[1]?.body).toStartWith(
			"<!-- frontdesk:decision claim=c_first1 card=c_first1-1 -->",
		)
		expect(issue.comments[1]?.body).toEndWith("<!-- frontdesk:agent -->\n")
	})

	test("gives every card of one park its own id built from the claim", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("one.md", decisionCard("code-detail"))
		fake.files.set("two.md", secondCard())

		await run(["12", ...BASE, "--card", "one.md", "--card", "two.md"], context)

		const markers = parseComments(fake.issue(12).comments).map((comment) => comment.marker)
		expect(markers[1]).toEqual({
			kind: "decision",
			attrs: { claim: "c_first1", card: "c_first1-1" },
		})
		expect(markers[2]).toEqual({
			kind: "decision",
			attrs: { claim: "c_first1", card: "c_first1-2" },
		})
	})

	test("rejects a card whose option has no say-back line, posting nothing", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set(
			"card.md",
			decisionCard("code-detail").replace(" → Retries = 3, the same as the server.", ""),
		)

		const result = await failureOf(run(["12", ...BASE, "--card", "card.md"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("option 1 needs a say-back line")
		expect(fake.issue(12).comments).toHaveLength(1)
	})

	test("posts a valid design card that carries the hidden pick", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("card.md", decisionCard("design"))

		await run(["12", ...BASE, "--card", "card.md"], context)

		expect(fake.issue(12).labels).toContain("stage:needs-you")
	})

	test("rejects a design card that has a Recommendation line, posting nothing", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("card.md", decisionCard("design", "**Recommendation:** option one.\n"))

		const result = await failureOf(run(["12", ...BASE, "--card", "card.md"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("a design card must not carry a `**Recommendation:**` line")
		expect(fake.issue(12).comments).toHaveLength(1)
		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("rejects a code-detail card without a Recommendation line", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set(
			"card.md",
			decisionCard("code-detail").replace(/\*\*Recommendation:\*\*.*\n/, ""),
		)

		const result = await failureOf(run(["12", ...BASE, "--card", "card.md"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("a code-detail card needs a `**Recommendation:**` line")
	})

	test("rejects a card with one option and no statement that options cannot be enumerated", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("card.md", decisionCard("code-detail").replace(/2\. .*\n/, ""))

		const result = await failureOf(run(["12", ...BASE, "--card", "card.md"], context))

		expect(result.message).toContain("at least two numbered options")
	})

	test("rejects a card with no Already checked line", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set(
			"card.md",
			decisionCard("code-detail").replace(/\*\*Already checked:\*\*.*\n/, ""),
		)

		const result = await failureOf(run(["12", ...BASE, "--card", "card.md"], context))

		expect(result.message).toContain("`**Already checked:**`")
	})

	test("refuses when the newest claim belongs to another dispatch", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12, "ctx_other")
		fake.files.set("card.md", decisionCard("code-detail"))

		const result = await failureOf(run(["12", ...BASE, "--card", "card.md"], context))

		expect(result.code).toBe(1)
		expect(result.message).toContain("belongs to dispatch ctx_other")
		expect(fake.issue(12).comments).toHaveLength(1)
		expect(fake.issue(12).labels).toContain("stage:working")
	})
})
