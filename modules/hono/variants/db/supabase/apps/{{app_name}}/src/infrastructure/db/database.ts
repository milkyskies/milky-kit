import type { Hyperdrive } from "@cloudflare/workers-types";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Bindings = { HYPERDRIVE: Hyperdrive };

// Single Drizzle handle every repository takes. Built once per request
// (in `presentation/middleware/repositories.ts`) and shared across all repos
// so we don't spin up multiple postgres-js clients per Workers invocation.
export type Database = PostgresJsDatabase;

export const makeDatabase = (env: Bindings): Database => {
	// Hyperdrive recommends max=5 and disabling fetch_types for serverless.
	const sql = postgres(env.HYPERDRIVE.connectionString, {
		max: 5,
		fetch_types: false,
	});
	return drizzle(sql);
};
