import { Config, Redacted } from "effect"

/**
 * All runtime configuration goes through Config. Reads are Effects;
 * failures are typed ConfigError and surface at app boot. Secrets use
 * Config.redacted so they cannot be printed by accident.
 */
export const AppConfig = Config.all({
	databaseUrl: Config.redacted("DATABASE_URL"),
	port: Config.integer("PORT").pipe(Config.withDefault(3000)),
	logLevel: Config.literal("debug", "info", "warn", "error")("LOG_LEVEL").pipe(
		Config.withDefault("info" as const),
	),
	logFormat: Config.literal("pretty", "json")("LOG_FORMAT").pipe(
		Config.withDefault("pretty" as const),
	),
})

export type AppConfig = Config.Config.Success<typeof AppConfig>

// Helper for the SQL layer: take the redacted URL, unwrap at call site.
export const unwrapDatabaseUrl = (databaseUrl: Redacted.Redacted<string>): string =>
	Redacted.value(databaseUrl)
