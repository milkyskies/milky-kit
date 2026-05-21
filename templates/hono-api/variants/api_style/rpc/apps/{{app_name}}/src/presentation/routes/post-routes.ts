import { Option } from "effect"
import { Hono } from "hono"
import { createPost } from "../../application/use-case/create-post"
import { deletePost } from "../../application/use-case/delete-post"
import { getPost } from "../../application/use-case/get-post"
import { listPosts } from "../../application/use-case/list-posts"
import { updatePost } from "../../application/use-case/update-post"
import type { Bindings } from "../../infrastructure/env"
import {
	type CreatePostDto,
	fromCreatePostDto,
	fromUpdatePostDto,
	toPostDto,
	type UpdatePostDto,
} from "../dto/post-dto"
import type { RepositoryVariables } from "../middleware/repositories"

export const postRoutes = new Hono<{
	Bindings: Bindings
	Variables: RepositoryVariables
}>()
	.get("/api/posts", async (context) => {
		const posts = await listPosts(context.var.postRepository)
		return context.json({ posts: posts.map(toPostDto) })
	})
	.get("/api/posts/:id", async (context) => {
		const maybe = await getPost(context.var.postRepository, context.req.param("id"))
		return Option.match(maybe, {
			onNone: () => context.json({ error: "Post not found" }, 404),
			onSome: (post) => context.json(toPostDto(post)),
		})
	})
	.post("/api/posts", async (context) => {
		const dto = await context.req.json<CreatePostDto>()
		const post = await createPost(context.var.postRepository, fromCreatePostDto(dto))
		return context.json(toPostDto(post), 201)
	})
	.patch("/api/posts/:id", async (context) => {
		const dto = await context.req.json<UpdatePostDto>()
		const maybe = await updatePost(
			context.var.postRepository,
			context.req.param("id"),
			fromUpdatePostDto(dto),
		)
		return Option.match(maybe, {
			onNone: () => context.json({ error: "Post not found" }, 404),
			onSome: (post) => context.json(toPostDto(post)),
		})
	})
	.delete("/api/posts/:id", async (context) => {
		const deleted = await deletePost(context.var.postRepository, context.req.param("id"))
		if (!deleted) return context.json({ error: "Post not found" }, 404)
		return context.body(null, 204)
	})
