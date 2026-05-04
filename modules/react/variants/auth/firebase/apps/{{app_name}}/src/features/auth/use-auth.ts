import { firebaseAuth } from "@/services/firebase/firebase";
import { Data } from "effect";
import { type User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

export type AuthState = Data.TaggedEnum<{
	Loading: object;
	SignedIn: { readonly user: FirebaseUser };
	SignedOut: object;
}>;

export const AuthState = Data.taggedEnum<AuthState>();

export function useAuth(): AuthState {
	const [state, setState] = useState<AuthState>(AuthState.Loading());

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
			setState(user ? AuthState.SignedIn({ user }) : AuthState.SignedOut());
		});
		return unsubscribe;
	}, []);

	return state;
}
