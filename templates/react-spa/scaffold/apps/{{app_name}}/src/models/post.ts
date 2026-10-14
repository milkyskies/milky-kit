import { Data } from "effect"
import type { InferResponseType } from "hono/client"
import type { api } from "@/services/api/client"

type GetPostResponse = InferResponseType<(typeof api.api.posts)[":id"]["$get"], 200>

export type PostApi = GetPostResponse

export class Post extends Data.Class<{
	readonly id: string
	readonly title: string
	readonly body: string
	readonly publishedAt: Date | undefined
	readonly createdAt: Date
	readonly updatedAt: Date
}> {
	static fromApi(dto: PostApi): Post {
		return new Post({
			id: dto.id,
			title: dto.title,
			body: dto.body,
			publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
			createdAt: new Date(dto.createdAt),
			updatedAt: new Date(dto.updatedAt),
		})
	}
}
