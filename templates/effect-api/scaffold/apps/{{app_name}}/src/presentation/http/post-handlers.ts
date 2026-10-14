import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { createPost } from "../../application/use-case/create-post"
import { getPost } from "../../application/use-case/get-post"
import { listPosts } from "../../application/use-case/list-posts"
import { Api } from "./api"

// DbError is infrastructure-only and absent from the API contract, so each handler turns it into a defect (500) here.
export const PostsHandlersLive = HttpApiBuilder.group(Api, "posts", (handlers) =>
	handlers
		.handle("listPosts", () => listPosts({}).pipe(Effect.orDie))
		.handle("getPost", ({ params }) =>
			getPost({ id: params.id }).pipe(Effect.catchTag("DbError", (error) => Effect.die(error))),
		)
		.handle("createPost", ({ payload }) => createPost(payload).pipe(Effect.orDie)),
)
