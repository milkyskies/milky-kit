import { cors } from "hono/cors"
import { createMiddleware } from "hono/factory"
import type { Bindings } from "../../infrastructure/env"

// Reads allowed origins from `CORS_ORIGINS` (comma-separated) on env.
// Set per-environment in wrangler.jsonc `vars` (prod) and `.dev.vars` (local).
// Empty / unset => no CORS headers (Hono's cors() will reject all cross-origin
// requests, which is the safe default if you forgot to set it).
export const corsMiddleware = createMiddleware<{ Bindings: Bindings }>(async (context, next) => {
	const allowed = context.env.CORS_ORIGINS.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)

	return cors({
		origin: (origin) => (allowed.includes(origin) ? origin : null),
		allowHeaders: ["Authorization", "Content-Type"],
		allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
		credentials: false,
	})(context, next)
})
