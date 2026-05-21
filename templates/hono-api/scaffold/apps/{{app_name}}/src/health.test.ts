import { describe, expect, it } from "vitest"

describe("health", () => {
	it("the test runtime works", () => {
		expect({ status: "ok" }.status).toBe("ok")
	})
})
