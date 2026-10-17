import { describe, expect, it } from "vitest"
import { app } from "./app"

const env = { CORS_ORIGINS: "http://allowed.test" }

describe("app", () => {
	it("serves the status route", async () => {
		const response = await app.request("/api/status", {}, env)

		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({ status: "ok" })
	})

	it("allows a listed CORS origin and withholds the header from others", async () => {
		const allowed = await app.request(
			"/api/status",
			{ headers: { Origin: "http://allowed.test" } },
			env,
		)
		const other = await app.request(
			"/api/status",
			{ headers: { Origin: "http://other.test" } },
			env,
		)

		expect(allowed.headers.get("access-control-allow-origin")).toBe("http://allowed.test")
		expect(other.headers.get("access-control-allow-origin")).toBeNull()
	})
})
