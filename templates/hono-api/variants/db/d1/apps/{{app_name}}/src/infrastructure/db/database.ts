import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1"
import type { Bindings } from "../env"

// Single Drizzle handle every repository takes. Built once per request
// (in `presentation/middleware/repositories.ts`) and shared across all repos
// so we don't spin up multiple drizzle clients per Workers invocation.
export type Database = DrizzleD1Database

export const makeDatabase = (env: Bindings): Database => drizzle(env.DB)
