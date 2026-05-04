import { Me } from "@/models/me";
import { api } from "@/services/api/client";
import { meQueryOptions } from "@/services/api/me/me-query-options";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Option } from "effect";

export type CreateMeInput = {
	displayName: string;
};

export function useCreateMe() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateMeInput): Promise<Me> => {
			const response = await api.me.$post({ json: input });
			if (!response.ok) {
				throw new Error(`Failed to create profile: ${response.status}`);
			}
			const dto = await response.json();
			return Me.fromApi(dto);
		},
		onSuccess: (me) => {
			queryClient.setQueryData(meQueryOptions.queryKey, Option.some(me));
		},
	});
}
