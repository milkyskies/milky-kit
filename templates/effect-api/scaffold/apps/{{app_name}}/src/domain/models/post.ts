import { Schema } from "effect"

export class Post extends Schema.Class<Post>("Post")({
	id: Schema.UUID,
	title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
	body: Schema.String,
	publishedAt: Schema.OptionFromNullOr(Schema.Date),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
}) {
	get isPublished(): boolean {
		return this.publishedAt._tag === "Some"
	}
}

export const PostId = Schema.UUID.pipe(Schema.brand("PostId"))
export type PostId = typeof PostId.Type
