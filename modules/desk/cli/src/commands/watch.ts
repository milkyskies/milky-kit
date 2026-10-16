import { homedir } from "node:os"
import { parseArgs } from "node:util"

import { parseOrUsage } from "../args.ts"
import type { Command, Context } from "../context.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { isMachineReachable, listHosts } from "../orca/hosts.ts"
import { readInbox } from "../orca/inbox.ts"
import { OrcaError } from "../orca/runner.ts"
import { listWorkers } from "../orca/workers.ts"
import { projectStateDirectory } from "../project/paths.ts"
import { loadIssues } from "../reconcile/load.ts"
import { fileLedger } from "../watch/ledger.ts"
import { parseDuration, watchLoop } from "../watch/loop.ts"
import type { WatchDeps } from "../watch/step.ts"
import { run as releaseRun } from "./release.ts"

const DEFAULT_MAX_WAIT = "30m"

export type WatchCommandDeps = Pick<OrcaDeps, "orca"> & {
	sleep: (ms: number) => Promise<void>
	ledgerDirectory: (context: Context) => string
}

export function realWatchDeps(): WatchCommandDeps {
	return {
		orca: realOrcaDeps().orca,
		sleep: (ms) => Bun.sleep(ms),
		ledgerDirectory: (context) => projectStateDirectory(homedir(), context.repo),
	}
}

export async function runWith(
	deps: WatchCommandDeps,
	args: string[],
	context: Context,
): Promise<void> {
	const { values } = parseOrUsage("watch", () =>
		parseArgs({ args, options: { "max-wait": { type: "string" } } }),
	)
	const maxWait = parseDuration(values["max-wait"] ?? DEFAULT_MAX_WAIT)

	const { orca } = deps
	const hosts = await listHosts(orca)
	const local = hosts.find((host) => host.kind === "local")

	const watchDeps: WatchDeps = {
		now: context.now,
		workers: () => listWorkers(orca, { includeRemote: true }),
		mail: async () => {
			try {
				return await readInbox(orca)
			} catch (error) {
				if (error instanceof OrcaError) return undefined

				throw error
			}
		},
		issues: () => loadIssues(context.gh, context.repo),
		isReachable: (machine) => isMachineReachable(orca, machine),
		release: (issue, claimId) =>
			releaseRun([String(issue), "--reason", "silent-machine", "--claim", claimId], {
				...context,
				out: () => undefined,
			}),
		localMachine: local?.name ?? "",
		ledger: fileLedger(deps.ledgerDirectory(context)),
	}

	const events = await watchLoop(watchDeps, deps.sleep, maxWait)

	for (const event of events) context.out(JSON.stringify(event))
}

export const run: Command = (args, context) => runWith(realWatchDeps(), args, context)
