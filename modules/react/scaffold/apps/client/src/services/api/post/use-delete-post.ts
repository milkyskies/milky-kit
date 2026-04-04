import { createMutationHook } from "@/lib/query";
import axios from "axios";
import { postKeys } from "./post-keys";

interface DeletePostVariables {
	id: string;
}

export const useDeletePost = createMutationHook<void, DeletePostVariables>({
	mutationFn: async (variables) => {
		await axios.delete(`/api/posts/${variables.id}`);
	},
	invalidateKeys: () => [postKeys.lists()],
});
