import { describe, expect, it } from "vitest"
import { getStatus } from "./get-status"

describe("getStatus", () => {
	it("reports whole seconds since the service started", () => {
		const startedAt = new Date("2026-01-01T00:00:00.000Z")
		const now = new Date("2026-01-01T00:01:30.900Z")

		expect(getStatus(startedAt, now).uptimeSeconds).toBe(90)
	})

	it("never reports negative uptime when the clock steps backwards", () => {
		const startedAt = new Date("2026-01-01T00:00:10.000Z")
		const now = new Date("2026-01-01T00:00:00.000Z")

		expect(getStatus(startedAt, now).uptimeSeconds).toBe(0)
	})
})
