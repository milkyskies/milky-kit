import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Match } from "effect";

// Authed routes — signed-out users get bounced to sign-in.
// `useAuth()` suspends in main.tsx, so by the time beforeLoad runs the
// auth state is always settled (SignedIn or SignedOut, never Loading).
export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context }) => {
		Match.value(context.auth).pipe(
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
