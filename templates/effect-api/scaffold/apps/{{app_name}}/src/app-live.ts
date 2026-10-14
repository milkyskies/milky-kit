import { Layer } from "effect"
import { IdGeneratorLive } from "./domain/services/id-generator"
import { PostRepositoryLive } from "./infrastructure/db/post-repository"
import { SqlLive } from "./infrastructure/db/sql-live"
import { LoggerLive } from "./infrastructure/logger"
import { HttpServerLive } from "./presentation/http/server"

export const AppLive = HttpServerLive.pipe(
	Layer.provide(PostRepositoryLive),
	Layer.provide(IdGeneratorLive),
	Layer.provide(SqlLive),
	Layer.provide(LoggerLive),
)
