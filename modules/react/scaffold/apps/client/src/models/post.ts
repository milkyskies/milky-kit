import { Data } from "effect";
import type { PostResponse } from "../services/api/_generated/schemas";

export interface Post {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export const Post = {
	make: Data.case<Post>(),

	fromApi: (dto: PostResponse) =>
		Post.make({
			id: dto.id,
			title: dto.title,
			body: dto.body,
			createdAt: new Date(dto.created_at),
			updatedAt: new Date(dto.updated_at),
		}),
};
