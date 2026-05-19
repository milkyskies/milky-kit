import type { Option } from "effect";
import type { Post } from "../../domain/models/post";
import type { PostRepository } from "../../domain/repositories/post-repository";

export async function getPost(
	repo: PostRepository,
	id: string,
): Promise<Option.Option<Post>> {
	return repo.findById(id);
}
