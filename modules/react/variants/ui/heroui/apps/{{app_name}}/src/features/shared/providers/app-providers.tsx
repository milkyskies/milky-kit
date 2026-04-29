import { I18nProvider, RouterProvider } from "@heroui/react";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AppProvidersProps {
	children: ReactNode;
}

export function AppProviders(props: AppProvidersProps) {
	const router = useRouter();

	return (
		<I18nProvider locale="en">
			<RouterProvider navigate={(to) => router.navigate({ to })}>
				{props.children}
			</RouterProvider>
		</I18nProvider>
	);
}
