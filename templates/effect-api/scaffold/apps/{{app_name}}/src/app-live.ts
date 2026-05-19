import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { Layer } from "effect"
import { IdGeneratorLive } from "@/domain/services/id-generator"
import { LoggerLive } from "@/infrastructure/logger"
import { PostRepositoryLive } from "@/infrastructure/db/post-repository"
import { SqlLive } from "@/infrastructure/db/sql-live"
import { HttpServerLive } from "@/presentation/http/server"

/**
 * Composition root. Provides every service the app needs.
 *
 * Layer order matters for transitive deps:
 *   - SqlLive provides SqlClient (consumed by PgDrizzle).
 *   - PgDrizzle.layer provides PgDrizzle (consumed by PostRepositoryLive).
 *   - PostRepositoryLive provides PostRepository (consumed by use cases).
 *   - HttpServerLive runs the HTTP listener.
 *
 * The MCP server is NOT included here — it runs in its own entry point
 * because stdio transport competes with the process's stdout for log
 * output. Run via `bun src/main-mcp.ts` from Claude Code's MCP config.
 */
export const AppLive = HttpServerLive.pipe(
	Layer.provide(PostRepositoryLive),
	Layer.provide(IdGeneratorLive),
	Layer.provide(PgDrizzle.layer),
	Layer.provide(SqlLive),
	Layer.provide(LoggerLive),
)
