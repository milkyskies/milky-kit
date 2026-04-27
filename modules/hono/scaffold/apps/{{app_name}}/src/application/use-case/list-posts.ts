import type { Post } from "../../domain/models/post";
import type { PostRepository } from "../../domain/repositories/post-repository";

export async function listPosts(
	repo: PostRepository,
): Promise<ReadonlyArray<Post>> {
	return repo.findAll();
}
