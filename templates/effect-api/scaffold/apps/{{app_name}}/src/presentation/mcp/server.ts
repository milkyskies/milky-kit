import { McpServer } from "@effect/ai"
import { Layer } from "effect"
import { PostsToolHandlersLive, PostsToolkit } from "./post-tools"

/**
 * MCP server Layer. Same use cases as HTTP, different transport.
 * Stdio transport is the default for Claude Desktop / Claude Code.
 * Add SSE / Streamable HTTP transports if exposing over a network.
 */
export const McpServerLive = McpServer.layerStdio({
	name: "{{project_name}}-api",
	version: "0.0.0",
	stdin: process.stdin,
	stdout: process.stdout,
}).pipe(Layer.provide(PostsToolkit.toLayer(PostsToolHandlersLive)))
