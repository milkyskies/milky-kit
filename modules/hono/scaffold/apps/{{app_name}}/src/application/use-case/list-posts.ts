import type { PostRepository } from "../../domain/repositories/post-repository";
import type { Post } from "../../domain/models/post";

export async function listPosts(
	repo: PostRepository,
): Promise<ReadonlyArray<Post>> {
	return repo.findAll();
}
