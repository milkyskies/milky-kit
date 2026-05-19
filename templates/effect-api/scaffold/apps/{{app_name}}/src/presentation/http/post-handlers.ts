import { HttpApiBuilder } from "@effect/platform"
import { createPost } from "@/application/use-case/create-post"
import { getPost } from "@/application/use-case/get-post"
import { listPosts } from "@/application/use-case/list-posts"
import { PostsApi } from "./api"

/**
 * Thin HTTP adapter: parse input -> call use case -> return success.
 * Errors declared on the endpoint (PostNotFound -> 404) map to HTTP
 * responses automatically. Handlers return Effects; the platform layer
 * runs them per request with AppLive provided.
 */
export const PostsHandlersLive = HttpApiBuilder.group(PostsApi, "posts", (handlers) =>
	handlers
		.handle("listPosts", () => listPosts({}))
		.handle("getPost", ({ path }) => getPost({ id: path.id }))
		.handle("createPost", ({ payload }) => createPost(payload)),
)
