import { createQueryOptions } from "@/lib/query/create-query-options";
import { Post } from "@/models/post";
import { api } from "@/services/api/client";
import { postKeys } from "./post-keys";

const getPostsQueryOptionsFactory = createQueryOptions<undefined, Post[]>({
	keyFn: () => postKeys.list(),
	queryFn: async () => {
		const res = await api.api.posts.$get();
		if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
		const data = await res.json();
		return data.posts.map(Post.fromApi);
	},
});

export const getPostsQueryOptions = () =>
	getPostsQueryOptionsFactory(undefined);
