import { BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import { IdGeneratorLive } from "./domain/services/id-generator"
import { PostRepositoryLive } from "./infrastructure/db/post-repository"
import { SqlLive } from "./infrastructure/db/sql-live"
import { McpServerStdioLive } from "./presentation/mcp/server"

// Stdio is the MCP protocol wire, so this entry point installs no logger on stdout.
McpServerStdioLive.pipe(
	Layer.provide(PostRepositoryLive),
	Layer.provide(IdGeneratorLive),
	Layer.provide(SqlLive),
	Layer.launch,
	BunRuntime.runMain,
)
