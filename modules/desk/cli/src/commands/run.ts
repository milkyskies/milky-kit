import { type Command, type Context, emit } from "../context.ts"
import { repoSlug } from "../github/gh.ts"
import { type OrcaDeps, realOrcaDeps } from "../orca/deps.ts"
import { bindRun } from "../orca/runs.ts"

export async function runWith(deps: Pick<OrcaDeps, "orca">, context: Context): Promise<void> {
	const bound = await bindRun(deps.orca, repoSlug(context.repo))

	emit(context, bound.id, { run: bound.id, created: bound.created })
}

export const run: Command = (_args, context) => runWith(realOrcaDeps(), context)
