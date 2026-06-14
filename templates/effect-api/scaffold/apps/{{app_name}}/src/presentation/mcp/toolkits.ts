import { McpServer } from "@effect/ai"
import { Layer } from "effect"
import { PostsToolHandlersLive, PostsToolkit } from "./post-tools"

/**
 * Toolkits registered against the McpServer, transport-agnostic. The concrete
 * transport (stdio for local Claude Code, HTTP for the running server) is provided
 * by the caller, so both surfaces expose the identical tool set. Add more toolkits
 * to the merge as the agent surface grows.
 */
export const McpToolkitsLive = Layer.mergeAll(
	McpServer.toolkit(PostsToolkit).pipe(Layer.provide(PostsToolHandlersLive)),
)

export const MCP_SERVER_INFO = { name: "{{project_name}}-api", version: "0.0.0" } as const
