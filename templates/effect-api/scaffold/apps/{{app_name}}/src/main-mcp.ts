import { BunRuntime } from "@effect/platform-bun"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { Layer } from "effect"
import { IdGeneratorLive } from "@/domain/services/id-generator"
import { PostRepositoryLive } from "@/infrastructure/db/post-repository"
import { SqlLive } from "@/infrastructure/db/sql-live"
import { LoggerLive } from "@/infrastructure/logger"
import { McpServerLive } from "@/presentation/mcp/server"

/**
 * MCP entry point. Separate from main.ts because stdio MCP transport
 * needs exclusive access to the process's stdout (it's the MCP wire),
 * which means the HTTP server's log output would corrupt the stream.
 *
 * Run from Claude Code's mcp settings:
 *   { "command": "bun", "args": ["src/main-mcp.ts"] }
 */
const McpAppLive = McpServerLive.pipe(
	Layer.provide(PostRepositoryLive),
	Layer.provide(IdGeneratorLive),
	Layer.provide(PgDrizzle.layer),
	Layer.provide(SqlLive),
	Layer.provide(LoggerLive),
)

Layer.launch(McpAppLive).pipe(BunRuntime.runMain)
