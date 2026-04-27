import type { Option } from "effect";
import type {
	PostPatch,
	PostRepository,
} from "../../domain/repositories/post-repository";
import type { Post } from "../../domain/models/post";

export async function updatePost(
	repo: PostRepository,
	id: string,
	patch: PostPatch,
): Promise<Option.Option<Post>> {
	return repo.update(id, patch);
}
