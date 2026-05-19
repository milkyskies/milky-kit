import { Effect, Option, Schema } from "effect"
import { IdGenerator } from "@/domain/services/id-generator"
import type { Post } from "@/domain/models/post"
import { type DbError, PostRepository } from "@/domain/repositories/post-repository"

export const CreatePostInput = Schema.Struct({
	title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
	body: Schema.String,
	publishedAt: Schema.OptionFromNullishOr(Schema.DateFromSelf, null),
})
export type CreatePostInput = typeof CreatePostInput.Type

export const createPost = (
	input: CreatePostInput,
): Effect.Effect<Post, DbError, PostRepository | IdGenerator> =>
	Effect.gen(function* () {
		const repo = yield* PostRepository
		const ids = yield* IdGenerator
		const id = yield* ids.nextId()

		return yield* repo.create({
			id,
			title: input.title,
			body: input.body,
			publishedAt: input.publishedAt,
		})
	}).pipe(
		Effect.withSpan("createPost", {
			attributes: { "post.title": input.title },
		}),
		Effect.tap((post) =>
			Effect.annotateLogs(Effect.logInfo("post created"), { postId: post.id }),
		),
	)

// Pure helper - exported for tests.
export const isInputValid = (input: CreatePostInput): boolean =>
	input.title.trim().length > 0 && Option.isOption(input.publishedAt)
