import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout")({
	component: LayoutComponent,
});

function LayoutComponent() {
	return (
		<div className="min-h-screen flex flex-col">
			<nav className="border-b px-6 py-3 flex items-center gap-6">
				<span className="font-semibold text-lg">{"{{project_name}}"}</span>
			</nav>
			<main className="flex-1 p-6">
				<Outlet />
			</main>
		</div>
	);
}
