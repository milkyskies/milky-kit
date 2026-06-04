import { Effect, Layer, Logger, LogLevel } from "effect"
import { AppConfig } from "./config"

// AppConfig uses lowercase LOG_LEVEL literals; LogLevel.fromLiteral wants the capitalized names.
const LOG_LEVELS = {
	debug: "Debug",
	info: "Info",
	warn: "Warning",
	error: "Error",
} as const

/**
 * Logger Layer: reads LOG_LEVEL and LOG_FORMAT from Config and provides
 * the corresponding Effect Logger. `pretty` is human-readable for dev;
 * `json` is structured for production log aggregators.
 */
export const LoggerLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const config = yield* AppConfig
		const level = LogLevel.fromLiteral(LOG_LEVELS[config.logLevel])
		const logger = config.logFormat === "json" ? Logger.jsonLogger : Logger.prettyLogger()

		return Layer.merge(Logger.minimumLogLevel(level), Logger.replace(Logger.defaultLogger, logger))
	}),
)
