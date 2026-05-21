import { z } from "@hono/zod-openapi"
import { Option } from "effect"
import type { CreatePostInput } from "../../application/use-case/create-post"
import type { Post } from "../../domain/models/post"
import type { PostPatch } from "../../domain/repositories/post-repository"

export const PostDtoSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		body: z.string(),
		publishedAt: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("Post")

export type PostDto = z.infer<typeof PostDtoSchema>

export const CreatePostDtoSchema = z.object({
	title: z.string(),
	body: z.string(),
	publishedAt: z.string().nullable().optional(),
})

export type CreatePostDto = z.infer<typeof CreatePostDtoSchema>

export const UpdatePostDtoSchema = z.object({
	title: z.string().optional(),
	body: z.string().optional(),
})

export type UpdatePostDto = z.infer<typeof UpdatePostDtoSchema>

export const ErrorResSchema = z.object({ error: z.string() }).openapi("Error")

export const toPostDto = (post: Post): PostDto => ({
	id: post.id,
	title: post.title,
	body: post.body,
	publishedAt: Option.match(post.publishedAt, {
		onNone: () => null,
		onSome: (date) => date.toISOString(),
	}),
	createdAt: post.createdAt.toISOString(),
	updatedAt: post.updatedAt.toISOString(),
})

export const fromCreatePostDto = (dto: CreatePostDto): CreatePostInput => ({
	title: dto.title,
	body: dto.body,
	publishedAt: Option.map(Option.fromNullable(dto.publishedAt ?? null), (value) => new Date(value)),
})

export const fromUpdatePostDto = (dto: UpdatePostDto): PostPatch => ({
	title: Option.fromNullable(dto.title ?? null),
	body: Option.fromNullable(dto.body ?? null),
})
