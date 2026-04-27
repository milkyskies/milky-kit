import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	OptimisticMutationConfig,
	OptimisticMutationOptions,
} from "./types";

export function createOptimisticMutationHook<
	TData = void,
	TVariables = void,
	TContext = unknown,
	TSavedData = unknown,
>(config: OptimisticMutationConfig<TData, TVariables, TSavedData>) {
	return (
		options?: OptimisticMutationOptions<TData, Error, TVariables, TContext>,
	) => {
		const queryClient = useQueryClient();

		const {
			optimistic: enableOptimistic = false,
			onMutate: userOnMutate,
			onError: userOnError,
			onSuccess: userOnSuccess,
			onSettled: userOnSettled,
			...baseOptions
		} = options ?? {};

		type InternalContext = {
			userContext?: TContext;
			savedData?: TSavedData;
		};

		return useMutation<TData, Error, TVariables, InternalContext>({
			...baseOptions,
			mutationFn: config.mutationFn,

			onMutate: async (variables, mutationContext) => {
				const userContext = await userOnMutate?.(variables, mutationContext);

				if (!enableOptimistic) {
					return { userContext };
				}

				if (config.optimistic.cancelQueries) {
					const keys = Array.isArray(config.optimistic.cancelQueries[0])
						? (config.optimistic.cancelQueries as readonly unknown[][])
						: [config.optimistic.cancelQueries];

					for (const queryKey of keys) {
						await queryClient.cancelQueries({ queryKey });
					}
				}

				const savedData = config.optimistic.getCacheData(queryClient);
				config.optimistic.updateCache(queryClient, variables, savedData);

				return { userContext, savedData };
			},

			onError: (error, variables, context, mutationContext) => {
				if (context?.savedData) {
					config.optimistic.rollbackCache(queryClient, context.savedData);
				}

				userOnError?.(
					error,
					variables,
					context?.userContext as TContext,
					mutationContext,
				);
			},

			onSuccess: (data, variables, context, mutationContext) => {
				userOnSuccess?.(
					data,
					variables,
					context?.userContext as TContext,
					mutationContext,
				);
			},

			onSettled: (data, error, variables, context, mutationContext) => {
				if (config.invalidateKeys) {
					const keys = config.invalidateKeys(variables);
					for (const key of keys) {
						queryClient.invalidateQueries({ queryKey: key });
					}
				}

				userOnSettled?.(
					data,
					error,
					variables,
					context?.userContext as TContext,
					mutationContext,
				);
			},
		});
	};
}
