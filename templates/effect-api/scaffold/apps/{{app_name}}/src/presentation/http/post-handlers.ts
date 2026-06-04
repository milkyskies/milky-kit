import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { createPost } from "@/application/use-case/create-post"
import { getPost } from "@/application/use-case/get-post"
import { listPosts } from "@/application/use-case/list-posts"
import { PostsApi } from "./api"

/**
 * Thin HTTP adapter: parse input -> call use case -> return success.
 * Declared endpoint errors (PostNotFound -> 404) flow through; the
 * infrastructure-only DbError is not part of the API contract, so it is
 * turned into a defect (500) at this boundary.
 */
export const PostsHandlersLive = HttpApiBuilder.group(PostsApi, "posts", (handlers) =>
	handlers
		.handle("listPosts", () => listPosts({}).pipe(Effect.orDie))
		.handle("getPost", ({ path }) =>
			getPost({ id: path.id }).pipe(Effect.catchTag("DbError", (error) => Effect.die(error))),
		)
		.handle("createPost", ({ payload }) => createPost(payload).pipe(Effect.orDie)),
)
