import { Tool, Toolkit } from "@effect/ai"
import { Effect, Schema } from "effect"
import { CreatePostInput, createPost } from "@/application/use-case/create-post"
import { GetPostInput, getPost } from "@/application/use-case/get-post"
import { listPosts } from "@/application/use-case/list-posts"
import { Post } from "@/domain/models/post"
import { PostRepository } from "@/domain/repositories/post-repository"
import { IdGenerator } from "@/domain/services/id-generator"

/**
 * MCP tools wired to the same use cases as the HTTP adapter. Curate the
 * agent-facing surface separately from HTTP: agents benefit from coarser,
 * intention-shaped tools. `dependencies` declares the services each tool's
 * handler needs so they flow up to the composition root, provided once.
 */
const CreatePostTool = Tool.make("CreatePost", {
	description: "Create a new post",
	parameters: CreatePostInput.fields,
	success: Post,
	failure: Schema.Never,
	dependencies: [PostRepository, IdGenerator],
})

const GetPostTool = Tool.make("GetPost", {
	description: "Get a single post by id",
	parameters: GetPostInput.fields,
	success: Post,
	failure: Schema.Never,
	dependencies: [PostRepository],
})

// MCP structuredContent must be an object, so a list result is wrapped in a
// single-key struct rather than returned as a top-level array.
const ListPostsTool = Tool.make("ListPosts", {
	description: "List all posts",
	parameters: {},
	success: Schema.Struct({ posts: Schema.Array(Post) }),
	failure: Schema.Never,
	dependencies: [PostRepository],
})

export const PostsToolkit = Toolkit.make(CreatePostTool, GetPostTool, ListPostsTool)

export const PostsToolHandlersLive = PostsToolkit.toLayer({
	CreatePost: (input) => createPost(input).pipe(Effect.orDie),
	GetPost: (input) => getPost(input).pipe(Effect.orDie),
	ListPosts: () =>
		listPosts({}).pipe(
			Effect.map((posts) => ({ posts })),
			Effect.orDie,
		),
})
