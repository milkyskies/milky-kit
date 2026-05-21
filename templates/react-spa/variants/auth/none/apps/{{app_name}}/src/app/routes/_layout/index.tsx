import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/")({
	component: IndexPage,
})

function IndexPage() {
	return <Navigate to="/posts" />
}
