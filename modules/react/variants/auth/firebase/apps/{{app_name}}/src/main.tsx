import "@/assets/styles.css";

import { AuthState, useAuth } from "@/features/auth/use-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
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
	context: { auth: AuthState.Loading(), queryClient },
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	const auth = useAuth();
	return <RouterProvider router={router} context={{ auth, queryClient }} />;
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element #app not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</StrictMode>,
);
