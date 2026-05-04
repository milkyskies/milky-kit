// Generic full-viewport spinner. Use as a Suspense fallback when the
// suspended boundary covers the whole page (auth bootstrap, initial
// data load, etc.). Inline `<div>Loading…</div>` is fine for smaller
// boundaries scoped to a section.
export function FullPageLoader() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
		</div>
	);
}
