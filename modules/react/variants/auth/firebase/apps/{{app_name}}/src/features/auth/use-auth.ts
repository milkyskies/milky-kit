import { firebaseAuth } from "@/services/firebase/firebase";
import { Data } from "effect";
import { type User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { use, useSyncExternalStore } from "react";

// `authStateReady()` resolves once Firebase has determined the initial
// auth state (signed in or out). Cached at module scope so React 19's
// `use(authReady)` gets a stable promise reference across renders and
// Suspense unwinds it once.
const authReady = firebaseAuth.authStateReady();

// No `Loading` tag — `useAuth()` suspends until the first auth state is
// known, so consumers below the Suspense boundary only ever see a
// settled state. Simpler route guards (no Loading arm to handle).
export type AuthState = Data.TaggedEnum<{
	SignedIn: { readonly user: FirebaseUser };
	SignedOut: object;
}>;

export const AuthState = Data.taggedEnum<AuthState>();

const toSnapshot = (user: FirebaseUser | null): AuthState =>
	user ? AuthState.SignedIn({ user }) : AuthState.SignedOut();

// Compare by uid so transient Firebase events (token refresh, persistent
// store rehydration, etc.) that hand us a NEW User object representing the
// SAME logged-in human don't churn the snapshot. Without this, every fresh
// `AuthState.SignedIn({ user })` is a new reference — Object.is says
// "changed", `<App>` re-renders, `<RouterProvider>` gets a new context, and
// in-flight beforeLoad fetches (e.g. /me) get aborted mid-flight.
const sameAuthState = (a: AuthState, b: AuthState): boolean => {
	if (a._tag !== b._tag) return false;
	if (a._tag === "SignedOut") return true;
	const bSignedIn = b as Extract<AuthState, { _tag: "SignedIn" }>;
	return a.user.uid === bSignedIn.user.uid;
};

let snapshot: AuthState = toSnapshot(firebaseAuth.currentUser);
const subscribers = new Set<() => void>();

onAuthStateChanged(firebaseAuth, (user) => {
	const next = toSnapshot(user);
	if (sameAuthState(snapshot, next)) return;
	snapshot = next;
	for (const subscriber of subscribers) subscriber();
});

const subscribe = (callback: () => void) => {
	subscribers.add(callback);
	return () => {
		subscribers.delete(callback);
	};
};

const getSnapshot = () => snapshot;

export function useAuth(): AuthState {
	// Suspends until Firebase resolves the initial auth state. After that,
	// the same promise resolves immediately on every subsequent render.
	use(authReady);

	return useSyncExternalStore(subscribe, getSnapshot);
}
