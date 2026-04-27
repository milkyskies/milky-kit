import { Data, Option } from "effect";

export interface Post {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly publishedAt: Option.Option<Date>;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export type PostRow = {
	id: string;
	title: string;
	body: string;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type PostDto = {
	id: string;
	title: string;
	body: string;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export const Post = {
	make: Data.case<Post>(),

	fromRow: (row: PostRow): Post =>
		Post.make({
			id: row.id,
			title: row.title,
			body: row.body,
			publishedAt: Option.fromNullable(row.publishedAt),
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}),

	toDto: (post: Post): PostDto => ({
		id: post.id,
		title: post.title,
		body: post.body,
		publishedAt: Option.match(post.publishedAt, {
			onNone: () => null,
			onSome: (d) => d.toISOString(),
		}),
		createdAt: post.createdAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
	}),
};
