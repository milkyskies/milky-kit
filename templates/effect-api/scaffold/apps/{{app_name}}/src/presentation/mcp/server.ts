import { BunStdio } from "@effect/platform-bun"
import { Layer } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { McpToolkitsLive } from "./toolkits"

const SERVER_INFO = {
	name: "{{project_name}}-api",
	version: "0.0.0",
	protocols: [McpProtocol.v2025_11_25],
} as const

export const McpServerHttpLive = McpToolkitsLive.pipe(
	Layer.provide(McpServer.layerHttp({ ...SERVER_INFO, path: "/mcp" })),
)

export const McpServerStdioLive = McpToolkitsLive.pipe(
	Layer.provide(McpServer.layerStdio(SERVER_INFO)),
	Layer.provide(BunStdio.layer),
)
