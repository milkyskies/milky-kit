import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { FirebaseError } from "firebase/app"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { useState } from "react"
import { firebaseAuth } from "@/services/firebase/firebase"

export const Route = createFileRoute("/_public/sign-up/")({
	component: SignUpPage,
})

function SignUpPage() {
	const navigate = useNavigate()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [isPending, setPending] = useState(false)

	const handleSubmit = async (formEvent: React.FormEvent) => {
		formEvent.preventDefault()
		setError(null)
		setPending(true)

		try {
			await createUserWithEmailAndPassword(firebaseAuth, email, password)
			navigate({ to: "/onboarding" })
		} catch (caught) {
			setError(caught instanceof FirebaseError ? caught.message : "Sign-up failed")
		} finally {
			setPending(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<h1 className="text-2xl font-bold">Sign up</h1>
			<input
				type="email"
				placeholder="Email"
				value={email}
				onChange={(changeEvent) => setEmail(changeEvent.target.value)}
				required
				className="w-full rounded-lg border px-3 py-2"
			/>
			<input
				type="password"
				placeholder="Password"
				value={password}
				onChange={(changeEvent) => setPassword(changeEvent.target.value)}
				required
				minLength={6}
				className="w-full rounded-lg border px-3 py-2"
			/>
			{error && <p className="text-sm text-red-600">{error}</p>}
			<button
				type="submit"
				disabled={isPending}
				className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
			>
				{isPending ? "Signing up..." : "Sign up"}
			</button>
			<p className="text-center text-sm">
				Already have an account?{" "}
				<Link to="/sign-in" className="font-medium underline">
					Sign in
				</Link>
			</p>
		</form>
	)
}
