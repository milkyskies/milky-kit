import { Option } from "effect"
import { Auth, WorkersKVStoreSingle } from "firebase-auth-cloudflare-workers"
import { createMiddleware } from "hono/factory"
import type { Bindings } from "../../infrastructure/env"

// Verifies the Firebase ID token and exposes the claims on context.
// Does NOT do the user lookup — that's `require-user.ts`. This separation
// lets a signup endpoint be authed (firebaseUid available) without
// requiring a profile row to exist yet.
export type AuthVariables = {
	firebaseUid: string
	firebaseEmail: Option.Option<string>
	firebaseName: Option.Option<string>
	firebasePicture: Option.Option<string>
}

export const authMiddleware = createMiddleware<{
	Bindings: Bindings
	Variables: AuthVariables
}>(async (context, next) => {
	const header = context.req.header("Authorization")
	if (!header?.startsWith("Bearer ")) {
		return context.json({ error: "Unauthorized" }, 401)
	}
	const idToken = header.slice("Bearer ".length)

	const keyStore = WorkersKVStoreSingle.getOrInitialize("firebase-jwks", context.env.JWK_CACHE)
	const auth = Auth.getOrInitialize(context.env.FIREBASE_PROJECT_ID, keyStore)

	let firebaseToken: Awaited<ReturnType<typeof auth.verifyIdToken>>
	try {
		firebaseToken = await auth.verifyIdToken(idToken, false, {
			FIREBASE_AUTH_EMULATOR_HOST: context.env.FIREBASE_AUTH_EMULATOR_HOST,
		})
	} catch (error) {
		console.warn("Firebase token verification failed", error)
		return context.json({ error: "Invalid token" }, 401)
	}

	context.set("firebaseUid", firebaseToken.uid)
	context.set("firebaseEmail", Option.fromNullable(firebaseToken.email ?? null))
	context.set("firebaseName", Option.fromNullable(firebaseToken.name ?? null))
	context.set("firebasePicture", Option.fromNullable(firebaseToken.picture ?? null))
	await next()
})
