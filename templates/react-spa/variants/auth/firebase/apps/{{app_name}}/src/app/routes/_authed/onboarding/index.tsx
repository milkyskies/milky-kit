import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useCreateMe } from "@/services/api/me/use-create-me"

export const Route = createFileRoute("/_authed/onboarding/")({
	component: OnboardingPage,
})

function OnboardingPage() {
	const navigate = useNavigate()
	const createMe = useCreateMe()
	const [displayName, setDisplayName] = useState("")
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (formEvent: React.FormEvent) => {
		formEvent.preventDefault()
		setError(null)

		try {
			await createMe.mutateAsync({ displayName: displayName.trim() })
			navigate({ to: "/" })
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to create profile")
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-6">
			<form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
				<h1 className="text-2xl font-bold">Pick a display name</h1>
				<p className="text-sm text-gray-600">This is how you'll appear to others.</p>
				<input
					type="text"
					placeholder="Display name"
					value={displayName}
					onChange={(changeEvent) => setDisplayName(changeEvent.target.value)}
					required
					minLength={1}
					maxLength={40}
					className="w-full rounded-lg border px-3 py-2"
				/>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<button
					type="submit"
					disabled={createMe.isPending}
					className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
				>
					{createMe.isPending ? "Creating..." : "Continue"}
				</button>
			</form>
		</div>
	)
}
