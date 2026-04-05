import type {
	QueryClient,
	QueryKey,
	UseMutationOptions,
	UseSuspenseQueryOptions,
} from "@tanstack/react-query";

export type MutationOptions<
	TData = unknown,
	TError = Error,
	TVariables = void,
	TContext = unknown,
> = UseMutationOptions<TData, TError, TVariables, TContext>;

export type OptimisticMutationOptions<
	TData = unknown,
	TError = Error,
	TVariables = void,
	TContext = unknown,
> = UseMutationOptions<TData, TError, TVariables, TContext> & {
	optimistic?: boolean;
};

export type QueryOptions<TData> = Omit<
	UseSuspenseQueryOptions<TData>,
	"queryKey" | "queryFn"
>;

export type OptimisticConfig<TVariables, TSavedData = unknown> = {
	getCacheData: (queryClient: QueryClient) => TSavedData;
	updateCache: (
		queryClient: QueryClient,
		variables: TVariables,
		current: TSavedData,
	) => TSavedData;
	rollbackCache: (queryClient: QueryClient, saved: TSavedData) => void;
	cancelQueries?: QueryKey | QueryKey[];
};

export type MutationConfig<TData, TVariables> = {
	mutationFn: (variables: TVariables) => Promise<TData>;
	invalidateKeys?: (variables: TVariables) => Array<QueryKey>;
};

export type OptimisticMutationConfig<
	TData,
	TVariables,
	TSavedData = unknown,
> = MutationConfig<TData, TVariables> & {
	optimistic: OptimisticConfig<TVariables, TSavedData>;
};
