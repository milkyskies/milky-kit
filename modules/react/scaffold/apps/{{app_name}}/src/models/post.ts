import type { api } from "@/services/api/client";
import { Data } from "effect";
import type { InferResponseType } from "hono/client";

type GetPostResponse = InferResponseType<
	(typeof api.api.posts)[":id"]["$get"],
	200
>;

export type PostApi = GetPostResponse;

export interface Post {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly publishedAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export const Post = {
	make: Data.case<Post>(),

	fromApi: (dto: PostApi): Post =>
		Post.make({
			id: dto.id,
			title: dto.title,
			body: dto.body,
			publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
			createdAt: new Date(dto.createdAt),
			updatedAt: new Date(dto.updatedAt),
		}),
};
