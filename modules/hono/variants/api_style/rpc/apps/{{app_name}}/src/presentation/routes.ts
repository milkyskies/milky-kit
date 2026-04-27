import { Option } from "effect";
import { Hono } from "hono";
import { createPost } from "../application/use-case/create-post";
import { deletePost } from "../application/use-case/delete-post";
import { getPost } from "../application/use-case/get-post";
import { listPosts } from "../application/use-case/list-posts";
import { updatePost } from "../application/use-case/update-post";
import { Post } from "../domain/models/post";
import {
	type Bindings,
	makePostRepository,
} from "../infrastructure/db/post-repository";

export const app = new Hono<{ Bindings: Bindings }>()
	.get("/api/posts", async (c) => {
		const repo = makePostRepository(c.env);
		const posts = await listPosts(repo);
		return c.json({ posts: posts.map(Post.toDto) });
	})
	.get("/api/posts/:id", async (c) => {
		const repo = makePostRepository(c.env);
		const maybe = await getPost(repo, c.req.param("id"));
		return Option.match(maybe, {
			onNone: () => c.json({ error: "Post not found" }, 404),
			onSome: (post) => c.json(Post.toDto(post)),
		});
	})
	.post("/api/posts", async (c) => {
		const body = await c.req.json<{
			title: string;
			body: string;
			publishedAt?: string | null;
		}>();
		const repo = makePostRepository(c.env);
		const post = await createPost(repo, {
			title: body.title,
			body: body.body,
			publishedAt: Option.map(
				Option.fromNullable(body.publishedAt ?? null),
				(s) => new Date(s),
			),
		});
		return c.json(Post.toDto(post), 201);
	})
	.patch("/api/posts/:id", async (c) => {
		const body = await c.req.json<{ title?: string; body?: string }>();
		const repo = makePostRepository(c.env);
		const maybe = await updatePost(repo, c.req.param("id"), {
			title: Option.fromNullable(body.title ?? null),
			body: Option.fromNullable(body.body ?? null),
		});
		return Option.match(maybe, {
			onNone: () => c.json({ error: "Post not found" }, 404),
			onSome: (post) => c.json(Post.toDto(post)),
		});
	})
	.delete("/api/posts/:id", async (c) => {
		const repo = makePostRepository(c.env);
		const deleted = await deletePost(repo, c.req.param("id"));
		if (!deleted) return c.json({ error: "Post not found" }, 404);
		return c.body(null, 204);
	});
