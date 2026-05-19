import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	driver: "d1-http",
	schema: "./src/infrastructure/db/schema.ts",
	out: "./drizzle/migrations",
});
