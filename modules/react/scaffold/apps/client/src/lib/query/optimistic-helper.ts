import type { QueryKey } from "@tanstack/react-query";
import type { OptimisticConfig } from "./types";

export function optimisticUpdate<TItem, TVariables>({
	queryKey,
	matcher,
	merge,
	cancelQueries,
}: {
	queryKey: QueryKey;
	matcher: (item: TItem, variables: TVariables) => boolean;
	merge: (item: TItem, variables: TVariables) => TItem;
	cancelQueries?: QueryKey | QueryKey[];
}): OptimisticConfig<TVariables, TItem[]> {
	return {
		cancelQueries,
		getCacheData: (client) => client.getQueryData<TItem[]>(queryKey) ?? [],
		updateCache: (client, variables, current) => {
			const updated = current.map((item) =>
				matcher(item, variables) ? merge(item, variables) : item,
			);
			client.setQueryData(queryKey, updated);
			return current;
		},
		rollbackCache: (client, saved) => client.setQueryData(queryKey, saved),
	};
}

export function optimisticCreate<TItem, TVariables>({
	queryKey,
	buildItem,
	position = "end",
	cancelQueries,
}: {
	queryKey: QueryKey;
	buildItem: (variables: TVariables) => TItem;
	position?: "start" | "end";
	cancelQueries?: QueryKey | QueryKey[];
}): OptimisticConfig<TVariables, TItem[]> {
	return {
		cancelQueries,
		getCacheData: (client) => client.getQueryData<TItem[]>(queryKey) ?? [],
		updateCache: (client, variables, current) => {
			const tempItem = buildItem(variables);
			const updated =
				position === "start" ? [tempItem, ...current] : [...current, tempItem];
			client.setQueryData(queryKey, updated);
			return current;
		},
		rollbackCache: (client, saved) => client.setQueryData(queryKey, saved),
	};
}

export function optimisticDelete<TItem, TVariables>({
	queryKey,
	matcher,
	cancelQueries,
}: {
	queryKey: QueryKey;
	matcher: (item: TItem, variables: TVariables) => boolean;
	cancelQueries?: QueryKey | QueryKey[];
}): OptimisticConfig<TVariables, TItem[]> {
	return {
		cancelQueries,
		getCacheData: (client) => client.getQueryData<TItem[]>(queryKey) ?? [],
		updateCache: (client, variables, current) => {
			const updated = current.filter((item) => !matcher(item, variables));
			client.setQueryData(queryKey, updated);
			return current;
		},
		rollbackCache: (client, saved) => client.setQueryData(queryKey, saved),
	};
}

export function optimisticToggle<TItem, TVariables>({
	queryKey,
	matcher,
	toggle,
	cancelQueries,
}: {
	queryKey: QueryKey;
	matcher: (item: TItem, variables: TVariables) => boolean;
	toggle: (item: TItem, variables: TVariables) => TItem;
	cancelQueries?: QueryKey | QueryKey[];
}): OptimisticConfig<TVariables, TItem[]> {
	return {
		cancelQueries,
		getCacheData: (client) => client.getQueryData<TItem[]>(queryKey) ?? [],
		updateCache: (client, variables, current) => {
			const updated = current.map((item) =>
				matcher(item, variables) ? toggle(item, variables) : item,
			);
			client.setQueryData(queryKey, updated);
			return current;
		},
		rollbackCache: (client, saved) => client.setQueryData(queryKey, saved),
	};
}

export function optimisticReplaceDetail<TItem, TVariables>({
	queryKey,
	merge,
	cancelQueries,
}: {
	queryKey: QueryKey;
	merge: (current: TItem, variables: TVariables) => TItem;
	cancelQueries?: QueryKey | QueryKey[];
}): OptimisticConfig<TVariables, TItem | undefined> {
	return {
		cancelQueries,
		getCacheData: (client) => client.getQueryData<TItem>(queryKey),
		updateCache: (client, variables, current) => {
			if (!current) return current;
			const updated = merge(current, variables);
			client.setQueryData(queryKey, updated);
			return current;
		},
		rollbackCache: (client, saved) => client.setQueryData(queryKey, saved),
	};
}
