import type { Option } from "effect";
import type { Post } from "../../domain/models/post";
import type {
	PostPatch,
	PostRepository,
} from "../../domain/repositories/post-repository";

export async function updatePost(
	repo: PostRepository,
	id: string,
	patch: PostPatch,
): Promise<Option.Option<Post>> {
	return repo.update(id, patch);
}
