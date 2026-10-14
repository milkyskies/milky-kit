import { Option, Schema } from "effect"

export class Post extends Schema.Class<Post>("Post")({
	id: Schema.String.check(Schema.isUUID()),
	title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
	body: Schema.String,
	publishedAt: Schema.OptionFromNullOr(Schema.Date),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
}) {
	get isPublished(): boolean {
		return Option.isSome(this.publishedAt)
	}
}
