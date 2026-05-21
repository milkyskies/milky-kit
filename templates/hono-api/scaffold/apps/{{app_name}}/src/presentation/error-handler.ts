import { Match } from "effect"
import type { ErrorHandler } from "hono"
import { UserAlreadyExists } from "../application/errors"

// Maps domain/application errors to HTTP responses. Add cases as the
// app grows; default falls through to a logged 500.
export const errorHandler: ErrorHandler = (error, context) => {
	const mapped = Match.value(error).pipe(
		Match.when(Match.instanceOf(UserAlreadyExists), (taggedError) => ({
			status: 409 as const,
			body: {
				error: taggedError._tag,
				firebaseUid: taggedError.firebaseUid,
			},
		})),
		Match.option,
	)

	if (mapped._tag === "Some") {
		return context.json(mapped.value.body, mapped.value.status)
	}

	// Drizzle / postgres-js wrap the real failure in a `cause` chain.
	// `console.error(error)` alone prints only the top-level message,
	// hiding the diagnostic text we actually need. Walk the chain.
	console.error("[unhandled]", error)
	let cursor: unknown = error instanceof Error ? error.cause : undefined
	let depth = 0
	while (cursor && depth < 5) {
		console.error(`[unhandled.cause.${depth}]`, cursor)
		cursor = cursor instanceof Error ? cursor.cause : undefined
		depth += 1
	}
	return context.json({ error: "InternalServerError" }, 500)
}
