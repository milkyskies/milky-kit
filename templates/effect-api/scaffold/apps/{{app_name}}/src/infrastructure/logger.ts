import { Effect, Layer, Logger, References } from "effect"
import { AppConfig } from "./config"

export const LoggerLive = Layer.unwrap(
	Effect.gen(function* () {
		const config = yield* AppConfig
		const logger = config.logFormat === "json" ? Logger.consoleJson : Logger.consolePretty()

		return Layer.mergeAll(
			Logger.layer([logger]),
			Layer.succeed(References.MinimumLogLevel, config.logLevel),
		)
	}),
)
