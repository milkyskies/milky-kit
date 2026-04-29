import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL is required (set it in .env for drizzle-kit)");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/infrastructure/db/schema.ts",
	out: "./drizzle/migrations",
	dbCredentials: { url: databaseUrl },
});
