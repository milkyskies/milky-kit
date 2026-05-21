import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { Option } from "effect"
import { meQueryOptions } from "@/services/api/me/me-query-options"

// Authed AND has a profile. If the auth=firebase user just signed up but
// hasn't filled in their displayName yet, they're sent to /onboarding.
export const Route = createFileRoute("/_authed/_onboarded")({
	beforeLoad: async ({ context }) => {
		const me = await context.queryClient.ensureQueryData(meQueryOptions)
		if (Option.isNone(me)) {
			throw redirect({ to: "/onboarding" })
		}
	},
	component: OnboardedLayout,
})

function OnboardedLayout() {
	return <Outlet />
}
