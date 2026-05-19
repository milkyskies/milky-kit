import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/_onboarded/_home/")({
	component: IndexPage,
});

function IndexPage() {
	return <Navigate to="/posts" />;
}
