import { createMutationHook } from "@/lib/query";
import axios from "axios";
import { postKeys } from "./post-keys";

interface CreatePostVariables {
	title: string;
	body: string;
}

export const usePostPost = createMutationHook<void, CreatePostVariables>({
	mutationFn: async (variables) => {
		await axios.post("/api/posts", variables);
	},
	invalidateKeys: () => [postKeys.lists()],
});
