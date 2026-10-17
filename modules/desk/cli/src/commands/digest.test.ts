import { describe, expect, test } from "bun:test"

import { composeComment } from "../github/markers.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { FakeOrca } from "../orca/testing/fake-orca.ts"
import { pingedAt } from "../ping/digest.ts"
import { SECTION } from "../reconcile/testing/fixtures.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { memoryLedger } from "../watch/ledger.ts"
import { runWith } from "./digest.ts"

type Posted = { url: string; headers: Record<string, string>; body: string }

function setup(status = 200, appUrl?: string) {
	const harness = makeListingHarness()
	const posted: Posted[] = []
	const ledger = memoryLedger()
	const fakeOrca = new FakeOrca()
	const deps = {
		orca: fakeOrca.orca,
		loadSection: async () => SECTION,
		ledger,
		ping: {
			loadEnv: async () => ({
				DESK_NTFY_URL: "http://zeus:8090/",
				DESK_NTFY_TOPIC: "abc123",
				DESK_APP_URL: appUrl,
			}),
			post: async (url: string, headers: Record<string, string>, body: string) => {
				posted.push({ url, headers, body })

				return status
			},
		},
	}

	return { ...harness, posted, deps, ledger, fakeOrca }
}

function seedParked(harness: ReturnType<typeof setup>) {
	harness.fake.addIssue({ number: 12, labels: ["request", "autopilot", "stage:needs-you"] })
	harness.fake.addComment(12, claimBody("c_1"))
	const card = harness.fake.addComment(12, composeComment("decision", {}, "## Decision needed"))
	harness.fake.addIssue({ number: 13, labels: ["request", "autopilot", "stage:check"] })
	harness.fake.addComment(13, claimBody("c_2"))
	const result = harness.fake.addComment(
		13,
		composeComment("result", { claim: "c_2", pr: "45" }, "## Done, check it"),
	)

	return { card, result }
}

