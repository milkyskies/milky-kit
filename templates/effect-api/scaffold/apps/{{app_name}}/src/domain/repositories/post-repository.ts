import { Context, Data, type Effect, type Option } from "effect"
import type { Post } from "@/domain/models/post"

export class PostNotFound extends Data.TaggedError("PostNotFound")<{
	readonly id: string
}> {}

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
