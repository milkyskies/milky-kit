import { AiToolkit } from "@effect/ai"
import { Effect, Schema } from "effect"
import { CreatePostInput, createPost } from "@/application/use-case/create-post"
import { GetPostInput, getPost } from "@/application/use-case/get-post"
import { listPosts } from "@/application/use-case/list-posts"
import { Post } from "@/domain/models/post"

/**
 * MCP tools wired to the same use cases as the HTTP adapter. Curate the
 * agent-facing surface separately from HTTP: agents benefit from coarser,
 * intention-shaped tools. Same use-case Effects underneath, same Schemas
 * for input — but the selection is the agent's, not the API client's.
 */
export class CreatePostTool extends Schema.TaggedRequest<CreatePostTool>()("CreatePostTool", {
	payload: CreatePostInput.fields,
	success: Post,
	failure: Schema.Never,
}) {}

export class GetPostTool extends Schema.TaggedRequest<GetPostTool>()("GetPostTool", {
	payload: GetPostInput.fields,
	success: Post,
	failure: Schema.Never,
}) {}

export class ListPostsTool extends Schema.TaggedRequest<ListPostsTool>()("ListPostsTool", {
	payload: {},
	success: Schema.Array(Post),
	failure: Schema.Never,
}) {}

export const PostsToolkit = AiToolkit.make(CreatePostTool, GetPostTool, ListPostsTool)

export const PostsToolHandlersLive = PostsToolkit.toLayer({
	CreatePostTool: (input) => createPost(input).pipe(Effect.orDie),
	GetPostTool: (input) => getPost(input).pipe(Effect.orDie),
	ListPostsTool: () => listPosts({}).pipe(Effect.orDie),
})
