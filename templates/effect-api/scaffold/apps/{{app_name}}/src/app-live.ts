import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { Layer } from "effect"
import { IdGeneratorLive } from "@/domain/services/id-generator"
import { PostRepositoryLive } from "@/infrastructure/db/post-repository"
import { SqlLive } from "@/infrastructure/db/sql-live"
import { LoggerLive } from "@/infrastructure/logger"
import { HttpServerLive } from "@/presentation/http/server"

/**
 * Composition root. Provides every service the app needs.
 *
 * Layer order matters for transitive deps:
 *   - SqlLive provides SqlClient (consumed by PgDrizzle).
 *   - PgDrizzle.layer provides PgDrizzle (consumed by PostRepositoryLive).
 *   - PostRepositoryLive provides PostRepository (consumed by use cases).
 *   - HttpServerLive runs the HTTP listener, serving REST under /api AND MCP at
 *     /mcp (both share the toolkit definitions).
 *
 * The stdio MCP transport runs in its own entry point (main-mcp.ts) for local
 * Claude Code, since stdio competes with the process's stdout for log output.
 */
export const AppLive = HttpServerLive.pipe(
	Layer.provide(PostRepositoryLive),
	Layer.provide(IdGeneratorLive),
	Layer.provide(PgDrizzle.layer),
	Layer.provide(SqlLive),
	Layer.provide(LoggerLive),
)
