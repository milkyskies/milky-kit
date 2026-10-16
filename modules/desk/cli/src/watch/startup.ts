import { reconcile } from "../reconcile/diff.ts"
import type { ReconcileInput } from "../reconcile/types.ts"

export function dispatchableAtStart(input: ReconcileInput): number[] {
	return reconcile(input)
		.filter(
			(mismatch) =>
				(mismatch.code === "dispatch" || mismatch.code === "escalate") &&
				mismatch.machine !== undefined,
		)
		.map((mismatch) => mismatch.issue)
}
