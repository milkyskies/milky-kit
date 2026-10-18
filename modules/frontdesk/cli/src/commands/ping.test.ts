import { describe, expect, test } from "bun:test"

import { failureOf } from "../github/testing/seed.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { runWithoutRepoUsing as runWith } from "./ping.ts"

function deps(env: Record<string, string>, status = 200) {
	const posted: { url: string; headers: Record<string, string>; body: string }[] = []

	return {
		posted,
		ping: {
			loadEnv: async () => env,
			post: async (url: string, headers: Record<string, string>, body: string) => {
				posted.push({ url, headers, body })

				return status
			},
		},
	}
}

describe("frontdesk ping", () => {
	test("posts the message to the topic, with the token as a bearer header", async () => {
		const { context } = makeListingHarness()
		const { ping, posted } = deps({
			FRONTDESK_NTFY_URL: "https://ntfy.sh",
			FRONTDESK_NTFY_TOPIC: "t0pic",
			FRONTDESK_NTFY_TOKEN: "tk_1",
		})

		await runWith(ping, ["kit:", "1", "decision waiting"], context)

		expect(posted).toEqual([
			{
				url: "https://ntfy.sh/t0pic",
				headers: { Authorization: "Bearer tk_1" },
				body: "kit: 1 decision waiting",
			},
		])
	})

	test("exits 3 and names the fix when ntfy is not configured", async () => {
		const { context } = makeListingHarness()

		const failure = await failureOf(runWith(deps({}).ping, ["hello"], context))

		expect(failure.code).toBe(3)
		expect(failure.message).toContain("~/.config/frontdesk/.env")
	})

	test("exits 3 when ntfy answers with an error status", async () => {
		const { context } = makeListingHarness()
		const { ping } = deps({ FRONTDESK_NTFY_URL: "http://x", FRONTDESK_NTFY_TOPIC: "t" }, 401)

		const failure = await failureOf(runWith(ping, ["hello"], context))

		expect(failure.code).toBe(3)
		expect(failure.message).toContain("HTTP 401")
	})

	test("exits 2 without a message", async () => {
		const { context } = makeListingHarness()

		expect((await failureOf(runWith(deps({}).ping, [], context))).code).toBe(2)
	})
})
