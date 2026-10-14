import { Schema } from "effect"

export class PostNotFound extends Schema.TaggedError<PostNotFound>()("PostNotFound", {
	id: Schema.String,
}) {}
