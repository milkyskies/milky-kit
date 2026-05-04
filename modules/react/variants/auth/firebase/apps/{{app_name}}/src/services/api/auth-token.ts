import { firebaseAuth } from "@/services/firebase/firebase";

// Returns the current user's Firebase ID token (or null if signed out).
// `forceRefresh` triggers a fresh token from Firebase — used by api/client.ts
// to retry once on 401, handling clock skew + tokens that expired mid-flight.
export const getApiToken = async (options?: {
	forceRefresh?: boolean;
}): Promise<string | null> => {
	const user = firebaseAuth.currentUser;
	if (!user) return null;

	try {
		return await user.getIdToken(options?.forceRefresh ?? false);
	} catch {
		return null;
	}
};
