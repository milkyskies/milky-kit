import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		TanStackRouterVite({
			target: "react",
			autoCodeSplitting: true,
			routesDirectory: "./src/app/routes",
		}),
		react(),
	],
	server: {
		// Bind to 0.0.0.0 so phones / tablets / Capacitor live-reload on the
		// same Wi-Fi can hit `http://<lan-ip>:5173`. Default `localhost` bind
		// blocks LAN access. Safe because (1) the API's CORS_ORIGINS still
		// gates cross-origin reads and (2) pnpm.overrides pins esbuild to a
		// version without the dev-server SSRF advisory.
		host: true,
		proxy: {
			"/api": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		alias: {
			"@/": new URL("./src/", import.meta.url).pathname,
		},
	},
});
