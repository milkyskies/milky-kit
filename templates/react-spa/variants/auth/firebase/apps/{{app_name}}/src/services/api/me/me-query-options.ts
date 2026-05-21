import { queryOptions } from "@tanstack/react-query"
import { Option } from "effect"
import { Me } from "@/models/me"
import { api } from "@/services/api/client"

// Wraps GET /me. Returns Option.none() on 404 (ProfileRequired) so route
// guards can branch via Match.value(...) without throwing.
export const meQueryOptions = queryOptions({
	queryKey: ["me"],
	queryFn: async (): Promise<Option.Option<Me>> => {
		const response = await api.me.$get()
		if (response.status === 404) return Option.none()
		if (!response.ok) {
			throw new Error(`Failed to fetch /me: ${response.status}`)
		}
		const dto = await response.json()
		if ("error" in dto) return Option.none()
		return Option.some(Me.fromApi(dto))
	},
	staleTime: Number.POSITIVE_INFINITY,
})
