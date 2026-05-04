import type { KVNamespace } from "@cloudflare/workers-types";

export type AuthBindings = {
	FIREBASE_PROJECT_ID: string;
	// Caches Google's JWKS for Firebase ID token verification.
	JWK_CACHE: KVNamespace;
	// Optional: when set, ID tokens are verified against the Firebase Auth
	// emulator instead of Google's production JWKS.
	FIREBASE_AUTH_EMULATOR_HOST?: string;
};
