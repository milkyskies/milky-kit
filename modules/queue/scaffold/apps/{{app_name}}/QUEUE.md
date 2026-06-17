# Background job queue

A durable, Postgres-backed work queue — no extra infra. A `pending` row in the
`jobs` table is a unit of work; a worker daemon claims it with
`FOR UPDATE SKIP LOCKED`, runs the handler for its `type`, and marks it done or
failed (with bounded retry). Survives restarts: stale `processing` rows are
reclaimed by age.

Files (`src/infrastructure/queue/`):

- `poller.ts` — generic loop (claim → process concurrently → isolate failures →
  scoped daemon). Reusable for any SKIP-LOCKED queue, not just this one.
- `jobs-schema.ts` — the `jobs` table.
- `job-queue.ts` — `JobQueue` service: `enqueue` / `claim` / `complete` / `fail`.
- `job-worker.ts` — the worker daemon; dispatches by `job.type`.

## Wire it up

1. **Register the schema + generate the migration.** Add the jobs schema to your
   `drizzle.config.ts` (make `schema` an array), then generate:

   ```ts
   // drizzle.config.ts
   schema: ["./src/infrastructure/db/schema.ts", "./src/infrastructure/queue/jobs-schema.ts"],
   ```

   ```sh
   bun db:generate && bun db:migrate
   ```

2. **Run the worker** — merge it into your composition root and provide `JobQueue`:

   ```ts
   // app-live.ts
   import { Layer } from "effect"
   import { JobQueueLive } from "@/infrastructure/queue/job-queue"
   import { JobWorkerLive } from "@/infrastructure/queue/job-worker"

   export const AppLive = Layer.mergeAll(HttpServerLive, JobWorkerLive).pipe(
     Layer.provide(JobQueueLive),
     // ...existing provides (PgDrizzle.layer, SqlLive, ...)
   )
   ```

3. **Add handlers** in `job-worker.ts` — one `Match.when(type, ...)` per job type.
   Decode `job.payload` with `Schema` inside the handler (it's `unknown` at the
   boundary).

4. **Enqueue** from a use case:

   ```ts
   const queue = yield* JobQueue
   yield* queue.enqueue("send-email", { to, subject })
   ```

## Notes

- Tune `BATCH` / `CONCURRENCY` / `IDLE` (poll cadence) and `MAX_ATTEMPTS` in
  `job-worker.ts` / `job-queue.ts`.
- For richer needs add columns to `jobs` (a dedup/idempotency key, a `run_after`
  for delayed jobs, a priority) — the claim query is the only place to update.
- Want zero poll-latency? Add Postgres `LISTEN/NOTIFY` on insert to wake the
  worker instead of polling — additive, no schema change.
