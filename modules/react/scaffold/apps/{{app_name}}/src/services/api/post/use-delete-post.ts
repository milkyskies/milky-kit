import { createMutationHook } from "@/lib/query";
import { api } from "@/services/api/client";
import { postKeys } from "./post-keys";

interface DeletePostVariables {
	id: string;
}

export const useDeletePost = createMutationHook<void, DeletePostVariables>({
	mutationFn: async (variables) => {
		const res = await api.api.posts[":id"].$delete({
			param: { id: variables.id },
		});
		if (!res.ok) throw new Error(`Failed to delete post: ${res.status}`);
	},
	invalidateKeys: () => [postKeys.lists()],
});
