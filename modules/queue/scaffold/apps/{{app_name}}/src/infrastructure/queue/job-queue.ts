import { SqlClient } from "@effect/sql"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { Context, Data, Effect, Layer, Schema } from "effect"
import { jobsTable } from "./jobs-schema"

// Self-contained error so the queue doesn't couple to a particular repository.
export class QueueError extends Data.TaggedError("QueueError")<{ readonly cause: unknown }> {}

// A claimed unit of work. `payload` is jsonb — genuinely unknown until the handler
// decodes it with Schema (the rule is "decode at the boundary").
export type ClaimedJob = {
	readonly id: bigint
	readonly type: string
	readonly payload: unknown
}

// Retries before a job is parked as `failed`.
const MAX_ATTEMPTS = 3

const ClaimedRow = Schema.Struct({
	id: Schema.BigInt,
	type: Schema.String,
	payload: Schema.Unknown,
})

export class JobQueue extends Context.Tag("JobQueue")<
	JobQueue,
	{
		readonly enqueue: (type: string, payload: unknown) => Effect.Effect<void, QueueError>
		// Atomically claim up to `limit` pending (or stale-processing) rows.
		readonly claim: (limit: number) => Effect.Effect<ReadonlyArray<ClaimedJob>, QueueError>
		readonly complete: (id: bigint) => Effect.Effect<void, QueueError>
		// Re-queue for retry until attempts exhaust, then park as `failed`.
		readonly fail: (id: bigint, error: string) => Effect.Effect<void, QueueError>
	}
>() {}

export const JobQueueLive = Layer.effect(
	JobQueue,
	Effect.gen(function* () {
		const db = yield* PgDrizzle
		const sql = yield* SqlClient.SqlClient

		const wrap = <A, R>(effect: Effect.Effect<A, unknown, R>): Effect.Effect<A, QueueError, R> =>
			effect.pipe(Effect.mapError((cause) => new QueueError({ cause })))

		const enqueue = (type: string, payload: unknown) =>
			wrap(db.insert(jobsTable).values({ type, payload })).pipe(Effect.asVoid)

		const claim = (limit: number) =>
			wrap(
				sql<{ readonly id: string; readonly type: string; readonly payload: unknown }>`
					UPDATE jobs
					SET status = 'processing', claimed_at = now(), updated_at = now()
					WHERE id IN (
						SELECT id FROM jobs
						WHERE status = 'pending'
							OR (status = 'processing' AND claimed_at < now() - interval '2 minutes')
						ORDER BY created_at
						LIMIT ${limit}
						FOR UPDATE SKIP LOCKED
					)
					RETURNING id::text AS id, type, payload
				`.pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(ClaimedRow)))),
			)

		const complete = (id: bigint) =>
			wrap(
				sql`UPDATE jobs SET status = 'done', error = NULL, updated_at = now() WHERE id = ${id}`,
			).pipe(Effect.asVoid)

		const fail = (id: bigint, error: string) =>
			wrap(
				sql`
					UPDATE jobs
					SET attempts = attempts + 1,
						status = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END,
						error = ${error}, updated_at = now()
					WHERE id = ${id}
				`,
			).pipe(Effect.asVoid)

		return JobQueue.of({ enqueue, claim, complete, fail })
	}),
)
