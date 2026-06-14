// Browser-safe public surface for a web client. Only re-exports domain schemas
// that import nothing but `effect` — no server runtime (Bun, Postgres, HTTP) and
// no `@/` path aliases, so it resolves cleanly across the package boundary
// without a build step. See the effect-api-consumption rule.
export { Post, PostId } from "./domain/models/post"
