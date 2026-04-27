import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MutationConfig, MutationOptions } from "./types";

export function createMutationHook<
	TData = void,
	TVariables = void,
	TContext = unknown,
>(config: MutationConfig<TData, TVariables>) {
	return (options?: MutationOptions<TData, Error, TVariables, TContext>) => {
		const queryClient = useQueryClient();

		return useMutation<TData, Error, TVariables, TContext>({
			...options,
			mutationFn: config.mutationFn,

			onSettled: (data, error, variables, context, mutationContext) => {
				if (config.invalidateKeys) {
					const keys = config.invalidateKeys(variables);
					for (const key of keys) {
						queryClient.invalidateQueries({ queryKey: key });
					}
				}

				options?.onSettled?.(data, error, variables, context, mutationContext);
			},
		});
	};
}
