// No auth configured — api/client.ts treats null as "skip the Authorization
// header" and falls through to plain fetch. Replace with the real token
// getter when you add an auth layer (the auth=firebase variant ships one).
export const getApiToken = async (_options?: { forceRefresh?: boolean }): Promise<string | null> =>
	null
