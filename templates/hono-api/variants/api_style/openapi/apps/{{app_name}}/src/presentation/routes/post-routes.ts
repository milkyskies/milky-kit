import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Option } from "effect";
import { createPost } from "../../application/use-case/create-post";
import { deletePost } from "../../application/use-case/delete-post";
import { getPost } from "../../application/use-case/get-post";
import { listPosts } from "../../application/use-case/list-posts";
import { updatePost } from "../../application/use-case/update-post";
import type { Bindings } from "../../infrastructure/env";
import {
	CreatePostDtoSchema,
	ErrorResSchema,
	PostDtoSchema,
	UpdatePostDtoSchema,
	fromCreatePostDto,
	fromUpdatePostDto,
	toPostDto,
} from "../dto/post-dto";
import type { RepositoryVariables } from "../middleware/repositories";

export const postRoutes = new OpenAPIHono<{
	Bindings: Bindings;
	Variables: RepositoryVariables;
}>();

postRoutes.openapi(
	createRoute({
		method: "get",
		path: "/api/posts",
		responses: {
			200: {
				content: {
					"application/json": {
						schema: z.object({ posts: z.array(PostDtoSchema) }),
					},
				},
				description: "List posts",
			},
		},
	}),
	async (context) => {
		const posts = await listPosts(context.var.postRepository);
		return context.json({ posts: posts.map(toPostDto) });
	},
);

postRoutes.openapi(
	createRoute({
		method: "get",
		path: "/api/posts/{id}",
		request: { params: z.object({ id: z.string() }) },
		responses: {
			200: {
				content: { "application/json": { schema: PostDtoSchema } },
				description: "Post",
			},
			404: {
				content: { "application/json": { schema: ErrorResSchema } },
				description: "Not found",
			},
		},
	}),
	async (context) => {
		const maybe = await getPost(
			context.var.postRepository,
			context.req.valid("param").id,
		);
		return Option.match(maybe, {
			onNone: () => context.json({ error: "Post not found" }, 404),
			onSome: (post) => context.json(toPostDto(post)),
		});
	},
);

postRoutes.openapi(
	createRoute({
		method: "post",
		path: "/api/posts",
		request: {
			body: {
				content: { "application/json": { schema: CreatePostDtoSchema } },
			},
		},
		responses: {
			201: {
				content: { "application/json": { schema: PostDtoSchema } },
				description: "Created",
			},
		},
	}),
	async (context) => {
		const dto = context.req.valid("json");
		const post = await createPost(
			context.var.postRepository,
			fromCreatePostDto(dto),
		);
		return context.json(toPostDto(post), 201);
	},
);

postRoutes.openapi(
	createRoute({
		method: "patch",
		path: "/api/posts/{id}",
		request: {
			params: z.object({ id: z.string() }),
			body: {
				content: { "application/json": { schema: UpdatePostDtoSchema } },
			},
		},
		responses: {
			200: {
				content: { "application/json": { schema: PostDtoSchema } },
				description: "Updated",
			},
			404: {
				content: { "application/json": { schema: ErrorResSchema } },
				description: "Not found",
			},
		},
	}),
	async (context) => {
		const dto = context.req.valid("json");
		const maybe = await updatePost(
			context.var.postRepository,
			context.req.valid("param").id,
			fromUpdatePostDto(dto),
		);
		return Option.match(maybe, {
			onNone: () => context.json({ error: "Post not found" }, 404),
			onSome: (post) => context.json(toPostDto(post)),
		});
	},
);

postRoutes.openapi(
	createRoute({
		method: "delete",
		path: "/api/posts/{id}",
		request: { params: z.object({ id: z.string() }) },
		responses: {
			204: { description: "Deleted" },
			404: {
				content: { "application/json": { schema: ErrorResSchema } },
				description: "Not found",
			},
		},
	}),
	async (context) => {
		const deleted = await deletePost(
			context.var.postRepository,
			context.req.valid("param").id,
		);
		if (!deleted) return context.json({ error: "Post not found" }, 404);
		return context.body(null, 204);
	},
);
