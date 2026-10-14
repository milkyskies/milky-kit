import { PgClient } from "@effect/sql-pg"
import { Effect, Layer } from "effect"
import { AppConfig } from "../config"

export const SqlLive = Layer.unwrap(
	Effect.gen(function* () {
		const config = yield* AppConfig

		return PgClient.layer({ url: config.databaseUrl })
	}),
)
