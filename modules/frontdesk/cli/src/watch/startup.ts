import { reconcile } from "../reconcile/diff.ts"
import { type ReconcileInput, STARTS_WORKER } from "../reconcile/types.ts"

export function dispatchableAtStart(input: ReconcileInput): number[] {
	return reconcile(input)
		.filter((mismatch) => STARTS_WORKER.includes(mismatch.code) && mismatch.machine !== undefined)
		.map((mismatch) => mismatch.issue)
}
