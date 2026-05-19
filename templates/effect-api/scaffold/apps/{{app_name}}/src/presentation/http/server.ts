import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { AppConfig } from "@/infrastructure/config"
import { PostsApi } from "./api"
import { PostsHandlersLive } from "./post-handlers"

const ApiLive = HttpApiBuilder.api(PostsApi).pipe(Layer.provide(PostsHandlersLive))

/**
 * HTTP server Layer. Composes:
 *   - The API definition (PostsApi)
 *   - The handler implementations (PostsHandlersLive)
 *   - Swagger UI at /docs (OpenAPI generated from PostsApi)
 *   - The Bun HTTP server bound to the configured port
 *   - Standard middleware (CORS, logging)
 */
export const HttpServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
	Layer.provide(HttpApiSwagger.layer({ path: "/docs" })),
	Layer.provide(ApiLive),
	Layer.provide(
		Layer.unwrapEffect(
			Effect.gen(function* () {
				const config = yield* AppConfig
				return BunHttpServer.layer({ port: config.port })
			}),
		),
	),
	HttpServer.withLogAddress,
)
