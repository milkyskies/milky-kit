import type { Bindings } from "./env"

// Hono reads configuration from `context.env`, which Workers fills from wrangler bindings; on Bun the process environment fills it instead.
export const readBindings = (source: Record<string, string | undefined>): Bindings => ({
	CORS_ORIGINS: source.CORS_ORIGINS ?? "",
})
