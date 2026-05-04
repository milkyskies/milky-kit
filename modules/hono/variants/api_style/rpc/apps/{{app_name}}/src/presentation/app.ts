import { Hono } from "hono";
import type { Bindings } from "../infrastructure/env";
import { corsMiddleware } from "./middleware/cors";
import {
	type RepositoryVariables,
	repositoriesMiddleware,
} from "./middleware/repositories";
import { postRoutes } from "./routes/post-routes";

export const app = new Hono<{
	Bindings: Bindings;
	Variables: RepositoryVariables;
}>()
	.use("*", corsMiddleware)
	.use("*", repositoriesMiddleware)
	.route("/", postRoutes);
