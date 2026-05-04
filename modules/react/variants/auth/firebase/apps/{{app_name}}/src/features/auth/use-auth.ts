import { firebaseAuth } from "@/services/firebase/firebase";
import { Data } from "effect";
import { type User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { use, useSyncExternalStore } from "react";

// `authStateReady()` resolves once Firebase has determined the initial
// auth state (signed in or out). Cached at module scope so React 19's
// `use(authReady)` gets a stable promise reference across renders and
// Suspense unwinds it once.
const authReady = firebaseAuth.authStateReady();

const subscribe = (callback: () => void) =>
	onAuthStateChanged(firebaseAuth, callback);

const getSnapshot = () => firebaseAuth.currentUser;

// No `Loading` tag — `useAuth()` suspends until the first auth state is
// known, so consumers below the Suspense boundary only ever see a
// settled state. Simpler route guards (no Loading arm to handle).
export type AuthState = Data.TaggedEnum<{
	SignedIn: { readonly user: FirebaseUser };
	SignedOut: object;
}>;

export const AuthState = Data.taggedEnum<AuthState>();

export function useAuth(): AuthState {
	// Suspends until Firebase resolves the initial auth state. After that,
	// the same promise resolves immediately on every subsequent render.
	use(authReady);

	const user = useSyncExternalStore(subscribe, getSnapshot);

	return user ? AuthState.SignedIn({ user }) : AuthState.SignedOut();
}
