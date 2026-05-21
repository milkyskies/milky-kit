import { Data, type Option } from "effect"

export interface Post {
	readonly id: string
	readonly title: string
	readonly body: string
	readonly publishedAt: Option.Option<Date>
	readonly createdAt: Date
	readonly updatedAt: Date
}

export const Post = {
	make: Data.case<Post>(),
}
