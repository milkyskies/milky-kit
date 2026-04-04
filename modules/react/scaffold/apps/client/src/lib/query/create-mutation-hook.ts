import { useMutation, useQueryClient } from "@tanstack/react-query";

interface MutationConfig<TData, TVariables> {
	mutationFn: (variables: TVariables) => Promise<TData>;
	invalidateKeys?: (variables: TVariables) => unknown[][];
}

export function createMutationHook<TData = void, TVariables = void>(
	config: MutationConfig<TData, TVariables>,
) {
	return () => {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: config.mutationFn,
			onSettled: (_data, _error, variables) => {
				if (config.invalidateKeys && variables) {
					for (const key of config.invalidateKeys(variables)) {
						queryClient.invalidateQueries({ queryKey: key });
					}
				}
			},
		});
	};
}
