import { parseArgs } from "node:util"

import { parseOrUsage } from "../args.ts"
import type { Command, Context } from "../context.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { reconcile } from "../reconcile/diff.ts"
import { gatherInput } from "../reconcile/gather.ts"

export async function runWith(deps: OrcaDeps, args: string[], context: Context): Promise<void> {
	const { values } = parseOrUsage("reconcile", () =>
		parseArgs({ args, options: { run: { type: "string" } } }),
	)

	const input = await gatherInput(
		context.gh,
		context.repo,
		deps.orca,
		await deps.loadSection(),
		context.now(),
		values.run,
	)
	const mismatches = reconcile(input)

	if (context.json) {
		context.out(JSON.stringify({ mismatches }))

		return
	}

	if (mismatches.length === 0) {
		context.out("no mismatches")

		return
	}

	for (const mismatch of mismatches) {
		context.out(`#${mismatch.issue} ${mismatch.code}: ${mismatch.detail}`)
	}
}

export const run: Command = (args, context) => runWith(realOrcaDeps(), args, context)
