import { Hono } from "hono";
import { Option } from "effect";
import { makeD1PostRepository } from "../infrastructure/db/d1-post-repository";
import { listPosts } from "../application/use-case/list-posts";
import { getPost } from "../application/use-case/get-post";
import { createPost } from "../application/use-case/create-post";
import { updatePost } from "../application/use-case/update-post";
import { deletePost } from "../application/use-case/delete-post";
import { Post } from "../domain/models/post";

type Bindings = {
	DB: D1Database;
};

export const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/posts", async (c) => {
	const repo = makeD1PostRepository(c.env.DB);
	const posts = await listPosts(repo);
	return c.json({ posts: posts.map(Post.toDto) });
});

app.get("/api/posts/:id", async (c) => {
	const repo = makeD1PostRepository(c.env.DB);
	const maybe = await getPost(repo, c.req.param("id"));

	return Option.match(maybe, {
		onNone: () => c.json({ error: "Post not found" }, 404),
		onSome: (post) => c.json(Post.toDto(post)),
	});
});

app.post("/api/posts", async (c) => {
	const body = await c.req.json<{
		title: string;
		body: string;
		publishedAt?: string | null;
	}>();

	const repo = makeD1PostRepository(c.env.DB);
	const post = await createPost(repo, {
		title: body.title,
		body: body.body,
		publishedAt: Option.map(
			Option.fromNullable(body.publishedAt ?? null),
			(s) => new Date(s),
		),
	});

	return c.json(Post.toDto(post), 201);
});

app.patch("/api/posts/:id", async (c) => {
	const body = await c.req.json<{
		title?: string;
		body?: string;
	}>();

	const repo = makeD1PostRepository(c.env.DB);
	const maybe = await updatePost(repo, c.req.param("id"), {
		title: Option.fromNullable(body.title ?? null),
		body: Option.fromNullable(body.body ?? null),
	});

	return Option.match(maybe, {
		onNone: () => c.json({ error: "Post not found" }, 404),
		onSome: (post) => c.json(Post.toDto(post)),
	});
});

app.delete("/api/posts/:id", async (c) => {
	const repo = makeD1PostRepository(c.env.DB);
	const deleted = await deletePost(repo, c.req.param("id"));

	if (!deleted) return c.json({ error: "Post not found" }, 404);
	return c.body(null, 204);
});
