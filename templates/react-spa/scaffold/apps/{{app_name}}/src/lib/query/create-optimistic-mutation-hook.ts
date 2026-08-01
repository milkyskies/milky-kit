import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { OptimisticMutationConfig, OptimisticMutationOptions } from "./types"

export function createOptimisticMutationHook<
	TData = void,
	TVariables = void,
	TContext = unknown,
	TSavedData = unknown,
>(config: OptimisticMutationConfig<TData, TVariables, TSavedData>) {
	// The context is widened to `TContext | undefined` because this wrapper owns
	// `onMutate` and only forwards a user context when the caller supplied their
	// own `onMutate`. Declaring it as `TContext` would promise `onSuccess` a value
	// that does not exist when they did not.
	return (options?: OptimisticMutationOptions<TData, Error, TVariables, TContext | undefined>) => {
		const queryClient = useQueryClient()

		const {
			optimistic: enableOptimistic = false,
			onMutate: userOnMutate,
			onError: userOnError,
			onSuccess: userOnSuccess,
			onSettled: userOnSettled,
			...baseOptions
		} = options ?? {}

		type InternalContext = {
			userContext?: TContext
			savedData?: TSavedData
		}

		return useMutation<TData, Error, TVariables, InternalContext>({
			...baseOptions,
			mutationFn: config.mutationFn,

			onMutate: async (variables, mutationContext) => {
				const userContext = await userOnMutate?.(variables, mutationContext)

				if (!enableOptimistic) {
					return { userContext }
				}

				if (config.optimistic.cancelQueries) {
					for (const queryKey of config.optimistic.cancelQueries) {
						await queryClient.cancelQueries({ queryKey })
					}
				}

				const savedData = config.optimistic.getCacheData(queryClient)
				config.optimistic.updateCache(queryClient, variables, savedData)

				return { userContext, savedData }
			},

			onError: (error, variables, context, mutationContext) => {
				if (context?.savedData) {
					config.optimistic.rollbackCache(queryClient, context.savedData)
				}

				userOnError?.(error, variables, context?.userContext, mutationContext)
			},

			onSuccess: (data, variables, context, mutationContext) => {
				userOnSuccess?.(data, variables, context?.userContext, mutationContext)
			},

			onSettled: (data, error, variables, context, mutationContext) => {
				if (config.invalidateKeys) {
					const keys = config.invalidateKeys(variables)
					for (const key of keys) {
						queryClient.invalidateQueries({ queryKey: key })
					}
				}

				userOnSettled?.(data, error, variables, context?.userContext, mutationContext)
			},
		})
	}
}
