import { McpServer } from "@effect/ai"
import { HttpApiSwagger, HttpLayerRouter } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { AppConfig } from "@/infrastructure/config"
import { MCP_SERVER_INFO, McpToolkitsLive } from "@/presentation/mcp/toolkits"
import { PostsApi } from "./api"
import { PostsHandlersLive } from "./post-handlers"

/**
 * One Bun server, two surfaces on one port, composed on a single HttpLayerRouter:
 *   - REST API under /api (OpenAPI spec at /api/openapi.json, Swagger UI at /docs)
 *     — the web-client seam.
 *   - MCP over Streamable HTTP at /mcp — the same tools the stdio server exposes,
 *     so a running server is reachable by an HTTP MCP client.
 *
 * The stdio MCP transport stays in presentation/mcp/server.ts for local Claude
 * Code; it can't share this process because stdout is its protocol wire.
 */
const ApiRoutes = HttpLayerRouter.addHttpApi(PostsApi, {
	openapiPath: "/api/openapi.json",
}).pipe(Layer.provide(PostsHandlersLive))

const McpRoutes = McpToolkitsLive.pipe(
	Layer.provide(McpServer.layerHttpRouter({ ...MCP_SERVER_INFO, path: "/mcp" })),
)

const SwaggerRoutes = HttpApiSwagger.layerHttpLayerRouter({ api: PostsApi, path: "/docs" })

export const HttpServerLive = HttpLayerRouter.serve(
	Layer.mergeAll(ApiRoutes, McpRoutes, SwaggerRoutes),
).pipe(
	Layer.provide(
		Layer.unwrapEffect(
			Effect.gen(function* () {
				const config = yield* AppConfig
				return BunHttpServer.layer({ port: config.port })
			}),
		),
	),
)
