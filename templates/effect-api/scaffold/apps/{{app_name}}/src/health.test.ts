import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

describe("health", () => {
	it.effect("the test runtime works", () =>
		Effect.gen(function* () {
			const result = yield* Effect.succeed({ status: "ok" })
			expect(result.status).toBe("ok")
		}),
	)
})
