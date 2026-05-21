import type { AuthBindings } from "./env-auth"
import type { DbBindings } from "./env-db"

// App-wide bindings present in every variant combination.
type CoreBindings = {
	// Comma-separated allowed CORS origins, e.g.
	// "http://localhost:5173,capacitor://localhost,https://my-app.com".
	// Set in wrangler.jsonc `vars` (prod) and override locally via .dev.vars.
	CORS_ORIGINS: string
}

// Bindings = the complete runtime env Hono sees on `c.env`.
// Composed from per-variant partials so the auth axis can extend it
// without touching the db variant's file (and vice versa).
export type Bindings = CoreBindings & DbBindings & AuthBindings
