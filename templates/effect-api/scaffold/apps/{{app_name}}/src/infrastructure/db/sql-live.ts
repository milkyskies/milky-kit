import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted } from "effect"
import { AppConfig } from "@/infrastructure/config"

/**
 * Postgres client layer. `PgClient.layer` is Layer.scoped under the
 * hood: the connection pool is acquired on layer build and released on
 * scope close (typically app shutdown). Per-request acquire/release is
 * handled by the pool internally — no middleware writing needed.
 */
export const SqlLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const config = yield* AppConfig
		return PgClient.layer({
			url: config.databaseUrl,
			transformQueryNames: undefined,
		})
	}),
)

// Helper for places that need the raw URL string (e.g. drizzle-kit).
export const databaseUrl = AppConfig.pipe(
	Effect.map((config) => Redacted.value(config.databaseUrl)),
)
