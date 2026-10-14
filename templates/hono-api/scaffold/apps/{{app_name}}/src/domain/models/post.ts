import { Data, type Option } from "effect"

export class Post extends Data.Class<{
	readonly id: string
	readonly title: string
	readonly body: string
	readonly publishedAt: Option.Option<Date>
	readonly createdAt: Date
	readonly updatedAt: Date
}> {}
