import { Effect, Option, Schema } from "effect"
import type { Post } from "@/domain/models/post"
import { type DbError, PostNotFound, PostRepository } from "@/domain/repositories/post-repository"

export const GetPostInput = Schema.Struct({
	id: Schema.String,
})
export type GetPostInput = typeof GetPostInput.Type

export const getPost = (
	input: GetPostInput,
): Effect.Effect<Post, DbError | PostNotFound, PostRepository> =>
	Effect.gen(function* () {
		const repo = yield* PostRepository
		const maybe = yield* repo.findById(input.id)

		return yield* Option.match(maybe, {
			onNone: () => Effect.fail(new PostNotFound({ id: input.id })),
			onSome: (post) => Effect.succeed(post),
		})
	}).pipe(
		Effect.withSpan("getPost", {
			attributes: { "post.id": input.id },
		}),
	)
