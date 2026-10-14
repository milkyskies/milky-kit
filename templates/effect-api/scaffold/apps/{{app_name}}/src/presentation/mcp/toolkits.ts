import { Layer } from "effect"
import { McpServer } from "effect/ai"
import { PostsToolHandlersLive, PostsToolkit } from "./post-tools"

export const McpToolkitsLive = Layer.mergeAll(
	McpServer.toolkit(PostsToolkit).pipe(Layer.provide(PostsToolHandlersLive)),
)
