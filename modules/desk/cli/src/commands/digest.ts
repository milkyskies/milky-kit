import { homedir } from "node:os"
import { parseArgs } from "node:util"

import { parseOrUsage } from "../args.ts"
import type { Command, Context } from "../context.ts"
import { DeskError, EXIT } from "../errors.ts"
import {
	collectDigest,
	digestMessage,
	markPinged,
	parseBadLabelLedger,
	unseenBadLabels,
} from "../ping/digest.ts"
import { type PingDeps, realPingDeps, sendPing } from "../ping/ntfy.ts"
import { projectStateDirectory } from "../project/paths.ts"
import { loadIssues } from "../reconcile/load.ts"
import { fileLedger, type Ledger } from "../watch/ledger.ts"

const BAD_LABELS_FILE = "badlabels-pinged.json"

export type DigestDeps = { ping: PingDeps; ledger: Ledger }

export function realDigestDeps(context: Context): DigestDeps {
	return {
		ping: realPingDeps(),
		ledger: fileLedger(projectStateDirectory(homedir(), context.repo)),
	}
}

export async function runWith(deps: DigestDeps, args: string[], context: Context): Promise<void> {
	const { values } = parseOrUsage("digest", () =>
		parseArgs({ args, options: { send: { type: "boolean" } } }),
	)

	const { gh, repo } = context
	const now = context.now()
	const issues = await loadIssues(gh, repo)
	const collected = collectDigest(issues, now)
	const badLedger = parseBadLabelLedger(await deps.ledger.read(BAD_LABELS_FILE))
	const digest = {
		items: collected.items,
		badLabels: unseenBadLabels(collected.badLabels, badLedger),
	}

	if (digest.items.length === 0 && digest.badLabels.length === 0) {
		context.out(context.json ? JSON.stringify({ sent: false, message: null }) : "nothing to ping")

		return
	}

	const message = digestMessage(repo, digest)

	if (!values.send) {
		context.out(context.json ? JSON.stringify({ sent: false, message }) : message)

		return
	}

	await sendPing(deps.ping, message)

	const failures: string[] = []
	for (const item of digest.items) {
		try {
			await markPinged(gh, repo, item.comment, now)
		} catch (error) {
			failures.push(`#${item.issue}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	if (digest.badLabels.length > 0) {
		const stillBad = collected.badLabels.map((entry) => [String(entry.issue), entry.labels])
		await deps.ledger.write(BAD_LABELS_FILE, Object.fromEntries(stillBad))
	}

	if (failures.length > 0) {
		throw new DeskError(
			EXIT.external,
			`desk: digest: the ping was sent, but marking failed for ${failures.join("; ")}. The next pass repeats the ping`,
		)
	}

	context.out(
		context.json ? JSON.stringify({ sent: true, message }) : `sent: ${message.split("\n")[0]}`,
	)
}

export const run: Command = (args, context) => runWith(realDigestDeps(context), args, context)
