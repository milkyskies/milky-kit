import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Bindings } from "../env";

// Single Drizzle handle every repository takes. Built once per request
// (in `presentation/middleware/repositories.ts`) and shared across all repos
// so we don't spin up multiple postgres-js clients per Workers invocation.
export type Database = PostgresJsDatabase;

export const makeDatabase = (env: Bindings): Database => {
	const sql = postgres(env.HYPERDRIVE.connectionString, {
		// Hyperdrive recommends max=5 and disabling fetch_types for serverless.
		max: 5,
		fetch_types: false,
		// Supabase's transaction pooler (port 6543), which Hyperdrive points
		// at, runs pgbouncer in transaction mode and rejects prepared
		// statements: the first query in a backend connection prepares, but
		// the next request may be routed to a different backend where that
		// prepared statement doesn't exist → the query fails with
		// `Failed query: ...`. Symptom: intermittent 500s on DB-touching
		// routes with TanStack Query retrying every ~5s.
		// `prepare: false` sends every query via the simple protocol, which
		// transaction-mode pgbouncer handles fine.
		prepare: false,
	});
	return drizzle(sql);
};
