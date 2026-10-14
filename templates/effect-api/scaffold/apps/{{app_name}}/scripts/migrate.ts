import { BunRuntime } from "@effect/platform-bun"
import { PgClient } from "@effect/sql-pg"
import { makeWithDefaults } from "drizzle-orm/effect-postgres"
import { migrate } from "drizzle-orm/effect-postgres/migrator"
import { Config, Effect, Layer } from "effect"

const SqlLive = Layer.unwrap(
	Effect.gen(function* () {
		const url = yield* Config.Redacted("DATABASE_URL")

		return PgClient.layer({ url })
	}),
)

const program = Effect.gen(function* () {
	const db = yield* makeWithDefaults()

	yield* migrate(db, { migrationsFolder: "./drizzle/migrations" })
	yield* Effect.logInfo("migrations applied")
}).pipe(Effect.provide(SqlLive))

BunRuntime.runMain(program)