describe("desk digest", () => {
	test("links to the desk instead of a GitHub search when DESK_APP_URL is set", async () => {
		const harness = setup(200, "https://desk.tail1234.ts.net/")
		seedParked(harness)

		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted[0]?.body).toBe(
			"kit: 1 decision waiting, 1 done to check\nhttps://desk.tail1234.ts.net",
		)
	})

	test("an agent merge keeps its own issue link beside the desk link", async () => {
		const harness = setup(200, "https://desk.tail1234.ts.net")
		seedParked(harness)
		harness.fake.addIssue({ number: 14, labels: ["request", "stage:done"], state: "CLOSED" })
		harness.fake.addComment(
			14,
			composeComment("merge", { claim: "c_9", by: "auto" }, "Merged by the desk."),
		)

		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted[0]?.body.split("\n").slice(1)).toEqual([
			"https://desk.tail1234.ts.net",
			"https://github.com/milkyskies/kit/issues/14",
		])
	})

	test("--send pings once for every unpinged card and result, then marks each comment", async () => {
		const harness = setup()
		const { card, result } = seedParked(harness)

		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted).toHaveLength(1)
		expect(harness.posted[0]?.url).toBe("http://zeus:8090/abc123")
		expect(harness.posted[0]?.body).toBe(
			"kit: 1 decision waiting, 1 done to check\nhttps://github.com/milkyskies/kit/issues?q=is:open+label:stage:needs-you,stage:check",
		)
		expect(pingedAt(card.body)).toEqual(new Date("2026-10-16T14:02:00Z"))
		expect(pingedAt(result.body)).toEqual(new Date("2026-10-16T14:02:00Z"))
	})

	test("--send marks nothing when the ping fails, so the next pass retries", async () => {
		const harness = setup(503)
		const { card, result } = seedParked(harness)
		const before = [card.body, result.body]

		const failure = await failureOf(runWith(harness.deps, ["--send"], harness.context))

		expect(failure.code).toBe(3)
		expect(failure.message).toContain("HTTP 503")
		expect([card.body, result.body]).toEqual(before)
		expect(harness.fake.callsMatching(["api", "-X", "PATCH"])).toHaveLength(0)
	})

	test("a second pass sends nothing for comments that carry the pinged marker", async () => {
		const harness = setup()
		seedParked(harness)

		await runWith(harness.deps, ["--send"], harness.context)
		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted).toHaveLength(1)
	})

	test("without --send it prints the message and marks nothing", async () => {
		const harness = setup()
		const { card } = seedParked(harness)

		await runWith(harness.deps, [], harness.context)

		expect(harness.posted).toHaveLength(0)
		expect(pingedAt(card.body)).toBeUndefined()
	})

	test("a card still waiting 48 hours after its marker counts again and gets a new time", async () => {
		const harness = setup()
		const { card } = seedParked(harness)
		card.body = `${card.body}<!-- desk:pinged at=2026-10-14T13:00:00Z -->\n`

		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted[0]?.body).toStartWith("kit: 1 decision waiting, 1 done to check")
		expect(pingedAt(card.body)).toEqual(new Date("2026-10-16T14:02:00Z"))
	})

	test("a card pinged yesterday does not resurface", async () => {
		const harness = setup()
		const { card } = seedParked(harness)
		card.body = `${card.body}<!-- desk:pinged at=2026-10-15T14:00:00Z -->\n`

		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted[0]?.body).toStartWith("kit: 1 done to check")
	})

	test("an issue with bad labels pings once per distinct label set", async () => {
		const harness = setup()
		harness.fake.addIssue({ number: 20, labels: ["request"] })

		await runWith(harness.deps, ["--send"], harness.context)
		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted).toHaveLength(1)
		expect(harness.posted[0]?.body).toStartWith("kit: 1 issue with bad labels")
	})

	test("a remote claim with no worker row, and a request claimed by hand, are reported once", async () => {
		const harness = setup()
		harness.fake.addIssue({ number: 30, labels: ["request", "autopilot", "stage:working"] })
		harness.fake.addComment(30, claimBody("c_9", "ctx_gone"))
		harness.fake.addIssue({ number: 31, labels: ["request", "stage:working"] })

		await runWith(harness.deps, ["--send"], harness.context)
		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted).toHaveLength(1)
		expect(harness.posted[0]?.body).toStartWith("kit: 2 requests need a look")
	})

	test("a request merged by an agent is counted once, linked, and marked", async () => {
		const harness = setup()
		harness.fake.addIssue({ number: 14, state: "CLOSED", labels: ["request", "stage:done"] })
		const merged = harness.fake.addComment(
			14,
			composeComment("merge", { pr: "47", ci: "none", check: "passed", by: "auto" }, "Merged."),
		)
		harness.fake.addIssue({ number: 15, state: "CLOSED", labels: ["request", "stage:done"] })
		harness.fake.addComment(
			15,
			composeComment("merge", { pr: "48", ci: "none", check: "passed" }, "Merged."),
		)

		await runWith(harness.deps, ["--send"], harness.context)
		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted).toHaveLength(1)
		expect(harness.posted[0]?.body).toBe(
			"kit: 1 merged by an agent\nhttps://github.com/milkyskies/kit/issues/14",
		)
		expect(pingedAt(merged.body)).toEqual(new Date("2026-10-16T14:02:00Z"))
	})

	test("the merged count joins the other counts and keeps their link", async () => {
		const harness = setup()
		seedParked(harness)
		harness.fake.addIssue({ number: 14, state: "CLOSED", labels: ["request", "stage:done"] })
		harness.fake.addComment(14, composeComment("merge", { pr: "47", by: "auto" }, "Merged."))
		harness.fake.addIssue({ number: 16, state: "CLOSED", labels: ["request", "stage:done"] })
		harness.fake.addComment(16, composeComment("merge", { pr: "49", by: "auto" }, "Merged."))

		await runWith(harness.deps, [], harness.context)

		expect(harness.output[0]).toBe(
			[
				"kit: 1 decision waiting, 1 done to check, 2 merged by agents",
				"https://github.com/milkyskies/kit/issues?q=is:open+label:stage:needs-you,stage:check",
				"https://github.com/milkyskies/kit/issues/14",
				"https://github.com/milkyskies/kit/issues/16",
			].join("\n"),
		)
	})

	test("the message holds the project, counts and a link, never issue text", async () => {
		const harness = setup()
		seedParked(harness)
		harness.fake.issue(12).body = "## Problem\n\nSECRET TITLE WORDS\n"

		await runWith(harness.deps, ["--send"], harness.context)

		expect(harness.posted[0]?.body).not.toContain("SECRET")
	})
})
