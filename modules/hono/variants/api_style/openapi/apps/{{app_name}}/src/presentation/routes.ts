import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Option } from "effect";
import { makePostRepository, type Bindings } from "../infrastructure/db/post-repository";
import { listPosts } from "../application/use-case/list-posts";
import { getPost } from "../application/use-case/get-post";
import { createPost } from "../application/use-case/create-post";
import { updatePost } from "../application/use-case/update-post";
import { deletePost } from "../application/use-case/delete-post";
import { Post } from "../domain/models/post";

const PostDto = z
	.object({
		id: z.string(),
		title: z.string(),
		body: z.string(),
		publishedAt: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("Post");

const ErrorRes = z.object({ error: z.string() }).openapi("Error");

export const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.openapi(
	createRoute({
		method: "get",
		path: "/api/posts",
		responses: {
			200: {
				content: { "application/json": { schema: z.object({ posts: z.array(PostDto) }) } },
				description: "List posts",
			},
		},
	}),
	async (c) => {
		const repo = makePostRepository(c.env);
		const posts = await listPosts(repo);
		return c.json({ posts: posts.map(Post.toDto) });
	},
);

app.openapi(
	createRoute({
		method: "get",
		path: "/api/posts/{id}",
		request: { params: z.object({ id: z.string() }) },
		responses: {
			200: { content: { "application/json": { schema: PostDto } }, description: "Post" },
			404: { content: { "application/json": { schema: ErrorRes } }, description: "Not found" },
		},
	}),
	async (c) => {
		const repo = makePostRepository(c.env);
		const maybe = await getPost(repo, c.req.valid("param").id);
		return Option.match(maybe, {
			onNone: () => c.json({ error: "Post not found" }, 404),
			onSome: (post) => c.json(Post.toDto(post)),
		});
	},
);

app.openapi(
	createRoute({
		method: "post",
		path: "/api/posts",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							title: z.string(),
							body: z.string(),
							publishedAt: z.string().nullable().optional(),
						}),
					},
				},
			},
		},
		responses: {
			201: { content: { "application/json": { schema: PostDto } }, description: "Created" },
		},
	}),
	async (c) => {
		const body = c.req.valid("json");
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
	},
);

app.openapi(
	createRoute({
		method: "patch",
		path: "/api/posts/{id}",
		request: {
			params: z.object({ id: z.string() }),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							title: z.string().optional(),
							body: z.string().optional(),
						}),
					},
				},
			},
		},
		responses: {
			200: { content: { "application/json": { schema: PostDto } }, description: "Updated" },
			404: { content: { "application/json": { schema: ErrorRes } }, description: "Not found" },
		},
	}),
	async (c) => {
		const body = c.req.valid("json");
		const repo = makePostRepository(c.env);
		const maybe = await updatePost(repo, c.req.valid("param").id, {
			title: Option.fromNullable(body.title ?? null),
			body: Option.fromNullable(body.body ?? null),
		});
		return Option.match(maybe, {
			onNone: () => c.json({ error: "Post not found" }, 404),
			onSome: (post) => c.json(Post.toDto(post)),
		});
	},
);

app.openapi(
	createRoute({
		method: "delete",
		path: "/api/posts/{id}",
		request: { params: z.object({ id: z.string() }) },
		responses: {
			204: { description: "Deleted" },
			404: { content: { "application/json": { schema: ErrorRes } }, description: "Not found" },
		},
	}),
	async (c) => {
		const repo = makePostRepository(c.env);
		const deleted = await deletePost(repo, c.req.valid("param").id);
		if (!deleted) return c.json({ error: "Post not found" }, 404);
		return c.body(null, 204);
	},
);

app.doc("/openapi.json", {
	openapi: "3.0.0",
	info: { title: "{{project_name}} API", version: "1.0.0" },
});
