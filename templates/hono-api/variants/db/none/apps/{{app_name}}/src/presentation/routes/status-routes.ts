import { Hono } from "hono"
import { getStatus } from "../../application/use-case/get-status"
import type { Bindings } from "../../infrastructure/env"

// Module scope, so the clock starts when the process (or Workers isolate) loads.
const startedAt = new Date()

export const statusRoutes = new Hono<{ Bindings: Bindings }>().get("/api/status", (context) => {
	const { status, uptimeSeconds } = getStatus(startedAt, new Date())
	return context.json({ status, uptimeSeconds })
})
