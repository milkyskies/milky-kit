import type { AuthBindings } from "./env-auth";
import type { DbBindings } from "./env-db";

// Bindings = the complete runtime env Hono sees on `c.env`.
// Composed from per-variant partials so the auth axis can extend it
// without touching the db variant's file (and vice versa).
export type Bindings = DbBindings & AuthBindings;
