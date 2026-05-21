import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/_onboarded/_home")({
	component: HomeLayout,
})

function HomeLayout() {
	return (
		<div className="min-h-screen flex flex-col">
			<nav className="border-b px-6 py-3 flex items-center gap-6">
				<span className="font-semibold text-lg">{"{{project_name}}"}</span>
			</nav>
			<main className="flex-1 p-6">
				<Outlet />
			</main>
		</div>
	)
}
