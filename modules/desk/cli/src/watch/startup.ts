import { reconcile } from "../reconcile/diff.ts"
import type { ReconcileInput } from "../reconcile/types.ts"

export function dispatchableAtStart(input: ReconcileInput): number[] {
	return reconcile(input)
		.filter(
			(mismatch) =>
				["dispatch", "intake", "escalate"].includes(mismatch.code) &&
				mismatch.machine !== undefined,
		)
		.map((mismatch) => mismatch.issue)
}
