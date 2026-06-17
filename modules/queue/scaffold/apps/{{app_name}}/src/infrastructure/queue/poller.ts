import { type Duration, Effect, Layer } from "effect"

/**
 * Generic durable-queue worker — the reusable mechanism behind any
 * `FOR UPDATE SKIP LOCKED` Postgres queue. It owns the loop only; the specifics
 * (which table, how to claim, how to process an item) are injected. The job-queue
 * variant wires it to the `jobs` table; you can also point it at any other queue.
 */
export interface PollerOptions<A, E, R> {
	readonly name: string
	// Atomically claim up to a batch of work items (the claim marks them in-progress).
	readonly claim: Effect.Effect<ReadonlyArray<A>, E, R>
	// Process one claimed item to completion. Must record its own success/failure;
	// a failure here is logged and isolated, never aborts its batch siblings.
	readonly process: (item: A) => Effect.Effect<void, E, R>
	// How long to wait before polling again when a claim returns nothing.
	readonly idle: Duration.DurationInput
	// Max items processed concurrently within a claimed batch.
	readonly concurrency: number
}

const runBatch = <A, E, R>(
	options: PollerOptions<A, E, R>,
	items: ReadonlyArray<A>,
): Effect.Effect<void, never, R> => {
	if (items.length === 0) {
		return Effect.sleep(options.idle)
	}

	// Isolate per-item failures so one bad item never interrupts its siblings or
	// kills the loop — the item's own process effect is responsible for recording
	// its failure; here we just make sure we keep going.
	return Effect.forEach(
		items,
		(item) =>
			options
				.process(item)
				.pipe(
					Effect.catchAllCause((cause) =>
						Effect.logError(`poller "${options.name}" item failed`, cause),
					),
				),
		{ concurrency: options.concurrency, discard: true },
	)
}

const tick = <A, E, R>(options: PollerOptions<A, E, R>): Effect.Effect<void, never, R> =>
	options.claim.pipe(
		Effect.flatMap((items) => runBatch(options, items)),
		Effect.catchAllCause((cause) =>
			Effect.logError(`poller "${options.name}" claim failed`, cause).pipe(
				Effect.zipRight(Effect.sleep(options.idle)),
			),
		),
	)

// The forever loop. Never fails (every tick swallows + logs its errors), so the
// daemon stays alive for the process lifetime.
export const runPoller = <A, E, R>(
	options: PollerOptions<A, E, R>,
): Effect.Effect<never, never, R> => tick(options).pipe(Effect.forever)

// Layer that forks the poller as a scoped daemon — it runs for as long as the app's
// scope is open and is interrupted on graceful shutdown. Provide its R
// (claim/process dependencies) where this layer is composed (merge it into AppLive).
export const pollerLayer = <A, E, R>(options: PollerOptions<A, E, R>): Layer.Layer<never, never, R> =>
	Layer.scopedDiscard(
		Effect.logInfo(`poller "${options.name}" started`).pipe(
			Effect.zipRight(Effect.forkScoped(runPoller(options))),
		),
	)
