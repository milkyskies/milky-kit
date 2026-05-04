import { firebaseAuth } from "@/services/firebase/firebase";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";

export const Route = createFileRoute("/_public/sign-in/")({
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setPending] = useState(false);

	const handleSubmit = async (formEvent: React.FormEvent) => {
		formEvent.preventDefault();
		setError(null);
		setPending(true);

		try {
			await signInWithEmailAndPassword(firebaseAuth, email, password);
			navigate({ to: "/" });
		} catch (caught) {
			setError(
				caught instanceof FirebaseError
					? caught.message
					: "Sign-in failed",
			);
		} finally {
			setPending(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<h1 className="text-2xl font-bold">Sign in</h1>
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
				className="w-full rounded-lg border px-3 py-2"
			/>
			{error && <p className="text-sm text-red-600">{error}</p>}
			<button
				type="submit"
				disabled={isPending}
				className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
			>
				{isPending ? "Signing in..." : "Sign in"}
			</button>
			<p className="text-center text-sm">
				No account?{" "}
				<Link to="/sign-up" className="font-medium underline">
					Sign up
				</Link>
			</p>
		</form>
	);
}
