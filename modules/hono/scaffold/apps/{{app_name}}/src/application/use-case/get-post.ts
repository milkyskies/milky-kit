import type { Option } from "effect";
import type { PostRepository } from "../../domain/repositories/post-repository";
import type { Post } from "../../domain/models/post";

export async function getPost(
	repo: PostRepository,
	id: string,
): Promise<Option.Option<Post>> {
	return repo.findById(id);
}
