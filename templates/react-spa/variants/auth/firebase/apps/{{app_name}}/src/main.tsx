import "@/assets/styles.css";

import { useAuth } from "@/features/auth/use-auth";
import { FullPageLoader } from "@/features/shared/components/full-page-loader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode, Suspense, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./app/routeTree.gen";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			retry: 1,
		},
	},
});

const router = createRouter({
	routeTree,
	// Real auth value is supplied by <RouterProvider context={...} /> below.
	// `undefined!` is safe because <App /> is gated behind Suspense — the
	// router never renders until useAuth() has resolved the auth state.
	context: { auth: undefined!, queryClient },
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	const auth = useAuth();
	// Memoize so the context reference only changes when `auth` actually
	// changes. A fresh `{ auth, queryClient }` object on every render makes
	// TanStack Router think the context changed → it cancels in-flight
	// loaders (matches show as `Canceled` in `wrangler tail`).
	const context = useMemo(() => ({ auth, queryClient }), [auth]);
	return <RouterProvider router={router} context={context} />;
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element #app not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<Suspense fallback={<FullPageLoader />}>
				<App />
			</Suspense>
		</QueryClientProvider>
	</StrictMode>,
);
