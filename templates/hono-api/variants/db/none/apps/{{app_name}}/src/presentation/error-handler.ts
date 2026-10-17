import type { ErrorHandler } from "hono"

// Maps domain/application errors to HTTP responses. Add cases as the app grows; the default falls through to a logged 500.
export const errorHandler: ErrorHandler = (error, context) => {
	console.error("[unhandled]", error)
	return context.json({ error: "InternalServerError" }, 500)
}
