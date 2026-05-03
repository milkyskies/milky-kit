import { neon } from "@neondatabase/serverless";
import { type NeonHttpDatabase, drizzle } from "drizzle-orm/neon-http";

export type Bindings = { DATABASE_URL: string };

// Single Drizzle handle every repository takes. Built once per request
// (in `presentation/middleware/repositories.ts`) and shared across all repos
// so we don't open multiple Neon HTTP sessions per Workers invocation.
export type Database = NeonHttpDatabase;

export const makeDatabase = (env: Bindings): Database => {
	const sql = neon(env.DATABASE_URL);
	return drizzle(sql);
};
