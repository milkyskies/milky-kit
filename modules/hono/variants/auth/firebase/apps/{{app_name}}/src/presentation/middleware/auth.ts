import { Option } from "effect";
import { Auth, WorkersKVStoreSingle } from "firebase-auth-cloudflare-workers";
import { createMiddleware } from "hono/factory";
import { findOrCreateUserFromFirebase } from "../../application/use-case/find-or-create-user-from-firebase";
import type { Bindings } from "../../infrastructure/env";
import type { RepositoryVariables } from "./repositories";

export type AuthVariables = {
	userId: string;
};

export const authMiddleware = createMiddleware<{
	Bindings: Bindings;
	Variables: RepositoryVariables & AuthVariables;
}>(async (context, next) => {
	const header = context.req.header("Authorization");
	if (!header || !header.startsWith("Bearer ")) {
		return context.json({ error: "Unauthorized" }, 401);
	}
	const idToken = header.slice("Bearer ".length);

	const keyStore = WorkersKVStoreSingle.getOrInitialize(
		"firebase-jwks",
		context.env.JWK_CACHE,
	);
	const auth = Auth.getOrInitialize(context.env.FIREBASE_PROJECT_ID, keyStore);

	let firebaseToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
	try {
		firebaseToken = await auth.verifyIdToken(idToken, false, {
			FIREBASE_AUTH_EMULATOR_HOST: context.env.FIREBASE_AUTH_EMULATOR_HOST,
		});
	} catch (error) {
		console.warn("Firebase token verification failed", error);
		return context.json({ error: "Invalid token" }, 401);
	}

	const user = await findOrCreateUserFromFirebase(context.var.userRepository, {
		firebaseUid: firebaseToken.uid,
		email: Option.fromNullable(firebaseToken.email ?? null),
		displayName: Option.fromNullable(firebaseToken.name ?? null),
		avatarUrl: Option.fromNullable(firebaseToken.picture ?? null),
	});

	context.set("userId", user.id);
	await next();
});
