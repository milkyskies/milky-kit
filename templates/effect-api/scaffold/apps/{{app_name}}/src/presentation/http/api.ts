import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { CreatePostInput } from "../../application/use-case/create-post"
import { Post } from "../../domain/models/post"
import { PostNotFound } from "../../domain/models/post-not-found"

const PostsGroup = HttpApiGroup.make("posts").add(
	HttpApiEndpoint.get("listPosts", "/posts", {
		success: Schema.Array(Post),
	}),
	HttpApiEndpoint.get("getPost", "/posts/:id", {
		params: { id: Schema.String },
		success: Post,
		error: PostNotFound.pipe(HttpApiSchema.status(404)),
	}),
	HttpApiEndpoint.post("createPost", "/posts", {
		payload: CreatePostInput,
		success: Post.pipe(HttpApiSchema.status(201)),
	}),
)

export class Api extends HttpApi.make("api").add(PostsGroup).prefix("/api") {}
