import { Hono } from "hono"
import type { Bindings } from "../infrastructure/env"
import { errorHandler } from "./error-handler"
import { corsMiddleware } from "./middleware/cors"
import { statusRoutes } from "./routes/status-routes"

export const app = new Hono<{ Bindings: Bindings }>()
	.onError(errorHandler)
	.use("*", corsMiddleware)
	.route("/", statusRoutes)
