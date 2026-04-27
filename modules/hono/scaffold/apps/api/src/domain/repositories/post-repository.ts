import type { Option } from "effect";
import type { Post } from "../models/post";

export type NewPost = {
	id: string;
	title: string;
	body: string;
	publishedAt: Option.Option<Date>;
};

export type PostPatch = {
	title: Option.Option<string>;
	body: Option.Option<string>;
};

export type PostRepository = {
	findAll: () => Promise<ReadonlyArray<Post>>;
	findById: (id: string) => Promise<Option.Option<Post>>;
	create: (post: NewPost) => Promise<Post>;
	update: (id: string, patch: PostPatch) => Promise<Option.Option<Post>>;
	delete: (id: string) => Promise<boolean>;
};
