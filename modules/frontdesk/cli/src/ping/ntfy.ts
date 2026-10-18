import { type Environment, loadUserEnvironment, ntfySettings } from "../config/env.ts"
import { FrontdeskError, EXIT } from "../errors.ts"

export type PingDeps = {
	loadEnv: () => Promise<Environment>
	post: (url: string, headers: Record<string, string>, body: string) => Promise<number>
}

const SETUP_FIX =
	"Fix: write FRONTDESK_NTFY_URL and FRONTDESK_NTFY_TOPIC into ~/.config/frontdesk/.env (docs/frontdesk/phase-2.md, section 7)"

export function realPingDeps(): PingDeps {
	return {
		loadEnv: () => loadUserEnvironment(),
		post: async (url, headers, body) => {
			const response = await fetch(url, { method: "POST", headers, body })

			return response.status
		},
	}
}

export async function sendPing(deps: PingDeps, message: string): Promise<void> {
	const settings = ntfySettings(await deps.loadEnv())
	if (!settings) {
		throw new FrontdeskError(EXIT.external, `frontdesk: ping: ntfy is not configured. ${SETUP_FIX}`)
	}

	const headers: Record<string, string> = {}
	if (settings.token) headers.Authorization = `Bearer ${settings.token}`

	let status: number
	try {
		status = await deps.post(`${settings.url}/${settings.topic}`, headers, message)
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)
		throw new FrontdeskError(
			EXIT.external,
			`frontdesk: ping: ntfy at ${settings.url} is unreachable: ${detail}`,
		)
	}

	if (status < 200 || status >= 300) {
		throw new FrontdeskError(
			EXIT.external,
			`frontdesk: ping: ntfy at ${settings.url} answered HTTP ${status}`,
		)
	}
}
