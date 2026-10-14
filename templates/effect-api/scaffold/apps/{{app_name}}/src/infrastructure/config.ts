import { Config } from "effect"

export const AppConfig = Config.all({
	databaseUrl: Config.Redacted("DATABASE_URL"),
	port: Config.Port("PORT").pipe(Config.withDefault(3000)),
	logLevel: Config.LogLevel("LOG_LEVEL").pipe(Config.withDefault("Info" as const)),
	logFormat: Config.Literals(["pretty", "json"], "LOG_FORMAT").pipe(
		Config.withDefault("pretty" as const),
	),
})
