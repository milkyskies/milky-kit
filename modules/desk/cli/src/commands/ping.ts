import type { RepoFreeCommand } from "../context.ts"
import { usageError } from "../errors.ts"
import { type PingDeps, realPingDeps, sendPing } from "../ping/ntfy.ts"

export async function runWithoutRepoUsing(
	deps: PingDeps,
	args: string[],
	context: { json: boolean; out: (line: string) => void },
): Promise<void> {
	const message = args.join(" ").trim()
	if (message === "") throw usageError("ping", 'usage: desk ping "<message>"')

	await sendPing(deps, message)

	context.out(context.json ? JSON.stringify({ pinged: true }) : "pinged")
}

export const runWithoutRepo: RepoFreeCommand = (args, context) =>
	runWithoutRepoUsing(realPingDeps(), args, context)
