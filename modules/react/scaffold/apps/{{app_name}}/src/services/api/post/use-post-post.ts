import { createMutationHook } from "@/lib/query/create-mutation-hook";
import { api } from "@/services/api/client";
import { postKeys } from "./post-keys";

interface CreatePostVariables {
	title: string;
	body: string;
}

export const usePostPost = createMutationHook<void, CreatePostVariables>({
	mutationFn: async (variables) => {
		const res = await api.api.posts.$post({ json: variables });
		if (!res.ok) throw new Error(`Failed to create post: ${res.status}`);
	},
	invalidateKeys: () => [postKeys.lists()],
});
