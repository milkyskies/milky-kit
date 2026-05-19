import { defineConfig } from "drizzle-kit"

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/infrastructure/db/schema.ts",
	out: "./drizzle/migrations",
	dbCredentials: {
		// drizzle-kit reads DATABASE_URL from process.env directly. The
		// Effect Config layer is only used at runtime; migration tooling
		// runs outside the Effect runtime.
		url: process.env.DATABASE_URL ?? "",
	},
	verbose: true,
	strict: true,
})
