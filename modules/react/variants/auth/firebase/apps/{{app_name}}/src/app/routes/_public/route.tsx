import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Match } from "effect";

// Public routes (sign-in, sign-up). Signed-in users are redirected home.
export const Route = createFileRoute("/_public")({
	beforeLoad: ({ context }) => {
		Match.value(context.auth).pipe(
			Match.tag("SignedIn", () => {
				throw redirect({ to: "/" });
			}),
			Match.tag("Loading", () => {}),
			Match.tag("SignedOut", () => {}),
			Match.exhaustive,
		);
	},
	component: PublicLayout,
});

function PublicLayout() {
	return (
		<div className="flex min-h-screen items-center justify-center p-6">
			<div className="w-full max-w-sm">
				<Outlet />
			</div>
		</div>
	);
}
