import { Post, type PostApi } from "@/models/post";
import { createQueryOptions } from "@/lib/query";
import axios from "axios";
import { postKeys } from "./post-keys";

const getPostsQueryOptionsFactory = createQueryOptions<void, Post[]>({
	keyFn: () => postKeys.list(),
	queryFn: async () => {
		const response = await axios.get<PostApi[]>("/api/posts");
		return response.data.map(Post.fromApi);
	},
});

export const getPostsQueryOptions = () => getPostsQueryOptionsFactory(undefined as void);
