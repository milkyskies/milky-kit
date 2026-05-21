import { Option } from "effect"
import type { CreatePostInput } from "../../application/use-case/create-post"
import type { Post } from "../../domain/models/post"
import type { PostPatch } from "../../domain/repositories/post-repository"

export type PostDto = {
	id: string
	title: string
	body: string
	publishedAt: string | null
	createdAt: string
	updatedAt: string
}

export type CreatePostDto = {
	title: string
	body: string
	publishedAt?: string | null
}

export type UpdatePostDto = {
	title?: string
	body?: string
}

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
