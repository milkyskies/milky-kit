import { BunHttpServer } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api"
import { AppConfig } from "../../infrastructure/config"
import { McpServerHttpLive } from "../mcp/server"
import { Api } from "./api"
import { PostsHandlersLive } from "./post-handlers"

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/api/openapi.json" }).pipe(
	Layer.provide(PostsHandlersLive),
)

const DocsRoutes = HttpApiScalar.layerCdn(Api, { path: "/api/docs" })

export const HttpServerLive = HttpRouter.serve(
	Layer.mergeAll(ApiRoutes, DocsRoutes, McpServerHttpLive),
).pipe(
	Layer.provide(
		Layer.unwrap(
			Effect.gen(function* () {
				const config = yield* AppConfig

				return BunHttpServer.layer({ port: config.port })
			}),
		),
	),
)
