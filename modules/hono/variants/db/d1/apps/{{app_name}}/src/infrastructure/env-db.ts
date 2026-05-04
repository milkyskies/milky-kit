import type { D1Database } from "@cloudflare/workers-types";

export type DbBindings = {
	DB: D1Database;
};
