import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { CreatePostInput } from "@/application/use-case/create-post"
import { Post } from "@/domain/models/post"
import { PostNotFound } from "@/domain/repositories/post-repository"

const PostsGroup = HttpApiGroup.make("posts")
	.add(HttpApiEndpoint.get("listPosts")`/posts`.addSuccess(Schema.Array(Post)))
	.add(
		HttpApiEndpoint.get("getPost")`/posts/${HttpApiSchema.param("id", Schema.String)}`
			.addSuccess(Post)
			.addError(PostNotFound, { status: 404 }),
	)
	.add(
		HttpApiEndpoint.post("createPost")`/posts`
			.setPayload(CreatePostInput)
			.addSuccess(Post, { status: 201 }),
	)

export class PostsApi extends HttpApi.make("api").add(PostsGroup).prefix("/api") {}
