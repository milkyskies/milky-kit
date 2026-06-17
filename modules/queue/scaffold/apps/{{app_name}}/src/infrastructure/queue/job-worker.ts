import { Effect, Match } from "effect"
import { type ClaimedJob, JobQueue } from "./job-queue"
import { pollerLayer } from "./poller"

// How many jobs to claim + run per poll, and how often to poll when idle.
const BATCH = 5
const CONCURRENCY = 3
const IDLE = "2 seconds"

// Dispatch a claimed job to its handler by `type`. Add a Match.when per job type;
// decode job.payload with Schema inside the handler (it's `unknown` at the boundary).
const handle = (job: ClaimedJob): Effect.Effect<void> =>
	Match.value(job.type).pipe(
		// Match.when("send-email", () =>
		// 	Schema.decodeUnknown(SendEmailPayload)(job.payload).pipe(Effect.flatMap(sendEmail)),
		// ),
		Match.orElse(() => Effect.logWarning(`no handler for job type "${job.type}"`)),
	)

const processJob = (job: ClaimedJob) =>
	Effect.gen(function* () {
		const queue = yield* JobQueue

		yield* handle(job).pipe(
			Effect.flatMap(() => queue.complete(job.id)),
			Effect.catchAllCause((cause) => queue.fail(job.id, String(cause))),
		)
	})

// The job worker daemon. Merge JobWorkerLive into AppLive to run it for the app's
// lifetime (it needs JobQueue, which needs PgDrizzle + SqlClient).
export const JobWorkerLive = pollerLayer({
	name: "jobs",
	claim: Effect.flatMap(JobQueue, (queue) => queue.claim(BATCH)),
	process: processJob,
	idle: IDLE,
	concurrency: CONCURRENCY,
})
