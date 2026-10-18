import { EXIT, FrontdeskError } from "../errors.ts"
import { newWatchState, POLL_MS, step, type WatchDeps, type WatchEvent } from "./step.ts"

const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 }

export function parseDuration(text: string): number {
	const match = /^(\d+)([smh])$/.exec(text)
	const unit = match?.[2] === undefined ? undefined : UNITS[match[2]]
	if (match?.[1] === undefined || unit === undefined) {
		throw new FrontdeskError(
			EXIT.usage,
			`frontdesk: watch: --max-wait must look like 90s, 30m or 2h, got ${text}`,
		)
	}

	return Number(match[1]) * unit
}

export async function watchLoop(
	deps: WatchDeps,
	sleep: (ms: number) => Promise<void>,
	maxWaitMs: number,
): Promise<WatchEvent[]> {
	const state = newWatchState(deps.now())

	for (;;) {
		const events = await step(state, deps, maxWaitMs)
		if (events.length > 0) return events

		await sleep(POLL_MS)
	}
}
