# Background jobs: durable Postgres queue

This module adds a durable, Postgres-backed job queue (no extra infra). A `pending`
row in `jobs` is a unit of work; a worker daemon claims it with `FOR UPDATE SKIP
LOCKED`, runs the handler for its `type`, and marks it done/failed. It lives in
`infrastructure/queue/` and depends on `PgDrizzle` + `SqlClient` (effect-sql).

## Shape

```
src/infrastructure/queue/
├── poller.ts        Generic loop — reuse for ANY SKIP-LOCKED queue, not just jobs.
├── jobs-schema.ts   The `jobs` table.
├── job-queue.ts     JobQueue service: enqueue / claim / complete / fail.
└── job-worker.ts    The daemon; dispatches by job.type.
```

## Rules

- **The poller is the reusable seam.** It owns only the loop (claim → process
  concurrently → isolate per-item failures → scoped daemon). Inject claim/process;
  don't fork your own `while`/`setTimeout` loops. A second queue reuses `pollerLayer`.
- **Claim is the only safe way to take work.** `FOR UPDATE SKIP LOCKED` + a stale
  reclaim (a `processing` row older than the timeout returns to the pool) means
  concurrent workers never double-process and a crash mid-job doesn't strand work.
- **Decode the payload at the boundary.** `jobs.payload` is jsonb → `unknown` on
  the claim. The handler decodes it with `Schema.decodeUnknown` before use; never
  thread the raw value through business logic.
- **Dispatch by `type` with `Match`.** One `Match.when(type, ...)` per job type in
  the worker, `Match.orElse` for the unknown-type case — not an if/else chain.
- **Bounded retry, then park.** `fail` re-queues until `MAX_ATTEMPTS`, then sets
  `failed`. Don't re-pend `failed` rows automatically on every read — that retries
  forever; retry only on input change or an explicit user action.
- **The worker is a scoped daemon.** `pollerLayer` forks it for the app's lifetime
  and interrupts it on shutdown. Merge `JobWorkerLive` into `AppLive`; never call
  `Effect.runFork` by hand.

See QUEUE.md (scaffolded at the app root) for the one-time wiring steps.
