import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Match } from "effect";

// Authed routes — signed-out users get bounced to sign-in.
export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context }) => {
		Match.value(context.auth).pipe(
			Match.tag("Loading", () => {}),
			Match.tag("SignedIn", () => {}),
			Match.tag("SignedOut", () => {
				throw redirect({ to: "/sign-in" });
			}),
			Match.exhaustive,
		);
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	return <Outlet />;
}
