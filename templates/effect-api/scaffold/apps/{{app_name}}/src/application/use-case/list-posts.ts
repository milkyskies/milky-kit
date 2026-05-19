import { Effect, Schema } from "effect"
import type { Post } from "@/domain/models/post"
import { type DbError, PostRepository } from "@/domain/repositories/post-repository"

export const ListPostsInput = Schema.Struct({})
export type ListPostsInput = typeof ListPostsInput.Type

export const listPosts = (
	_input: ListPostsInput,
): Effect.Effect<ReadonlyArray<Post>, DbError, PostRepository> =>
	Effect.gen(function* () {
		const repo = yield* PostRepository
		return yield* repo.findAll()
	}).pipe(Effect.withSpan("listPosts"))
