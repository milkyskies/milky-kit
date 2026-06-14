/**
 * Applies pending drizzle migrations, then exits. Uses drizzle-orm's programmatic
 * migrator (Bun-native — no drizzle-kit, no Node), reading the same
 * drizzle/migrations folder drizzle-kit generates. Run on container start before
 * the server (see Dockerfile) so deploys self-migrate; already-applied migrations
 * are skipped via the __drizzle_migrations table.
 */
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required")
}

const main = async () => {
	const client = postgres(databaseUrl, { max: 1 })
	const db = drizzle(client)

	await migrate(db, { migrationsFolder: "./drizzle/migrations" })
	await client.end()

	console.log("migrations applied")
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
