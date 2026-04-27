import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: () => <Outlet />,
	errorComponent: ({ error, reset }) => (
		<div className="max-w-2xl mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
			<pre className="bg-red-50 border border-red-200 rounded p-3 text-sm overflow-auto">
				{error instanceof Error ? error.message : String(error)}
			</pre>
			<button
				type="button"
				onClick={reset}
				className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
			>
				Retry
			</button>
		</div>
	),
	notFoundComponent: () => (
		<div className="max-w-2xl mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-bold">Not found</h1>
			<p className="text-gray-600">
				The page you're looking for doesn't exist.
			</p>
		</div>
	),
});
