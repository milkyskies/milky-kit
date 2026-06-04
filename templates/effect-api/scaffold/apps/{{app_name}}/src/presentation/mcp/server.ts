import { McpServer } from "@effect/ai"
import { BunSink, BunStream } from "@effect/platform-bun"
import { Layer } from "effect"
import { PostsToolHandlersLive, PostsToolkit } from "./post-tools"

/**
 * MCP server Layer. Same use cases as HTTP, different transport.
 * Stdio transport is the default for Claude Desktop / Claude Code.
 * Add SSE / Streamable HTTP transports if exposing over a network.
 */
export const McpServerLive = McpServer.toolkit(PostsToolkit).pipe(
	Layer.provide(PostsToolHandlersLive),
	Layer.provide(
		McpServer.layerStdio({
			name: "{{project_name}}-api",
			version: "0.0.0",
			stdin: BunStream.stdin,
			stdout: BunSink.stdout,
		}),
	),
)
