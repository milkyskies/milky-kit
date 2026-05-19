import { Effect, Layer, Logger, LogLevel } from "effect"
import { AppConfig } from "./config"

/**
 * Logger Layer: reads LOG_LEVEL and LOG_FORMAT from Config and provides
 * the corresponding Effect Logger. `pretty` is human-readable for dev;
 * `json` is structured for production log aggregators.
 */
export const LoggerLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const config = yield* AppConfig
		const level = LogLevel.fromLiteral(config.logLevel)
		const logger = config.logFormat === "json" ? Logger.jsonLogger : Logger.prettyLogger()

		return Layer.merge(Logger.minimumLogLevel(level), Logger.replace(Logger.defaultLogger, logger))
	}),
)
