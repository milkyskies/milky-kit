import { Effect, Schema } from "effect"
import { Tool, Toolkit } from "effect/ai"
import { CreatePostInput, createPost } from "../../application/use-case/create-post"
import { GetPostInput, getPost } from "../../application/use-case/get-post"
import { listPosts } from "../../application/use-case/list-posts"
import { Post } from "../../domain/models/post"
import { PostRepository } from "../../domain/repositories/post-repository"
import { IdGenerator } from "../../domain/services/id-generator"

const CreatePostTool = Tool.make("CreatePost", {
	description: "Create a new post",
	parameters: CreatePostInput,
	success: Post,
	dependencies: [PostRepository, IdGenerator],
})

const GetPostTool = Tool.make("GetPost", {
	description: "Get a single post by id",
	parameters: GetPostInput,
	success: Post,
	dependencies: [PostRepository],
})

// MCP structuredContent must be an object, so a list result is wrapped in a single-key struct.
const ListPostsTool = Tool.make("ListPosts", {
	description: "List all posts",
	success: Schema.Struct({ posts: Schema.Array(Post) }),
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
