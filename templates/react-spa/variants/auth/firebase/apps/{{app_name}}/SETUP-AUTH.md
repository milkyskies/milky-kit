# Firebase Auth Setup (client)

The auth=firebase variant scaffolded:
- `services/firebase/firebase.ts` — initializes the Firebase Web SDK
- `services/api/auth-token.ts` — gets the current user's ID token (consumed by `services/api/client.ts` which is in base scaffold)
- `features/auth/use-auth.ts` — `useAuth()` hook returning a `Data.TaggedEnum<{ Loading, SignedIn, SignedOut }>`
- `app/routes/_authed/route.tsx` — route guard that redirects to `/sign-in` when SignedOut
- `package.json` overlay: `firebase`
- `.env.example` overlay: `VITE_FIREBASE_*` blob

## Manual setup

### 1. Create a Web app in your Firebase project

Firebase Console → your project → Project settings → General → Your apps → Add app → **Web**. Copy the SDK config blob.

### 2. Wire `.env`

```bash
cd apps/{{app_name}}
cp .env.example .env
# Paste the Web SDK config values into the VITE_FIREBASE_* fields
```

### 3. Wire the auth state into the router context

Open `apps/{{app_name}}/src/main.tsx` and switch to the auth-aware pattern:

```tsx
import { AuthState, useAuth } from "@/features/auth/use-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./app/routeTree.gen";

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
});

const router = createRouter({
	routeTree,
	context: { auth: AuthState.Loading() },
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	const auth = useAuth();
	return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById("app")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</StrictMode>,
);
```

### 4. Type the router context

In `__root.tsx`, switch from `createRootRoute` to `createRootRouteWithContext<RouterContext>` so `_authed/route.tsx`'s `beforeLoad` can read `context.auth`:

```tsx
import type { AuthState } from "@/features/auth/use-auth";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

export interface RouterContext {
	auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => (/* ... existing AppProviders + Outlet wrapper ... */),
	// ... existing errorComponent + notFoundComponent
});
```

### 5. Build a sign-in route

Create `apps/{{app_name}}/src/app/routes/sign-in.tsx` using `signInWithEmailAndPassword` (or your chosen provider) from `firebase/auth`. Beyond the auth side, the rest of UX is up to your design.

### 6. Run

```bash
pnpm install   # picks up the firebase dep
pnpm routes:generate
pnpm dev
```

## How it flows in production

- Client signs in via Firebase → gets an ID token (JWT, ~1h).
- `services/api/client.ts` calls `getApiToken()` → attaches `Authorization: Bearer <id-token>` to every API call.
- On 401 → force-refresh + retry once (handles clock skew + mid-flight expiry).
- Backend (`auth=firebase` on hono) verifies the token, upserts the user via `findOrCreateUserFromFirebase`, sets `context.var.userId`.

## Optional: Firebase Auth Emulator for local dev

If you don't want to hit production Firebase from local dev, run the emulator:

```bash
firebase emulators:start --only auth
```

In `services/firebase/firebase.ts` (after `getAuth(...)`), conditionally wire it up:

```ts
import { connectAuthEmulator } from "firebase/auth";
if (env.VITE_FIREBASE_USE_EMULATOR === "true") {
	connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", { disableWarnings: true });
}
```

Then add `VITE_FIREBASE_USE_EMULATOR=true` to `.env` for local dev. The backend's `auth=firebase` variant has the matching emulator setup in its `SETUP-AUTH.md`.
