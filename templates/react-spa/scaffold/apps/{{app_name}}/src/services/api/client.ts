import { createApiClient } from "@{{project_name}}/api/client"
import { env } from "@/config/env"
import { getApiToken } from "@/services/api/auth-token"

// Attaches a bearer token (when one is available) and force-refreshes once on 401.
// When no auth is configured, `getApiToken` returns null and this just
// passes through to plain fetch — zero overhead for unauthed apps.
const authedFetch: typeof fetch = async (input, init) => {
	const token = await getApiToken()
	if (!token) return fetch(input, init)

	const attemptWithToken = async (bearer: string): Promise<Response> => {
		const headers = new Headers(init?.headers)
		headers.set("Authorization", `Bearer ${bearer}`)
		return fetch(input, { ...init, headers })
	}

	const response = await attemptWithToken(token)
	if (response.status !== 401) return response

	const refreshed = await getApiToken({ forceRefresh: true })
	if (!refreshed) return response

	return attemptWithToken(refreshed)
}

export const api = createApiClient(env.VITE_API_URL, { fetch: authedFetch })
