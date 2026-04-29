import type { ReactNode } from "react";

interface AppProvidersProps {
	children: ReactNode;
}

// Base UI is unstyled and provider-less — children pass through.
// If you add app-level providers (Theme, I18n, etc.) later, wrap them here.
export function AppProviders(props: AppProvidersProps) {
	return <>{props.children}</>;
}
