import { bigint, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

// Generic durable job queue. A `pending` row IS a unit of work; the worker claims
// it (FOR UPDATE SKIP LOCKED), runs the handler for its `type`, and marks it
// done/failed. `payload` is the handler's input — decode it with Schema at the
// boundary (see job-worker.ts). Add domain-specific columns (e.g. a dedup key, a
// `run_after` for delays) as your needs grow.
export const jobsTable = pgTable("jobs", {
	id: bigint("id", { mode: "bigint" }).primaryKey().generatedByDefaultAsIdentity(),
	type: text("type").notNull(),
	payload: jsonb("payload"),
	status: text("status").notNull().default("pending"),
	attempts: integer("attempts").notNull().default(0),
	error: text("error"),
	// When the worker claimed the row; used to reclaim stale `processing` rows.
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
})

export type JobRow = typeof jobsTable.$inferSelect
