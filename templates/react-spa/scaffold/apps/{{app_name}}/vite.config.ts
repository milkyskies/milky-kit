import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			routesDirectory: "./src/app/routes",
		}),
		react(),
	],
	server: {
		// Bind to 0.0.0.0 so phones, tablets and Capacitor live-reload on the same Wi-Fi can reach http://<lan-ip>:5173; the default localhost bind blocks LAN access. Safe because the API's CORS_ORIGINS still gates cross-origin reads.
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
})
