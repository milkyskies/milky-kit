export const createQueryOptions = <TParams, TData>({
	keyFn,
	queryFn,
}: {
	keyFn: (params: TParams) => readonly unknown[];
	queryFn: (params: TParams) => Promise<TData>;
}) => {
	return (params: TParams) => ({
		queryKey: keyFn(params) as unknown[],
		queryFn: () => queryFn(params),
	});
};
