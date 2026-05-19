import { Option } from "effect";
import { createMiddleware } from "hono/factory";
import { findUserByFirebaseUid } from "../../application/use-case/find-user-by-firebase-uid";
import type { Bindings } from "../../infrastructure/env";
import type { AuthVariables } from "./auth";
import type { RepositoryVariables } from "./repositories";

export type RequireUserVariables = {
	userId: string;
};

// Short TTL: balances DB-lookup avoidance against picking up user-row
// changes in a reasonable window. KV propagates globally in ~60s, and
// internal user ids are stable once assigned, so a hit is safe.
// Negative results (ProfileRequired) are NOT cached — a user creating
// their profile shouldn't keep getting 409 for 5 minutes after signup.
const USER_CACHE_TTL_SECONDS = 300;

export const requireUserMiddleware = createMiddleware<{
	Bindings: Bindings;
	Variables: RepositoryVariables & AuthVariables & RequireUserVariables;
}>(async (context, next) => {
	const cacheKey = `user-by-firebase:${context.var.firebaseUid}`;
	const cachedUserId = await context.env.USER_CACHE.get(cacheKey);

	if (cachedUserId) {
		context.set("userId", cachedUserId);
		await next();
		return;
	}

	const user = await findUserByFirebaseUid(
		context.var.userRepository,
		context.var.firebaseUid,
	);

	if (Option.isNone(user)) {
		return context.json({ error: "ProfileRequired" }, 409);
	}

	await context.env.USER_CACHE.put(cacheKey, user.value.id, {
		expirationTtl: USER_CACHE_TTL_SECONDS,
	});

	context.set("userId", user.value.id);
	await next();
});
