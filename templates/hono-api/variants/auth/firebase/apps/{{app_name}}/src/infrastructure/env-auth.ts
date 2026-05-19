import type { KVNamespace } from "@cloudflare/workers-types";

export type AuthBindings = {
	FIREBASE_PROJECT_ID: string;
	// Caches Google's JWKS for Firebase ID token signature verification.
	JWK_CACHE: KVNamespace;
	// Caches `firebaseUid -> internal userId` so authed requests skip the
	// DB roundtrip on warm sessions. Short TTL (~5 min) keeps it fresh for
	// the rare case where a user row changes; KV propagates globally in ~60s.
	USER_CACHE: KVNamespace;
	// Optional: when set, ID tokens are verified against the Firebase Auth
	// emulator instead of Google's production JWKS.
	FIREBASE_AUTH_EMULATOR_HOST?: string;
};
