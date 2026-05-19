import type { ReactNode } from "react";

interface AppProvidersProps {
	children: ReactNode;
}

export function AppProviders(props: AppProvidersProps) {
	return <>{props.children}</>;
}
