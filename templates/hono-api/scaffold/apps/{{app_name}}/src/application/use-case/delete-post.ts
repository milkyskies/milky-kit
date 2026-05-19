import type { PostRepository } from "../../domain/repositories/post-repository";

export async function deletePost(
	repo: PostRepository,
	id: string,
): Promise<boolean> {
	return repo.delete(id);
}
