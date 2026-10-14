# {{project_name}}

Effect-TS API on Effect 4. `effect/http-api` for HTTP, `drizzle-orm/effect-postgres` over `@effect/sql-pg` for Postgres, `effect/ai` for the MCP server. Clean-architecture split: `domain/` → `application/use-case/` → `infrastructure/` → `presentation/{http,mcp}`.

Rules load from `.claude/rules/`, which `milky-kit:new` populated with symlinks into `~/.claude/kit/`. See the kit's README for the full set.

## Project-specific

<!-- Project-owned. milky-kit's upgrade skill never touches this section. -->
