import { Context, Data, type Effect, type Option, Schema } from "effect"
import type { Post } from "@/domain/models/post"

// Schema.TaggedError (not Data.TaggedError) so it doubles as the HttpApi error schema (404).
export class PostNotFound extends Schema.TaggedError<PostNotFound>()("PostNotFound", {
	id: Schema.String,
}) {}

export class DbError extends Data.TaggedError("DbError")<{
	readonly cause: unknown
}> {}

export type NewPost = {
	readonly id: string
	readonly title: string
	readonly body: string
	readonly publishedAt: Option.Option<Date>
}

export type PostPatch = {
	readonly title: Option.Option<string>
	readonly body: Option.Option<string>
}

export class PostRepository extends Context.Tag("PostRepository")<
	PostRepository,
	{
		readonly findAll: () => Effect.Effect<ReadonlyArray<Post>, DbError>
		readonly findById: (id: string) => Effect.Effect<Option.Option<Post>, DbError>
		readonly create: (input: NewPost) => Effect.Effect<Post, DbError>
		readonly update: (id: string, patch: PostPatch) => Effect.Effect<Post, DbError | PostNotFound>
		readonly delete: (id: string) => Effect.Effect<void, DbError | PostNotFound>
	}
>() {}
