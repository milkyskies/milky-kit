import { queryOptions } from "@tanstack/react-query";
import { Post } from "@/models/post";
import { api } from "@/services/api/client";
import { postKeys } from "./post-keys";

export const getPostsQueryOptions = () =>
	queryOptions({
		queryKey: postKeys.list(),
		queryFn: async () => {
			const res = await api.api.posts.$get();
			if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
			const data = await res.json();
			return data.posts.map(Post.fromApi);
		},
	});
