import type { Option } from "effect";
import { nanoid } from "nanoid";
import type { PostRepository } from "../../domain/repositories/post-repository";
import type { Post } from "../../domain/models/post";

export type CreatePostInput = {
	title: string;
	body: string;
	publishedAt: Option.Option<Date>;
};

export async function createPost(
	repo: PostRepository,
	input: CreatePostInput,
): Promise<Post> {
	return repo.create({
		id: nanoid(12),
		title: input.title,
		body: input.body,
		publishedAt: input.publishedAt,
	});
}
