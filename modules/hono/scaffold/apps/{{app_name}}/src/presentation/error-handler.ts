import { Match } from "effect";
import type { ErrorHandler } from "hono";
import { UserAlreadyExists } from "../application/errors";

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
	);

	if (mapped._tag === "Some") {
		return context.json(mapped.value.body, mapped.value.status);
	}

	console.error(error);
	return context.json({ error: "InternalServerError" }, 500);
};
