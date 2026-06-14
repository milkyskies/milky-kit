import { McpServer } from "@effect/ai"
import { BunSink, BunStream } from "@effect/platform-bun"
import { Layer } from "effect"
import { MCP_SERVER_INFO, McpToolkitsLive } from "./toolkits"

/**
 * MCP over stdio — the transport Claude Code / Claude Desktop launch as a
 * subprocess. The running HTTP server exposes the same tools over HTTP at /mcp
 * (see presentation/http/server.ts); both share McpToolkitsLive.
 */
export const McpServerLive = McpToolkitsLive.pipe(
	Layer.provide(
		McpServer.layerStdio({
			...MCP_SERVER_INFO,
			stdin: BunStream.stdin,
			stdout: BunSink.stdout,
		}),
	),
)
